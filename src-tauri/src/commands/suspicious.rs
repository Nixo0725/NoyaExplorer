// Détection de fichiers suspects (heuristiques par fichier).
//
// Utilisé par l'analyse globale (`analyze.rs`) pour étiqueter les fichiers
// suspects pendant le scan unique. Heuristiques cumulables dans `reasons` :
//  1. Double extension trompeuse (ex. `image.png.exe`)
//  2. Exécutable/script dans un emplacement inhabituel (racine de lecteur,
//     Temp, AppData ou Downloads)
//  3. Fichier caché (commence par `.`) dans un dossier non-home
//  4. Exécutable très récent (moins de 30 jours)
//  5. Nom obscurci (court, alphanumérique aléatoire) avec extension exécutable

use std::path::Path;

use crate::commands::storage::is_in_downloads;
use crate::types::{SuspiciousFile, system_time_to_millis};

/// Extensions exécutables / scripts prises en compte par la détection.
const EXECUTABLE_EXTS: &[&str] = &["exe", "bat", "cmd", "scr", "js", "vbs", "ps1", "sh"];

/// Extensions de type courant utilisées pour masquer une double extension.
const COMMON_EXTS: &[&str] = &["pdf", "png", "jpg", "doc", "docx", "txt"];

/// Applique les heuristiques à un fichier et renvoie l'entrée suspecte le cas échéant.
pub(crate) fn inspect_file(path: &Path, metadata: &std::fs::Metadata) -> Option<SuspiciousFile> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut reasons: Vec<String> = Vec::new();

    // 1. Double extension trompeuse : `.X.Y` avec Y exécutable et X courant
    if has_deceptive_double_extension(&name) {
        reasons.push("double_extension".to_string());
    }

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if is_executable_or_script(&ext) {
        // 2. Emplacement inhabituel (racine de lecteur, Temp, AppData, Downloads)
        if is_unusual_location(path) {
            reasons.push("unusual_location".to_string());
        }

        // 4. Exécutable très récent (moins de 30 jours)
        if let Ok(modified) = metadata.modified() {
            if let Ok(age) = std::time::SystemTime::now().duration_since(modified) {
                if age.as_secs() < 30 * 24 * 3600 {
                    reasons.push("recent_executable".to_string());
                }
            }
        }

        // 5. Nom obscurci (court, alphanumérique) avec extension exécutable
        if is_obfuscated_name(&name) {
            reasons.push("obfuscated_name".to_string());
        }
    }

    // 3. Fichier caché (`.foo`) dans un dossier non-home
    if name.starts_with('.') && is_non_home_path(path) {
        reasons.push("hidden_file".to_string());
    }

    if reasons.is_empty() {
        return None;
    }

    Some(SuspiciousFile {
        path: path.to_string_lossy().to_string(),
        name,
        size: metadata.len(),
        modified: metadata
            .modified()
            .ok()
            .map(system_time_to_millis)
            .unwrap_or(-1),
        reasons,
    })
}

/// Heuristique 1 : le nom contient un motif `.X.Y` avec Y exécutable et X courant.
fn has_deceptive_double_extension(name: &str) -> bool {
    let lower = name.to_lowercase();
    for exec in EXECUTABLE_EXTS {
        let suffix = format!(".{exec}");
        if let Some(rest) = lower.strip_suffix(&suffix) {
            // rest ressemble à "image.png" → on vérifie l'avant-dernière extension
            if let Some((_, prev_ext)) = rest.rsplit_once('.') {
                if COMMON_EXTS.contains(&prev_ext) {
                    return true;
                }
            }
        }
    }
    false
}

/// Heuristique 2 : l'exécutable/script est dans un emplacement inhabituel.
fn is_unusual_location(path: &Path) -> bool {
    let path_lower = path.to_string_lossy().to_lowercase();

    // Racine d'un lecteur (ex. `/` sur POSIX, `C:\` sur Windows)
    if let Some(parent) = path.parent() {
        if is_drive_root(parent) {
            return true;
        }
    }

    // Dossiers temporaires et AppData
    if path_lower.contains("/temp/")
        || path_lower.contains("\\temp\\")
        || path_lower.contains("/appdata/")
        || path_lower.contains("\\appdata\\")
        || path_lower.ends_with("/temp")
        || path_lower.ends_with("\\temp")
    {
        return true;
    }

    // Téléchargements
    is_in_downloads(path)
}

/// Vérifie si le chemin est une racine de lecteur (`/` ou `C:\`).
fn is_drive_root(path: &Path) -> bool {
    let s = path.to_string_lossy();
    s == "/"
        || (s.len() == 3
            && s.as_bytes().get(1) == Some(&b':')
            && (s.ends_with('\\') || s.ends_with('/')))
}

/// Heuristique 5 : nom court, mélange de lettres et de chiffres (obscurci).
fn is_obfuscated_name(name: &str) -> bool {
    let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(name);
    let len = stem.chars().count();
    len <= 8
        && stem.chars().any(|c| c.is_ascii_digit())
        && stem.chars().any(|c| c.is_ascii_alphabetic())
}

/// Heuristique 3 : vérifie que le fichier n'est pas dans le dossier personnel.
fn is_non_home_path(path: &Path) -> bool {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return true,
    };
    let parent = match path.parent() {
        Some(p) => p,
        None => return true,
    };
    parent != home.as_path() && !parent.starts_with(&home)
}

fn is_executable_or_script(ext: &str) -> bool {
    EXECUTABLE_EXTS.contains(&ext)
}
