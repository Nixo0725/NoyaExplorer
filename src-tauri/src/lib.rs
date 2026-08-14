// Noya Explorer — Backend
//
// This file is the entry point for the Tauri application.
// All commands are organised into submodules under `commands/`.
// Shared types live in `types.rs`.

pub mod commands;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Filesystem
            commands::fs::list_dir,
            commands::fs::folder_size,
            commands::fs::create_file,
            commands::fs::create_dir,
            commands::fs::rename_entry,
            commands::fs::delete_entry,
            commands::fs::copy_entry,
            commands::fs::move_entry,
            commands::fs::get_file_info,
            commands::fs::open_file,
            commands::fs::edit_file,
            // Search
            commands::search::search_files,
            commands::search::search_files_advanced,
            // Storage analysis
            commands::storage::storage_stats,
            commands::storage::get_biggest_files,
            commands::storage::get_biggest_folders,
            commands::storage::get_storage_insights,
            // Spaces
            commands::spaces::list_spaces,
            commands::spaces::create_space,
            commands::spaces::rename_space,
            commands::spaces::delete_space,
            commands::spaces::reorder_spaces,
            commands::spaces::add_folder_to_space,
            commands::spaces::remove_folder_from_space,
            commands::spaces::update_space_icon,
            commands::spaces::list_space_entries,
            // Favorites & access history
            commands::favorites::list_favorites,
            commands::favorites::add_favorite,
            commands::favorites::remove_favorite,
            commands::favorites::record_access,
            commands::favorites::get_most_used,
            commands::favorites::get_recent_files,
            // System
            commands::system::home_dir,
            commands::system::special_dirs,
            commands::system::list_drives,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
