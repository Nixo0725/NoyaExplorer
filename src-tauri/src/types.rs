use std::path::PathBuf;
use std::time::UNIX_EPOCH;

/* ---------- File listing ---------- */

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

impl FileEntry {
    pub fn from_metadata(path: &std::path::Path, metadata: &std::fs::Metadata) -> Self {
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

        FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        }
    }
}

/* ---------- File info ---------- */

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

/* ---------- Search ---------- */

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

#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub extensions: Option<Vec<String>>,
    pub category: Option<String>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub modified_before: Option<i64>,
    pub modified_after: Option<i64>,
    pub created_before: Option<i64>,
    pub created_after: Option<i64>,
    pub location: Option<String>,
    pub recent_only: Option<bool>,
    pub old_only: Option<bool>,
    pub large_only: Option<bool>,
    pub unused_only: Option<bool>,
}

/* ---------- Storage ---------- */

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStat {
    pub category: String,
    pub size: u64,
    pub count: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub total_size: u64,
    pub file_count: u64,
    pub by_category: Vec<CategoryStat>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiggestFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub category: String,
    pub modified: i64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiggestFolder {
    pub name: String,
    pub path: String,
    pub total_size: u64,
    pub file_count: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionStat {
    pub extension: String,
    pub total_size: u64,
    pub file_count: u64,
    pub percentage: f64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OldFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub last_modified: i64,
    pub category: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInsights {
    pub largest_extensions: Vec<ExtensionStat>,
    pub old_files: Vec<OldFileInfo>,
    pub total_scanned: u64,
}

/* ---------- Suspicious files ---------- */

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: i64,
    pub reasons: Vec<String>,
}

/* ---------- Global analysis (cache) ---------- */

/// Résultat agrégé de l'analyse globale du stockage, persisté en cache.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalAnalysis {
    /// Racine scannée (dossier personnel par défaut).
    pub root: String,
    /// Horodatage (ms) du dernier scan complet.
    pub scanned_at: i64,
    pub stats: StorageStats,
    pub insights: StorageInsights,
    pub biggest_files: Vec<BiggestFile>,
    pub biggest_folders: Vec<BiggestFolder>,
    pub suspicious: Vec<SuspiciousFile>,
}

/* ---------- Favorites & access history ---------- */

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

/* ---------- System ---------- */

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecialDir {
    pub label: String,
    pub path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub letter: String,
    pub path: String,
    pub label: String,
}

/* ---------- Helpers ---------- */

/// Returns the application config directory (`<config>/noya-explorer`), creating it if needed.
pub fn app_config_dir() -> Result<PathBuf, String> {
    let config = dirs::config_dir()
        .ok_or_else(|| "Impossible de trouver le dossier de configuration".to_string())?;
    let app_dir = config.join("noya-explorer");
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir)
}

/// Helper: `to_millis` for SystemTime conversion.
pub fn system_time_to_millis(t: std::time::SystemTime) -> i64 {
    t.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(-1)
}

/// Maps a file name to a category string, mirroring the frontend `fileType.ts` logic.
pub fn categorize(name: &str) -> &'static str {
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
        "exe" | "msi" => "executable",
        "sh" | "bat" | "ps1" | "cmd" => "script",
        _ => "other",
    }
}
