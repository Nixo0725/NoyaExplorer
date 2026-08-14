use crate::types::{DriveInfo, SpecialDir};

/// Returns the user's home directory path.
#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Impossible de trouver le dossier utilisateur".to_string())
}

/// Returns well-known user folders (Desktop, Documents, Downloads).
/// Missing folders are silently skipped.
#[tauri::command]
pub fn special_dirs() -> Vec<SpecialDir> {
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

/// Lists available logical drives on Windows (e.g. C:\, D:\).
/// On non-Windows platforms, returns the root "/".
#[tauri::command]
pub fn list_drives() -> Vec<DriveInfo> {
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

