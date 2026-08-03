use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::types::{app_config_dir, FileEntry, Space};

fn spaces_path() -> Result<std::path::PathBuf, String> {
    Ok(app_config_dir()?.join("spaces.json"))
}

fn load_spaces() -> Vec<Space> {
    let path = match spaces_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_spaces(spaces: &[Space]) -> Result<(), String> {
    let path = spaces_path()?;
    let json = serde_json::to_string_pretty(spaces).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

fn now_millis() -> i64 {
    UNIX_EPOCH
        .elapsed()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("space_{:x}", nanos)
}

/// Returns all saved spaces, sorted by creation order.
#[tauri::command]
pub fn list_spaces() -> Vec<Space> {
    load_spaces()
}

/// Creates a new space with the given name and icon.
#[tauri::command]
pub fn create_space(name: String, icon: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    let now = now_millis();
    spaces.push(Space {
        id: generate_id(),
        name,
        icon,
        folders: Vec::new(),
        created_at: now,
        updated_at: now,
    });
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Renames a space identified by its id.
#[tauri::command]
pub fn rename_space(id: String, name: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    if let Some(space) = spaces.iter_mut().find(|s| s.id == id) {
        space.name = name;
        space.updated_at = now_millis();
    }
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Deletes a space by its id.
#[tauri::command]
pub fn delete_space(id: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    spaces.retain(|s| s.id != id);
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Updates the order of all spaces (the provided list must contain all space ids in order).
#[tauri::command]
pub fn reorder_spaces(ids: Vec<String>) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    let mut ordered: Vec<Space> = Vec::with_capacity(ids.len());
    for id in &ids {
        if let Some(pos) = spaces.iter().position(|s| s.id == *id) {
            ordered.push(spaces.remove(pos));
        }
    }
    // Append any remaining spaces not in the ids list
    ordered.extend(spaces);
    save_spaces(&ordered)?;
    Ok(ordered)
}

/// Adds a folder to a space.
#[tauri::command]
pub fn add_folder_to_space(id: String, folder: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    if let Some(space) = spaces.iter_mut().find(|s| s.id == id) {
        // Normalize path and avoid duplicates
        let normalized = folder.trim_end_matches(&['\\', '/'][..]).to_string();
        if !space.folders.iter().any(|f| f.eq_ignore_ascii_case(&normalized)) {
            space.folders.push(normalized);
            space.updated_at = now_millis();
        }
    }
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Removes a folder from a space.
#[tauri::command]
pub fn remove_folder_from_space(id: String, folder: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    if let Some(space) = spaces.iter_mut().find(|s| s.id == id) {
        space.folders.retain(|f| !f.eq_ignore_ascii_case(&folder));
        space.updated_at = now_millis();
    }
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Updates the icon of a space.
#[tauri::command]
pub fn update_space_icon(id: String, icon: String) -> Result<Vec<Space>, String> {
    let mut spaces = load_spaces();
    if let Some(space) = spaces.iter_mut().find(|s| s.id == id) {
        space.icon = icon;
        space.updated_at = now_millis();
    }
    save_spaces(&spaces)?;
    Ok(spaces)
}

/// Lists the content of every folder registered in a space as a unified list.
/// Each entry preserves its original path for tracing the source folder.
#[tauri::command]
pub fn list_space_entries(id: String) -> Result<Vec<FileEntry>, String> {
    let spaces = load_spaces();
    let space = spaces
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Space '{}' not found", id))?;

    let mut entries = Vec::new();

    for folder_path in &space.folders {
        let dir = Path::new(folder_path);
        if !dir.is_dir() {
            continue;
        }
        let read_dir = match std::fs::read_dir(dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        for entry in read_dir.flatten() {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let file_entry = FileEntry::from_metadata(&entry.path(), &metadata);
            entries.push(file_entry);
        }
    }

    // Sort: directories first, then files, both by name
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}
