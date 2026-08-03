use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use crate::types::{FileEntry, FileInfo, system_time_to_millis};

/// Lists the direct children of a directory.
/// Directories are returned first, then files, both sorted case-insensitively by name.
///
/// On Windows, `read_dir` already caches file metadata in the `DirEntry`, so we
/// extract it directly without issuing a second `stat` syscall per entry. The
/// remaining work (string conversion, time normalisation, sorting) is parallelised
/// with Rayon for directories containing many entries.
#[tauri::command]
pub fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
    let start = Instant::now();
    let read_dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    // Collect (path, metadata) pairs — metadata comes from the DirEntry cache
    // on Windows, avoiding N redundant stat syscalls.
    let raw_entries: Vec<(PathBuf, std::fs::Metadata)> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            Some((entry.path(), metadata))
        })
        .collect();

    let mut entries: Vec<FileEntry> = raw_entries
        .par_iter()
        .filter_map(|(path, metadata)| Some(FileEntry::from_metadata(path, metadata)))
        .collect();

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    eprintln!(
        "[profile] list_dir({}) -> {} entries in {:?}",
        path,
        entries.len(),
        start.elapsed()
    );

    Ok(entries)
}

/// Recursively computes the total size of a directory (sum of all file sizes).
/// A maximum depth prevents excessively long traversals on huge directory trees
/// (e.g. `node_modules`). The default depth of 12 is sufficient for most use cases.
#[tauri::command]
pub async fn folder_size(path: &str, max_depth: Option<usize>) -> Result<u64, String> {
    let path = path.to_string();
    let depth = max_depth.unwrap_or(12);
    tokio::task::spawn_blocking(move || compute_dir_size(Path::new(&path), depth))
        .await
        .map_err(|e| e.to_string())
}

/// Recursively computes the total size of a directory using Rayon to parallelise
/// subdirectory traversal across available CPU cores. `remaining_depth` limits
/// how deep the recursion goes to avoid pathological cases.
pub fn compute_dir_size(path: &Path, remaining_depth: usize) -> u64 {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return 0,
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    entries
        .par_iter()
        .map(|entry_path| {
            let metadata = match std::fs::metadata(entry_path) {
                Ok(m) => m,
                Err(_) => return 0,
            };
            if metadata.is_dir() {
                if remaining_depth == 0 {
                    // Depth limit reached — stop recursing, count 0 for this subtree.
                    0
                } else {
                    compute_dir_size(entry_path, remaining_depth - 1)
                }
            } else {
                metadata.len()
            }
        })
        .sum()
}

/// Creates an empty file at the given path.
#[tauri::command]
pub fn create_file(path: &str) -> Result<(), String> {
    std::fs::File::create(path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Creates a directory at the given path (recursive, like `mkdir -p`).
#[tauri::command]
pub fn create_dir(path: &str) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Renames or moves a file/directory from old_path to new_path.
#[tauri::command]
pub fn rename_entry(old_path: &str, new_path: &str) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Deletes a file or directory (recursive for directories).
#[tauri::command]
pub async fn delete_entry(path: &str) -> Result<(), String> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path);
        if p.is_dir() {
            std::fs::remove_dir_all(p)
        } else {
            std::fs::remove_file(p)
        }
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Copies a file or directory (recursive for directories) from src to dst.
#[tauri::command]
pub async fn copy_entry(src: &str, dst: &str) -> Result<(), String> {
    let src = src.to_string();
    let dst = dst.to_string();
    tokio::task::spawn_blocking(move || copy_recursive(Path::new(&src), Path::new(&dst)))
        .await
        .map_err(|e| e.to_string())?
}

fn copy_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if src.is_dir() {
        std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
        for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
            let entry_path = entry.path();
            let dest_path = dst.join(entry.file_name());
            copy_recursive(&entry_path, &dest_path)?;
        }
        Ok(())
    } else {
        std::fs::copy(src, dst).map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Moves a file or directory from src to dst.
#[tauri::command]
pub async fn move_entry(src: &str, dst: &str) -> Result<(), String> {
    let src = src.to_string();
    let dst = dst.to_string();
    tokio::task::spawn_blocking(move || {
        std::fs::rename(&src, &dst).or_else(|_| {
            // Fallback: copy then delete (cross-filesystem moves)
            copy_recursive(Path::new(&src), Path::new(&dst))?;
            let p = Path::new(&src);
            if p.is_dir() {
                std::fs::remove_dir_all(p)
            } else {
                std::fs::remove_file(p)
            }
            .map_err(|e| e.to_string())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Returns detailed metadata about a file or directory.
#[tauri::command]
pub fn get_file_info(path: &str) -> Result<FileInfo, String> {
    let p = Path::new(path);
    let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = p
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let created = metadata.created().ok().map(system_time_to_millis).unwrap_or(-1);
    let modified = metadata.modified().ok().map(system_time_to_millis).unwrap_or(-1);
    let accessed = metadata.accessed().ok().map(system_time_to_millis).unwrap_or(-1);

    Ok(FileInfo {
        name,
        path: path.to_string(),
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        created,
        modified,
        accessed,
        read_only: metadata.permissions().readonly(),
        extension,
    })
}

/// Opens a file or folder with the system's default application.
/// Uses the native OS command to bypass plugin opener scope restrictions.
#[tauri::command]
pub fn open_file(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Opens a file with the default text editor (Notepad on Windows).
#[tauri::command]
pub fn edit_file(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("notepad")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'éditeur : {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Fallback: try to open with system default editor
        let _ = std::process::Command::new("notepad")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'éditeur : {}", e))?;
    }

    Ok(())
}
