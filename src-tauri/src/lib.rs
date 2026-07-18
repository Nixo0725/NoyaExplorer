use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// Modification time in milliseconds since the Unix epoch.
    /// -1 when the value is not available.
    pub modified: i64,
}

/// Lists the direct children of a directory.
/// Directories are returned first, then files, both sorted case-insensitively by name.
#[tauri::command]
fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
    let read_dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut entries: Vec<FileEntry> = read_dir
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(-1);

            Some(FileEntry {
                name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                modified,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Recursively computes the total size of a directory (sum of all file sizes).
#[tauri::command]
async fn folder_size(path: &str) -> Result<u64, String> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || compute_dir_size(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())
}

fn compute_dir_size(path: &Path) -> u64 {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return 0,
    };

    let mut total = 0u64;
    for entry in read_dir.flatten() {
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            total += compute_dir_size(&entry.path());
        } else {
            total += metadata.len();
        }
    }
    total
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStat {
    pub category: String,
    pub size: u64,
    pub count: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub total_size: u64,
    pub file_count: u64,
    pub by_category: Vec<CategoryStat>,
}

/// Recursively scans a directory and aggregates storage usage by file category.
#[tauri::command]
async fn storage_stats(path: &str) -> Result<StorageStats, String> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || compute_storage_stats(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn compute_storage_stats(path: &str) -> Result<StorageStats, String> {
    let root = Path::new(path);
    if !root.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    let mut stats = StorageStats {
        total_size: 0,
        file_count: 0,
        by_category: Vec::new(),
    };

    let mut index: std::collections::HashMap<String, (u64, u64)> =
        std::collections::HashMap::new();

    accumulate_storage(root, &mut stats.total_size, &mut stats.file_count, &mut index);

    stats.by_category = index
        .into_iter()
        .map(|(category, (size, count))| CategoryStat {
            category,
            size,
            count,
        })
        .collect();

    stats.by_category.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(stats)
}

fn accumulate_storage(
    path: &Path,
    total_size: &mut u64,
    file_count: &mut u64,
    index: &mut std::collections::HashMap<String, (u64, u64)>,
) {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            accumulate_storage(&entry.path(), total_size, file_count, index);
        } else {
            let size = metadata.len();
            *total_size += size;
            *file_count += 1;

            let name = entry.file_name().to_string_lossy().to_string();
            let category = categorize(&name).to_string();
            let entry = index.entry(category).or_insert((0, 0));
            entry.0 += size;
            entry.1 += 1;
        }
    }
}

/// Maps a file name to a category string, mirroring the frontend `fileType.ts` logic.
fn categorize(name: &str) -> &'static str {
    let dot_index = match name.rfind('.') {
        Some(i) if i > 0 => i,
        _ => return "other",
    };

    let ext = &name[dot_index + 1..].to_lowercase();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" => "image",
        "mp4" | "mkv" | "mov" | "avi" | "webm" => "video",
        "mp3" | "wav" | "flac" | "ogg" => "audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" => "document",
        "zip" | "rar" | "7z" | "tar" | "gz" => "archive",
        "js" | "ts" | "tsx" | "jsx" | "rs" | "py" | "json" | "html" | "css" => "code",
        "exe" | "msi" | "bat" | "sh" => "executable",
        _ => "other",
    }
}

/// Returns the user's home directory path.
#[tauri::command]
fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Impossible de trouver le dossier utilisateur".to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecialDir {
    pub label: String,
    pub path: String,
}

/// Returns well-known user folders (Desktop, Documents, Downloads).
/// Missing folders are silently skipped.
#[tauri::command]
fn special_dirs() -> Vec<SpecialDir> {
    let mut result = Vec::new();

    if let Some(p) = dirs::desktop_dir() {
        result.push(SpecialDir {
            label: "Bureau".to_string(),
            path: p.to_string_lossy().to_string(),
        });
    }
    if let Some(p) = dirs::document_dir() {
        result.push(SpecialDir {
            label: "Documents".to_string(),
            path: p.to_string_lossy().to_string(),
        });
    }
    if let Some(p) = dirs::download_dir() {
        result.push(SpecialDir {
            label: "Téléchargements".to_string(),
            path: p.to_string_lossy().to_string(),
        });
    }

    result
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub letter: String,
    pub path: String,
    pub label: String,
}

/// Lists available logical drives on Windows (e.g. C:\, D:\).
/// On non-Windows platforms, returns the root "/".
#[tauri::command]
fn list_drives() -> Vec<DriveInfo> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        let mut buffer = [0u16; 256];
        let len = unsafe {
            windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
                buffer.len() as u32,
                buffer.as_mut_ptr(),
            )
        };

        if len == 0 {
            return Vec::new();
        }

        let raw = OsString::from_wide(&buffer[..len as usize]);
        let raw = raw.to_string_lossy().to_string();

        raw.split('\0')
            .filter(|s| !s.is_empty())
            .map(|drive| {
                let letter = drive.chars().next().unwrap_or('?').to_string();
                DriveInfo {
                    letter: letter.clone(),
                    path: drive.to_string(),
                    label: format!("Disque local ({})", letter),
                }
            })
            .collect()
    }

    #[cfg(not(target_os = "windows"))]
    {
        vec![DriveInfo {
            letter: "/".to_string(),
            path: "/".to_string(),
            label: "Racine".to_string(),
        }]
    }
}

/* ---------- File management commands ---------- */

/// Creates an empty file at the given path.
#[tauri::command]
fn create_file(path: &str) -> Result<(), String> {
    std::fs::File::create(path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Creates a directory at the given path (recursive, like `mkdir -p`).
#[tauri::command]
fn create_dir(path: &str) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Renames or moves a file/directory from old_path to new_path.
#[tauri::command]
fn rename_entry(old_path: &str, new_path: &str) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Deletes a file or directory (recursive for directories).
#[tauri::command]
async fn delete_entry(path: &str) -> Result<(), String> {
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
async fn copy_entry(src: &str, dst: &str) -> Result<(), String> {
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
async fn move_entry(src: &str, dst: &str) -> Result<(), String> {
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub created: i64,
    pub modified: i64,
    pub accessed: i64,
    pub read_only: bool,
    pub extension: String,
}

/// Returns detailed metadata about a file or directory.
#[tauri::command]
fn get_file_info(path: &str) -> Result<FileInfo, String> {
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

    let to_millis = |t: std::time::SystemTime| -> i64 {
        t.duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as i64)
            .unwrap_or(-1)
    };

    let created = metadata.created().ok().map(to_millis).unwrap_or(-1);
    let modified = metadata.modified().ok().map(to_millis).unwrap_or(-1);
    let accessed = metadata.accessed().ok().map(to_millis).unwrap_or(-1);

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
fn open_file(path: &str) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_dir,
            folder_size,
            storage_stats,
            home_dir,
            special_dirs,
            list_drives,
            open_file,
            create_file,
            create_dir,
            rename_entry,
            delete_entry,
            copy_entry,
            move_entry,
            get_file_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
