use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};

use rayon::prelude::*;

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
///
/// On Windows, `read_dir` already caches file metadata in the `DirEntry`, so we
/// extract it directly without issuing a second `stat` syscall per entry. The
/// remaining work (string conversion, time normalisation, sorting) is parallelised
/// with Rayon for directories containing many entries.
#[tauri::command]
fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
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
        .filter_map(|(path, metadata)| {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(-1);

            Some(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
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
async fn folder_size(path: &str, max_depth: Option<usize>) -> Result<u64, String> {
    let path = path.to_string();
    let depth = max_depth.unwrap_or(12);
    tokio::task::spawn_blocking(move || compute_dir_size(Path::new(&path), depth))
        .await
        .map_err(|e| e.to_string())
}

/// Recursively computes the total size of a directory using Rayon to parallelise
/// subdirectory traversal across available CPU cores. `remaining_depth` limits
/// how deep the recursion goes to avoid pathological cases.
fn compute_dir_size(path: &Path, remaining_depth: usize) -> u64 {
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
/// Subdirectory traversal is parallelised with Rayon.
#[tauri::command]
async fn storage_stats(path: &str) -> Result<StorageStats, String> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || compute_storage_stats(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn compute_storage_stats(path: &str) -> Result<StorageStats, String> {
    let start = Instant::now();
    let root = Path::new(path);
    if !root.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    // Each parallel branch accumulates into its own local result, then we merge.
    let local = accumulate_storage_parallel(root);

    let mut stats = StorageStats {
        total_size: local.total_size,
        file_count: local.file_count,
        by_category: Vec::new(),
    };

    stats.by_category = local
        .index
        .into_iter()
        .map(|(category, (size, count))| CategoryStat {
            category,
            size,
            count,
        })
        .collect();

    stats.by_category.sort_by(|a, b| b.size.cmp(&a.size));

    eprintln!(
        "[profile] storage_stats({}) -> {} files, {} categories in {:?}",
        path,
        stats.file_count,
        stats.by_category.len(),
        start.elapsed()
    );

    Ok(stats)
}

/// Local accumulator for parallel storage traversal.
struct StorageAccum {
    total_size: u64,
    file_count: u64,
    index: std::collections::HashMap<String, (u64, u64)>,
}

impl StorageAccum {
    fn new() -> Self {
        Self {
            total_size: 0,
            file_count: 0,
            index: std::collections::HashMap::new(),
        }
    }

    /// Merge another accumulator into this one.
    fn merge(&mut self, other: StorageAccum) {
        self.total_size += other.total_size;
        self.file_count += other.file_count;
        for (cat, (size, count)) in other.index {
            let entry = self.index.entry(cat).or_insert((0, 0));
            entry.0 += size;
            entry.1 += count;
        }
    }
}

/// Parallel recursive storage accumulation using Rayon.
fn accumulate_storage_parallel(path: &Path) -> StorageAccum {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return StorageAccum::new(),
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    let accum = entries
        .par_iter()
        .fold(StorageAccum::new, |mut acc, entry_path| {
            let metadata = match std::fs::metadata(entry_path) {
                Ok(m) => m,
                Err(_) => return acc,
            };
            if metadata.is_dir() {
                acc.merge(accumulate_storage_parallel(entry_path));
            } else {
                let size = metadata.len();
                acc.total_size += size;
                acc.file_count += 1;
                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let category = categorize(&name).to_string();
                let entry = acc.index.entry(category).or_insert((0, 0));
                entry.0 += size;
                entry.1 += 1;
            }
            acc
        })
        .reduce(StorageAccum::new, |mut a, b| {
            a.merge(b);
            a
        });

    accum
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    /// Extrait du contenu où le match a été trouvé (uniquement pour la recherche par contenu)
    pub context: Option<String>,
    /// Score de pertinence (basé sur le nom + contenu)
    pub score: i32,
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

/// Opens a file with the default text editor (Notepad on Windows).
#[tauri::command]
fn edit_file(path: &str) -> Result<(), String> {
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
        let status = std::process::Command::new("notepad")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'éditeur : {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn search_files(
    root_path: &str,
    query: &str,
    search_content: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(100);
    let query_lower = query.to_lowercase();
    let root_path = root_path.to_string();

    // Lancer le travail lourd (walkdir + lectures fichier) sur un thread dédié
    // pour ne pas bloquer le thread principal de Tauri
    let results = tokio::task::spawn_blocking(move || {
        let mut results = Vec::new();
        let root = std::path::Path::new(&root_path);

        if !root.is_dir() {
            return Err(format!("Le chemin n'est pas un dossier : {}", root_path));
        }

        let walker = walkdir::WalkDir::new(root)
            .max_depth(10)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                !e.file_name().to_string_lossy().starts_with('.')
            });

        for entry in walker {
            if results.len() >= max {
                break;
            }
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path().to_path_buf();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().is_dir();

            let name_lower = name.to_lowercase();
            let name_score = if name_lower == query_lower {
                100
            } else if name_lower.starts_with(&query_lower) {
                80
            } else if name_lower.contains(&query_lower) {
                50
            } else {
                0
            };

            let mut context: Option<String> = None;
            let mut content_score = 0;

            if search_content && !is_dir && name_score == 0 {
                let text_extensions = [
                    "txt", "md", "rs", "ts", "tsx", "js", "jsx", "json", "toml", "yaml", "yml",
                    "css", "html", "htm", "xml", "csv", "ini", "cfg", "log", "sh", "bat", "ps1",
                    "py", "java", "c", "cpp", "h", "hpp", "rb", "php", "sql", "swift", "kt",
                ];
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if text_extensions.contains(&ext.to_lowercase().as_str()) {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        let content_lower = content.to_lowercase();
                        if let Some(pos) = content_lower.find(&query_lower) {
                            content_score = 30;
                            let start = pos.saturating_sub(40);
                            let end = std::cmp::min(pos + query_lower.len() + 40, content.len());
                            let snippet = if start > 0 { "…" } else { "" };
                            let snippet_end = if end < content.len() { "…" } else { "" };
                            let extract = &content[start..end];
                            let lines: Vec<&str> = extract.lines().collect();
                            let preview = lines.into_iter().take(3).collect::<Vec<_>>().join("\n");
                            context = Some(format!("{}{}{}", snippet, preview, snippet_end));
                        }
                    }
                }
            }

            let total_score = name_score + content_score;
            if total_score > 0 {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    name,
                    is_dir,
                    context,
                    score: total_score,
                });
            }
        }

        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(max);

        Ok(results)
    })
    .await
    .map_err(|e| format!("Erreur interne de la recherche : {}", e))?;

    results
}

/* ---------- Favorites & access history (persistent) ---------- */

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteItem {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub added_at: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccessRecord {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub access_count: u64,
    pub last_accessed: i64,
    pub modified: i64,
}

/// Returns the application config directory (`<config>/noya-explorer`), creating it if needed.
fn app_config_dir() -> Result<PathBuf, String> {
    let config = dirs::config_dir()
        .ok_or_else(|| "Impossible de trouver le dossier de configuration".to_string())?;
    let app_dir = config.join("noya-explorer");
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir)
}

fn favorites_path() -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join("favorites.json"))
}

fn history_path() -> Result<PathBuf, String> {
    Ok(app_config_dir()?.join("access_history.json"))
}

fn load_favorites() -> Vec<FavoriteItem> {
    let path = match favorites_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_favorites(favorites: &[FavoriteItem]) -> Result<(), String> {
    let path = favorites_path()?;
    let json = serde_json::to_string_pretty(favorites).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

fn load_history() -> Vec<AccessRecord> {
    let path = match history_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_history(history: &[AccessRecord]) -> Result<(), String> {
    let path = history_path()?;
    let json = serde_json::to_string_pretty(history).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// Returns all pinned favorites, sorted by most recently added.
#[tauri::command]
fn list_favorites() -> Vec<FavoriteItem> {
    let mut favs = load_favorites();
    favs.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    favs
}

/// Pins a file or folder to the favorites. No-op if already present.
#[tauri::command]
fn add_favorite(path: String, name: String, is_dir: bool) -> Result<Vec<FavoriteItem>, String> {
    let mut favs = load_favorites();
    if favs.iter().any(|f| f.path.eq_ignore_ascii_case(&path)) {
        return Ok(favs);
    }
    let now = UNIX_EPOCH
        .elapsed()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    favs.push(FavoriteItem {
        path,
        name,
        is_dir,
        added_at: now,
    });
    save_favorites(&favs)?;
    favs.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    Ok(favs)
}

/// Removes a favorite by path (case-insensitive).
#[tauri::command]
fn remove_favorite(path: String) -> Result<Vec<FavoriteItem>, String> {
    let mut favs = load_favorites();
    favs.retain(|f| !f.path.eq_ignore_ascii_case(&path));
    save_favorites(&favs)?;
    favs.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    Ok(favs)
}

/// Records (or increments) an access to a file/folder for frequency tracking.
#[tauri::command]
fn record_access(path: String, name: String, is_dir: bool, modified: i64) -> Result<(), String> {
    let mut history = load_history();
    let now = UNIX_EPOCH
        .elapsed()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    if let Some(record) = history.iter_mut().find(|r| r.path.eq_ignore_ascii_case(&path)) {
        record.access_count += 1;
        record.last_accessed = now;
        record.name = name;
        record.is_dir = is_dir;
        record.modified = modified;
    } else {
        history.push(AccessRecord {
            path,
            name,
            is_dir,
            access_count: 1,
            last_accessed: now,
            modified,
        });
    }

    // Cap history to 500 entries (evict oldest by last_accessed).
    if history.len() > 500 {
        history.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
        history.truncate(500);
    }

    save_history(&history)
}

/// Returns the `limit` most frequently accessed items (descending by access_count).
#[tauri::command]
fn get_most_used(limit: Option<usize>) -> Vec<AccessRecord> {
    let limit = limit.unwrap_or(4);
    let mut history = load_history();
    history.sort_by(|a, b| b.access_count.cmp(&a.access_count));
    history.truncate(limit);
    history
}

/// Returns the `limit` most recently accessed items (descending by last_accessed).
#[tauri::command]
fn get_recent_files(limit: Option<usize>) -> Vec<AccessRecord> {
    let limit = limit.unwrap_or(20);
    let mut history = load_history();
    history.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
    history.truncate(limit);
    history
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
            edit_file,
            search_files,
            create_file,
            create_dir,
            rename_entry,
            delete_entry,
            copy_entry,
            move_entry,
            get_file_info,
            list_favorites,
            add_favorite,
            remove_favorite,
            record_access,
            get_most_used,
            get_recent_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
