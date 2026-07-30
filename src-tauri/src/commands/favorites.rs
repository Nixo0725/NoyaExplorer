use std::time::UNIX_EPOCH;

use crate::types::{app_config_dir, AccessRecord, FavoriteItem};

fn favorites_path() -> Result<std::path::PathBuf, String> {
    Ok(app_config_dir()?.join("favorites.json"))
}

fn history_path() -> Result<std::path::PathBuf, String> {
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
pub fn list_favorites() -> Vec<FavoriteItem> {
    let mut favs = load_favorites();
    favs.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    favs
}

/// Pins a file or folder to the favorites. No-op if already present.
#[tauri::command]
pub fn add_favorite(path: String, name: String, is_dir: bool) -> Result<Vec<FavoriteItem>, String> {
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
pub fn remove_favorite(path: String) -> Result<Vec<FavoriteItem>, String> {
    let mut favs = load_favorites();
    favs.retain(|f| !f.path.eq_ignore_ascii_case(&path));
    save_favorites(&favs)?;
    favs.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    Ok(favs)
}

/// Records (or increments) an access to a file/folder for frequency tracking.
#[tauri::command]
pub fn record_access(
    path: String,
    name: String,
    is_dir: bool,
    modified: i64,
) -> Result<(), String> {
    let mut history = load_history();
    let now = UNIX_EPOCH
        .elapsed()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    if let Some(record) = history
        .iter_mut()
        .find(|r| r.path.eq_ignore_ascii_case(&path))
    {
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
pub fn get_most_used(limit: Option<usize>) -> Vec<AccessRecord> {
    let limit = limit.unwrap_or(4);
    let mut history = load_history();
    history.sort_by(|a, b| b.access_count.cmp(&a.access_count));
    history.truncate(limit);
    history
}

/// Returns the `limit` most recently accessed items (descending by last_accessed).
#[tauri::command]
pub fn get_recent_files(limit: Option<usize>) -> Vec<AccessRecord> {
    let limit = limit.unwrap_or(20);
    let mut history = load_history();
    history.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
    history.truncate(limit);
    history
}
