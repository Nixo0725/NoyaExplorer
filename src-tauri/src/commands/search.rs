use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::{SearchFilters, SearchResult};

const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "md", "rs", "ts", "tsx", "js", "jsx", "json", "toml", "yaml", "yml", "css", "html",
    "htm", "xml", "csv", "ini", "cfg", "log", "sh", "bat", "ps1", "py", "java", "c", "cpp", "h",
    "hpp", "rb", "php", "sql", "swift", "kt",
];

/// Filters a file entry based on the provided search filters.
fn matches_filters(
    path: &Path,
    name: &str,
    is_dir: bool,
    metadata: &std::fs::Metadata,
    filters: &SearchFilters,
) -> bool {
    // Extension filter
    if let Some(ref exts) = filters.extensions {
        if !is_dir {
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if !exts.iter().any(|e| e.eq_ignore_ascii_case(&ext)) {
                return false;
            }
        }
    }

    // Category filter
    if let Some(ref cat) = filters.category {
        if !is_dir {
            let file_cat = crate::types::categorize(name);
            if file_cat != cat.as_str() {
                return false;
            }
        }
    }

    // Size filters
    if let (Some(min), Some(max)) = (filters.min_size, filters.max_size) {
        if !is_dir {
            let len = metadata.len();
            if len < min || len > max {
                return false;
            }
        }
    } else if let Some(min) = filters.min_size {
        if !is_dir && metadata.len() < min {
            return false;
        }
    } else if let Some(max) = filters.max_size {
        if !is_dir && metadata.len() > max {
            return false;
        }
    }

    // Time filters
    if let Ok(modified) = metadata.modified() {
        let mod_ms = modified
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        if let Some(before) = filters.modified_before {
            if mod_ms > before {
                return false;
            }
        }
        if let Some(after) = filters.modified_after {
            if mod_ms < after {
                return false;
            }
        }

        if let Some(before) = filters.created_before {
            if let Ok(created) = metadata.created() {
                let created_ms = created
                    .duration_since(UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                if created_ms > before {
                    return false;
                }
            }
        }
        if let Some(after) = filters.created_after {
            if let Ok(created) = metadata.created() {
                let created_ms = created
                    .duration_since(UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                if created_ms < after {
                    return false;
                }
            }
        }
    }

    // Recent files: modified within the last 7 days
    if filters.recent_only.unwrap_or(false) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = SystemTime::now().duration_since(modified) {
                if duration.as_secs() > 7 * 24 * 3600 {
                    return false;
                }
            }
        } else {
            return false;
        }
    }

    // Old files: not modified for 365 days
    if filters.old_only.unwrap_or(false) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = SystemTime::now().duration_since(modified) {
                if duration.as_secs() < 365 * 24 * 3600 {
                    return false;
                }
            }
        } else {
            return false;
        }
    }

    // Large files: > 100 MB
    if filters.large_only.unwrap_or(false) {
        if !is_dir && metadata.len() < 100 * 1024 * 1024 {
            return false;
        }
    }

    true
}

/// Basic search by file name and optional content search.
/// Kept for backward compatibility.
#[tauri::command]
pub async fn search_files(
    root_path: &str,
    query: &str,
    search_content: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(100);
    let query_lower = query.to_lowercase();
    let root_path = root_path.to_string();

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
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'));

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
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if TEXT_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
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
                            let preview =
                                lines.into_iter().take(3).collect::<Vec<_>>().join("\n");
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

/// Advanced search with combinable filters.
#[tauri::command]
pub async fn search_files_advanced(
    root_path: &str,
    query: &str,
    filters: SearchFilters,
    search_content: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(200);
    let query_lower = query.to_lowercase();
    let root_path = root_path.to_string();

    let results = tokio::task::spawn_blocking(move || {
        let mut results = Vec::new();
        let root = std::path::Path::new(&root_path);

        if !root.is_dir() {
            return Err(format!("Le chemin n'est pas un dossier : {}", root_path));
        }

        // Determine the base search path (location filter)
        let base_path: &Path = match filters.location.as_ref() {
            Some(loc) => Path::new(loc),
            None => root,
        };

        let walker = walkdir::WalkDir::new(base_path)
            .max_depth(10)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'));

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

            // Apply filters
            let metadata = match std::fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };

            if !matches_filters(&path, &name, is_dir, &metadata, &filters) {
                continue;
            }

            let name_lower = name.to_lowercase();
            let name_score = if query_lower.is_empty() {
                // No query -> all filtered results get a base score
                1
            } else if name_lower == query_lower {
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

            if search_content && !is_dir && name_score == 0 && !query_lower.is_empty() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if TEXT_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
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
                            let preview =
                                lines.into_iter().take(3).collect::<Vec<_>>().join("\n");
                            context = Some(format!("{}{}{}", snippet, preview, snippet_end));
                        }
                    }
                }
            }

            let total_score = name_score + content_score;
            if total_score > 0 || query_lower.is_empty() {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    name,
                    is_dir,
                    context,
                    score: if query_lower.is_empty() {
                        // When no query, sort by path length as a proxy for relevance
                        -(path.to_string_lossy().len() as i32)
                    } else {
                        total_score
                    },
                });
            }
        }

        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(max);

        Ok(results)
    })
    .await
    .map_err(|e| format!("Erreur interne de la recherche avancée : {}", e))?;

    results
}
