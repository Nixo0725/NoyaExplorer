use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use crate::types::{
    BiggestFile, BiggestFolder, CategoryStat, ExtensionStat, OldFileInfo, StorageInsights,
    StorageStats, system_time_to_millis,
};

/* ======================== Storage Stats (existing) ======================== */

/// Recursively scans a directory and aggregates storage usage by file category.
/// Subdirectory traversal is parallelised with Rayon.
#[tauri::command]
pub async fn storage_stats(path: &str) -> Result<StorageStats, String> {
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

fn accumulate_storage_parallel(path: &Path) -> StorageAccum {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return StorageAccum::new(),
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    entries
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
                let category = crate::types::categorize(&name).to_string();
                let entry = acc.index.entry(category).or_insert((0, 0));
                entry.0 += size;
                entry.1 += 1;
            }
            acc
        })
        .reduce(StorageAccum::new, |mut a, b| {
            a.merge(b);
            a
        })
}

/* ======================== Biggest Files ======================== */

/// Collects the N largest files in a directory (recursive).
/// Uses Rayon for parallel traversal and a partial sort for efficiency.
#[tauri::command]
pub async fn get_biggest_files(
    path: &str,
    limit: Option<usize>,
) -> Result<Vec<BiggestFile>, String> {
    let path = path.to_string();
    let limit = limit.unwrap_or(100);

    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        let root = Path::new(&path);

        if !root.is_dir() {
            return Err(format!("{} is not a directory", path));
        }

        // Collect all files with metadata in parallel
        let all_files: Vec<BiggestFile> = collect_files_parallel(root);
        let total_scanned = all_files.len();

        // Partial sort: keep only the N largest
        let mut sorted = all_files;
        sorted.par_sort_unstable_by(|a, b| b.size.cmp(&a.size));
        sorted.truncate(limit);

        eprintln!(
            "[profile] get_biggest_files({}) -> {} files scanned, top {} in {:?}",
            path,
            total_scanned,
            sorted.len(),
            start.elapsed()
        );

        Ok(sorted)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn collect_files_parallel(path: &Path) -> Vec<BiggestFile> {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return Vec::new(),
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    entries
        .par_iter()
        .fold(Vec::new, |mut acc, entry_path| {
            let metadata = match std::fs::metadata(entry_path) {
                Ok(m) => m,
                Err(_) => return acc,
            };

            if metadata.is_dir() {
                acc.extend(collect_files_parallel(entry_path));
            } else {
                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let category = crate::types::categorize(&name).to_string();
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(-1);

                acc.push(BiggestFile {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    size: metadata.len(),
                    category,
                    modified,
                });
            }
            acc
        })
        .reduce(Vec::new, |mut a, b| {
            a.extend(b);
            a
        })
}

/* ======================== Biggest Folders ======================== */

/// Collects the N largest folders in a directory (recursive analysis).
/// Returns folder name, path, total size, and file count.
#[tauri::command]
pub async fn get_biggest_folders(
    path: &str,
    limit: Option<usize>,
    max_depth: Option<usize>,
) -> Result<Vec<BiggestFolder>, String> {
    let path = path.to_string();
    let limit = limit.unwrap_or(100);
    let depth = max_depth.unwrap_or(12);

    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        let root = Path::new(&path);

        if !root.is_dir() {
            return Err(format!("{} is not a directory", path));
        }

        let mut folders = Vec::new();
        analyze_folders(root, depth, &mut folders);

        folders.par_sort_unstable_by(|a, b| b.total_size.cmp(&a.total_size));
        folders.truncate(limit);

        eprintln!(
            "[profile] get_biggest_folders({}) -> {} folders in {:?}",
            path,
            folders.len(),
            start.elapsed()
        );

        Ok(folders)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn analyze_folders(path: &Path, remaining_depth: usize, results: &mut Vec<BiggestFolder>) {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();
    let subdirs: Vec<PathBuf> = entries
        .par_iter()
        .filter_map(|p| {
            let meta = std::fs::metadata(p).ok()?;
            if meta.is_dir() {
                Some(p.clone())
            } else {
                None
            }
        })
        .collect();

    for subdir in &subdirs {
        let name = subdir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Compute total size and file count for this subdirectory
        let (total_size, file_count) = compute_folder_stats(subdir);

        results.push(BiggestFolder {
            name,
            path: subdir.to_string_lossy().to_string(),
            total_size,
            file_count,
        });

        // Recurse if depth allows
        if remaining_depth > 0 {
            analyze_folders(subdir, remaining_depth - 1, results);
        }
    }
}

/// Computes the total size and file count of a directory tree.
fn compute_folder_stats(path: &Path) -> (u64, u64) {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return (0, 0),
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    entries
        .par_iter()
        .map(|entry_path| {
            let metadata = match std::fs::metadata(entry_path) {
                Ok(m) => m,
                Err(_) => return (0u64, 0u64),
            };
            if metadata.is_dir() {
                compute_folder_stats(entry_path)
            } else {
                (metadata.len(), 1)
            }
        })
        .reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
}

/* ======================== Storage Insights ======================== */

/// Analyzes storage and returns:
/// - Largest file extensions (total size, count, percentage)
/// - Old files (not modified in a long time, abandoned downloads, unused archives)
#[tauri::command]
pub async fn get_storage_insights(
    path: &str,
    extension_limit: Option<usize>,
    old_files_limit: Option<usize>,
    old_threshold_days: Option<i64>,
) -> Result<StorageInsights, String> {
    let path = path.to_string();
    let ext_limit = extension_limit.unwrap_or(20);
    let old_limit = old_files_limit.unwrap_or(50);
    let threshold_days = old_threshold_days.unwrap_or(365);

    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        let root = Path::new(&path);

        if !root.is_dir() {
            return Err(format!("{} is not a directory", path));
        }

        let mut total_scanned: u64 = 0;
        let mut ext_map: std::collections::HashMap<String, (u64, u64)> =
            std::collections::HashMap::new();
        let mut old_files: Vec<OldFileInfo> = Vec::new();

        let now = std::time::SystemTime::now();
        let threshold_secs = threshold_days * 24 * 3600;
        let abandoned_threshold_secs: i64 = 90 * 24 * 3600;
        let archive_threshold_secs: i64 = 180 * 24 * 3600;

        collect_insights_parallel(root, &mut ext_map, &mut old_files, &mut total_scanned, now, threshold_secs, abandoned_threshold_secs, archive_threshold_secs);

        // Build extension stats
        let total_size: u64 = ext_map.values().map(|(s, _)| *s).sum();
        let mut largest_extensions: Vec<ExtensionStat> = ext_map
            .into_iter()
            .map(|(ext, (size, count))| ExtensionStat {
                extension: ext,
                total_size: size,
                file_count: count,
                percentage: if total_size > 0 {
                    (size as f64 / total_size as f64) * 100.0
                } else {
                    0.0
                },
            })
            .collect();

        largest_extensions.par_sort_unstable_by(|a, b| {
            b.total_size
                .cmp(&a.total_size)
                .then_with(|| b.file_count.cmp(&a.file_count))
        });
        largest_extensions.truncate(ext_limit);

        // Sort old files: most recently modified first among old files
        old_files.par_sort_unstable_by(|a, b| b.last_modified.cmp(&a.last_modified));
        old_files.truncate(old_limit);

        eprintln!(
            "[profile] get_storage_insights({}) -> {} files, {} extensions, {} old files in {:?}",
            path,
            total_scanned,
            largest_extensions.len(),
            old_files.len(),
            start.elapsed()
        );

        Ok(StorageInsights {
            largest_extensions,
            old_files,
            total_scanned,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Recursively collects extension stats and old file information.
#[allow(clippy::too_many_arguments)]
fn collect_insights_parallel(
    path: &Path,
    ext_map: &mut std::collections::HashMap<String, (u64, u64)>,
    old_files: &mut Vec<OldFileInfo>,
    total_scanned: &mut u64,
    now: std::time::SystemTime,
    threshold_secs: i64,
    abandoned_threshold_secs: i64,
    archive_threshold_secs: i64,
) {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    for entry_path in &entries {
        let metadata = match std::fs::metadata(entry_path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            collect_insights_parallel(
                entry_path,
                ext_map,
                old_files,
                total_scanned,
                now,
                threshold_secs,
                abandoned_threshold_secs,
                archive_threshold_secs,
            );
        } else {
            *total_scanned += 1;
            let name = entry_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let size = metadata.len();

            // Extension stats
            let ext = entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_else(|| "?".to_string());
            let entry = ext_map.entry(ext).or_insert((0, 0));
            entry.0 += size;
            entry.1 += 1;

            // Old file detection
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = now.duration_since(modified) {
                    let age_secs = duration.as_secs() as i64;

                    let is_old = age_secs > threshold_secs;
                    let is_abandoned_download = age_secs > abandoned_threshold_secs
                        && is_in_downloads(entry_path);
                    let is_unused_archive = age_secs > archive_threshold_secs
                        && is_archive(entry_path);

                    if is_old || is_abandoned_download || is_unused_archive {
                        let mut cat = String::from("old_file");
                        if is_abandoned_download {
                            cat = String::from("abandoned_download");
                        } else if is_unused_archive {
                            cat = String::from("unused_archive");
                        }

                        let last_modified = system_time_to_millis(modified);

                        old_files.push(OldFileInfo {
                            path: entry_path.to_string_lossy().to_string(),
                            name,
                            size,
                            last_modified,
                            category: cat,
                        });
                    }
                }
            }
        }
    }
}

/// Checks if a path is inside a Downloads directory (case-insensitive).
fn is_in_downloads(path: &Path) -> bool {
    let path_lower = path.to_string_lossy().to_lowercase();
    path_lower.contains("download") || path_lower.contains("téléchargement")
}

/// Checks if a file is an archive based on extension.
fn is_archive(path: &Path) -> bool {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    matches!(ext.as_str(), "zip" | "rar" | "7z" | "tar" | "gz")
}
