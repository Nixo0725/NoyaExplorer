// Commande d'export de rapports (JSON / CSV).
//
// Le frontend possède déjà les données (StorageInsights, BiggestFile, …) :
// il les sérialise puis demande ici l'écriture du fichier sur le disque.

/// Écrit le contenu fourni dans le fichier `path` (créé ou écrasé).
#[tauri::command]
pub fn write_report(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Impossible d'écrire le rapport : {e}"))
}
