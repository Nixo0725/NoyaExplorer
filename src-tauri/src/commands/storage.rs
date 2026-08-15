use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use crate::types::{CategoryStat, StorageStats};

/* ======================== Storage Stats ======================== */

/// Recursively scans a directory and aggregates storage usage by file category.
/// Subdirectory traversal is parallelised with Rayon.
#[tauri::command]
pub async fn storage_stats(path: &str) -> Result<StorageStats, String> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || compute_storage_stats(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn compute_storage_stats(path: &str) -> Result<StorageStats, String> {
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
            // symlink_metadata : ne suit pas les symlinks (évite les boucles)
            let metadata = match std::fs::symlink_metadata(entry_path) {
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

/// Checks if a path is inside a Downloads directory (case-insensitive).
pub(crate) fn is_in_downloads(path: &Path) -> bool {
    let path_lower = path.to_string_lossy().to_lowercase();
    path_lower.contains("download") || path_lower.contains("téléchargement")
}
