// Analyse globale du stockage avec cache persistant.
//
// Au premier démarrage, le frontend déclenche `analyze_global` (scan complet
// du dossier personnel). Le résultat est écrit dans un cache JSON sous le
// dossier de configuration, puis relu via `get_cached_analysis` aux
// démarrages suivants. Une resynchronisation périodique relance un scan
// complet pour rafraîchir le cache.
//
// Performance : une SEULE passe récursive parallèle (Rayon) collecte à la
// fois les stats par catégorie, les extensions, les fichiers anciens, les
// plus gros fichiers, les plus gros dossiers (tailles calculées en O(N)
// par cumul récursif) et les fichiers suspects. Évite le O(N²) d'un
// recalcul de la taille de chaque sous-arbre.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use crate::commands::suspicious::inspect_file;
use crate::types::{
    BiggestFile, BiggestFolder, CategoryStat, ExtensionStat, GlobalAnalysis, OldFileInfo,
    StorageInsights, StorageStats, app_config_dir, categorize, system_time_to_millis,
};

/// Nom du fichier cache dans le dossier de configuration.
const CACHE_FILE: &str = "analysis-cache.json";

/// Limites par défaut pour l'analyse globale.
const BIGGEST_FILES_LIMIT: usize = 100;
const BIGGEST_FOLDERS_LIMIT: usize = 100;
const SUSPICIOUS_LIMIT: usize = 100;
const EXTENSION_LIMIT: usize = 20;
const OLD_FILES_LIMIT: usize = 50;
const FOLDER_DEPTH: usize = 12;
/// Profondeur maximale absolue (filet de sécurité contre les cycles symlink).
const MAX_DEPTH: usize = 64;

/// Seuils d'âge pour la détection des fichiers anciens (en secondes).
const OLD_THRESHOLD_SECS: i64 = 365 * 24 * 3600;
const ABANDONED_THRESHOLD_SECS: i64 = 90 * 24 * 3600;
const ARCHIVE_THRESHOLD_SECS: i64 = 180 * 24 * 3600;

/// Racine du scan global : le dossier personnel, sinon la racine du système.
fn global_root() -> String {
    if let Some(home) = dirs::home_dir() {
        return home.to_string_lossy().to_string();
    }
    // Fallback : racine POSIX ou premier lecteur Windows
    if cfg!(target_os = "windows") {
        "C:\\".to_string()
    } else {
        "/".to_string()
    }
}

/// Chemin complet du fichier cache.
fn cache_path() -> Result<std::path::PathBuf, String> {
    Ok(app_config_dir()?.join(CACHE_FILE))
}

/// Vérifie si le fichier est une archive (pour la catégorie "archive inutilisée").
fn is_archive(path: &Path) -> bool {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    matches!(ext.as_str(), "zip" | "rar" | "7z" | "tar" | "gz")
}

/// Vérifie si un chemin est dans un dossier Téléchargements (insensible à la casse).
fn is_in_downloads(path: &Path) -> bool {
    let path_lower = path.to_string_lossy().to_lowercase();
    path_lower.contains("download") || path_lower.contains("téléchargement")
}

/* ---------- Accumulateur du scan global ---------- */

#[derive(Default)]
struct GlobalScan {
    total_size: u64,
    file_count: u64,
    /// Catégorie -> (taille, nombre)
    categories: HashMap<String, (u64, u64)>,
    /// Extension -> (taille, nombre)
    extensions: HashMap<String, (u64, u64)>,
    old_files: Vec<OldFileInfo>,
    biggest_files: Vec<BiggestFile>,
    /// Les dossiers rencontrés à profondeur < FOLDER_DEPTH, avec leur taille cumulée.
    folders: Vec<BiggestFolder>,
    suspicious: Vec<crate::types::SuspiciousFile>,
}

impl GlobalScan {
    fn merge(&mut self, other: GlobalScan) {
        self.total_size += other.total_size;
        self.file_count += other.file_count;
        for (cat, (size, count)) in other.categories {
            let e = self.categories.entry(cat).or_insert((0, 0));
            e.0 += size;
            e.1 += count;
        }
        for (ext, (size, count)) in other.extensions {
            let e = self.extensions.entry(ext).or_insert((0, 0));
            e.0 += size;
            e.1 += count;
        }
        self.old_files.extend(other.old_files);
        self.biggest_files.extend(other.biggest_files);
        self.folders.extend(other.folders);
        self.suspicious.extend(other.suspicious);
    }
}

/// Parcours récursif parallèle : accumule toutes les métriques en une passe.
/// Renvoie le scan du sous-arbre (y compris le dossier racine lui-même).
fn scan_global(path: &Path, depth: usize, now: std::time::SystemTime) -> GlobalScan {
    let read_dir = match std::fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => return GlobalScan::default(),
    };

    let entries: Vec<PathBuf> = read_dir.flatten().map(|e| e.path()).collect();

    let scan = entries
        .par_iter()
        .fold(GlobalScan::default, |mut acc, entry_path| {
            // symlink_metadata (au lieu de metadata) : ne suit pas les liens
            // symboliques, ce qui évite de boucler sur des symlinks circulaires
            // (ex. ~/.nix-defexpr/channels_root) et de rescaner indéfiniment
            // les mêmes sous-arbres.
            let metadata = match std::fs::symlink_metadata(entry_path) {
                Ok(m) => m,
                Err(_) => return acc,
            };

            if metadata.is_dir() {
                // Ne pas descendre au-delà de la profondeur de sécurité
                if depth >= MAX_DEPTH {
                    return acc;
                }
                let child = scan_global(entry_path, depth + 1, now);
                // Le dossier courant est candidat "plus gros dossier" (hors racine)
                if depth > 0 && depth <= FOLDER_DEPTH {
                    let name = entry_path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    acc.folders.push(BiggestFolder {
                        name,
                        path: entry_path.to_string_lossy().to_string(),
                        total_size: child.total_size,
                        file_count: child.file_count,
                    });
                }
                acc.merge(child);
            } else {
                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let size = metadata.len();
                acc.total_size += size;
                acc.file_count += 1;

                // Répartition par catégorie
                let category = categorize(&name).to_string();
                let e = acc.categories.entry(category.clone()).or_insert((0, 0));
                e.0 += size;
                e.1 += 1;

                // Répartition par extension
                let ext = entry_path
                    .extension()
                    .map(|x| x.to_string_lossy().to_lowercase())
                    .unwrap_or_else(|| "?".to_string());
                let e = acc.extensions.entry(ext).or_insert((0, 0));
                e.0 += size;
                e.1 += 1;

                // Fichiers anciens / téléchargements abandonnés / archives inutilisées
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = now.duration_since(modified) {
                        let age_secs = duration.as_secs() as i64;
                        let is_old = age_secs > OLD_THRESHOLD_SECS;
                        let is_abandoned = age_secs > ABANDONED_THRESHOLD_SECS
                            && is_in_downloads(entry_path);
                        let is_unused_archive = age_secs > ARCHIVE_THRESHOLD_SECS
                            && is_archive(entry_path);

                        if is_old || is_abandoned || is_unused_archive {
                            let mut cat = String::from("old_file");
                            if is_abandoned {
                                cat = String::from("abandoned_download");
                            } else if is_unused_archive {
                                cat = String::from("unused_archive");
                            }
                            acc.old_files.push(OldFileInfo {
                                path: entry_path.to_string_lossy().to_string(),
                                name: name.clone(),
                                size,
                                last_modified: system_time_to_millis(modified),
                                category: cat,
                            });
                        }
                    }
                }

                // Plus gros fichiers
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(-1);
                acc.biggest_files.push(BiggestFile {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    size,
                    category: category.to_string(),
                    modified,
                });

                // Fichiers suspects
                if let Some(sus) = inspect_file(entry_path, &metadata) {
                    acc.suspicious.push(sus);
                }
            }
            acc
        })
        .reduce(GlobalScan::default, |mut a, b| {
            a.merge(b);
            a
        });

    scan
}

/* ---------- Construction du GlobalAnalysis ---------- */

fn compute_global_analysis(root: &str) -> Result<GlobalAnalysis, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err(format!("{root} is not a directory"));
    }

    let start = Instant::now();
    let now = std::time::SystemTime::now();
    let scan = scan_global(root_path, 0, now);

    // Stats par catégorie (triées par taille décroissante)
    let mut by_category: Vec<CategoryStat> = scan
        .categories
        .into_iter()
        .map(|(category, (size, count))| CategoryStat {
            category,
            size,
            count,
        })
        .collect();
    by_category.par_sort_unstable_by(|a, b| b.size.cmp(&a.size));

    let stats = StorageStats {
        total_size: scan.total_size,
        file_count: scan.file_count,
        by_category,
    };

    // Extensions les plus volumineuses
    let total_size = scan.total_size;
    let mut largest_extensions: Vec<ExtensionStat> = scan
        .extensions
        .into_iter()
        .map(|(extension, (size, count))| ExtensionStat {
            extension,
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
    largest_extensions.truncate(EXTENSION_LIMIT);

    let extensions_count = largest_extensions.len();
    let old_files_count = scan.old_files.len();

    // Fichiers anciens (plus récents d'abord), puis limite
    let mut old_files = scan.old_files;
    old_files.par_sort_unstable_by(|a, b| b.last_modified.cmp(&a.last_modified));
    old_files.truncate(OLD_FILES_LIMIT);

    let insights = StorageInsights {
        largest_extensions,
        old_files,
        total_scanned: scan.file_count,
    };

    // Plus gros fichiers
    let mut biggest_files = scan.biggest_files;
    biggest_files.par_sort_unstable_by(|a, b| b.size.cmp(&a.size));
    biggest_files.truncate(BIGGEST_FILES_LIMIT);

    // Plus gros dossiers
    let mut biggest_folders = scan.folders;
    biggest_folders.par_sort_unstable_by(|a, b| b.total_size.cmp(&a.total_size));
    biggest_folders.truncate(BIGGEST_FOLDERS_LIMIT);

    // Fichiers suspects
    let mut suspicious = scan.suspicious;
    suspicious.par_sort_unstable_by(|a, b| b.size.cmp(&a.size));
    suspicious.truncate(SUSPICIOUS_LIMIT);

    eprintln!(
        "[profile] analyze_global({}) -> {} files, {} extensions, {} old files, {} folders, {} suspicious in {:?}",
        root,
        scan.file_count,
        extensions_count,
        old_files_count,
        biggest_folders.len(),
        suspicious.len(),
        start.elapsed()
    );

    Ok(GlobalAnalysis {
        root: root.to_string(),
        scanned_at: system_time_to_millis(std::time::SystemTime::now()),
        stats,
        insights,
        biggest_files,
        biggest_folders,
        suspicious,
    })
}

/* ---------- Commandes Tauri ---------- */

/// Effectue (ou rafraîchit) l'analyse globale complète et écrit le cache.
#[tauri::command]
pub async fn analyze_global() -> Result<GlobalAnalysis, String> {
    let root = global_root();

    tokio::task::spawn_blocking(move || {
        let analysis = compute_global_analysis(&root)?;

        // Persiste le résultat dans le cache JSON
        let path = cache_path()?;
        let json = serde_json::to_string_pretty(&analysis)
            .map_err(|e| format!("Impossible de sérialiser l'analyse : {e}"))?;
        std::fs::write(&path, json).map_err(|e| format!("Impossible d'écrire le cache : {e}"))?;

        Ok(analysis)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Renvoie l'analyse en cache si elle existe (sinon `None`).
#[tauri::command]
pub async fn get_cached_analysis() -> Result<Option<GlobalAnalysis>, String> {
    let path = match cache_path() {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };

    let raw = match std::fs::read(&path) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    match serde_json::from_slice(&raw) {
        Ok(analysis) => Ok(Some(analysis)),
        Err(e) => {
            eprintln!("[cache] analyse globale invalide, ignorée : {e}");
            Ok(None)
        }
    }
}
