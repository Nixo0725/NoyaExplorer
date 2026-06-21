// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

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
fn folder_size(path: &str) -> Result<u64, String> {
    Ok(compute_dir_size(Path::new(path)))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_dir,
            folder_size,
            home_dir,
            special_dirs,
            list_drives
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
