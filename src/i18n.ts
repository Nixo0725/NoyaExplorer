import type { Language } from "./types";

export type DictKey = keyof typeof FR;

const FR: Record<string, string> = {
  /* ---------- App ---------- */
  "app.name": "Noya Explorer",
  "app.open_folder": "Ouvrir un autre dossier",
  "app.open_folder_btn": "Ouvrir…",
  "app.back": "Précédent (Alt+←)",
  "app.forward": "Suivant (Alt+→)",
  "app.up": "Dossier parent (Alt+↑)",
  "app.search": "Rechercher…",
  "app.clear_search": "Effacer la recherche",
  "app.new_folder_title": "Nouveau dossier (Ctrl+Shift+N)",
  "app.new_folder": "Dossier",
  "app.new_file_title": "Nouveau fichier",
  "app.new_file": "Fichier",
  "app.copy_title": "Copier (Ctrl+C)",
  "app.cut_title": "Couper (Ctrl+X)",
  "app.edit_title": "Modifier",
  "app.paste_title": "Coller (Ctrl+V)",
  "app.delete_title": "Supprimer (Suppr)",
  "app.loading": "Chargement…",
  "app.empty_folder": "Ce dossier est vide.",
  "app.no_results": "Aucun résultat.",
  "app.searching": "Recherche…",

  /* ---------- Recherche ---------- */
  "search.by_content_on": "Recherche par contenu activée",
  "search.by_content_off": "Recherche par contenu désactivée",

  /* ---------- Tri ---------- */
  "sort.name": "Nom",
  "sort.size": "Taille",
  "sort.type": "Type",
  "sort.modified": "Date",

  /* ---------- Erreurs ---------- */
  "error.home_dir": "Impossible de trouver le dossier utilisateur :",
  "error.open_file": "Impossible d'ouvrir le fichier :",
  "error.analyze": "Analyse impossible :",
  "error.create_dir": "Impossible de créer le dossier :",
  "error.create_file": "Impossible de créer le fichier :",
  "error.rename": "Impossible de renommer :",
  "error.delete": "Impossible de supprimer",
  "error.paste": "Impossible de coller",
  "error.no_current_path": "Aucun dossier sélectionné.",
  "error.add_favorite": "Impossible d'ajouter aux favoris :",
  "error.remove_favorite": "Impossible de retirer le favori :",

  /* ---------- Sidebar ---------- */
  "sidebar.quick_access": "Accès rapide",
  "sidebar.home": "Accueil",
  "sidebar.desktop": "Bureau",
  "sidebar.documents": "Documents",
  "sidebar.downloads": "Téléchargements",
  "sidebar.this_pc": "Ce PC",
  "sidebar.analyze": "Analyser le stockage",
  "sidebar.analyzing": "Analyse…",
  "sidebar.analyze_title": "Analyser le stockage du dossier courant",
  "sidebar.settings": "Paramètres",
  "sidebar.settings_title": "Paramètres",
  "sidebar.favorites": "Favoris",
  "sidebar.favorites_empty": "Glissez des fichiers ici pour les épingler",
  "sidebar.remove_favorite": "Retirer des favoris",
  "sidebar.add_favorite": "Ajouter aux favoris",

  /* ---------- Settings ---------- */
  "settings.title": "Paramètres",
  "settings.close": "Fermer",
  "settings.appearance": "Apparence",
  "settings.appearance_desc":
    "Choisis le mode d'affichage. Le mode Auto suit la préférence de ton système (clair ou sombre).",
  "settings.theme_auto": "Auto",
  "settings.theme_light": "Clair",
  "settings.theme_dark": "Sombre",
  "settings.language": "Langue",
  "settings.mode_english": "Mode anglais",
  "settings.mode_english_desc":
    "Afficher l'interface en anglais au lieu du français.",

  /* ---------- Context menu ---------- */
  "context.open": "Ouvrir",
  "context.cut": "Couper",
  "context.copy": "Copier",
  "context.rename": "Renommer",
  "context.edit": "Modifier",
  "context.delete": "Supprimer",
  "context.properties": "Propriétés",
  "context.new_folder": "Nouveau dossier",
  "context.new_file": "Nouveau fichier",
  "context.paste": "Coller",

  /* ---------- Dialog ---------- */
  "dialog.cancel": "Annuler",
  "dialog.new_folder_title": "Nouveau dossier",
  "dialog.new_file_title": "Nouveau fichier",
  "dialog.rename_title": "Renommer",
  "dialog.delete_title": "Supprimer",
  "dialog.name_label": "Nom",
  "dialog.new_name_label": "Nouveau nom",
  "dialog.create_btn": "Créer",
  "dialog.rename_btn": "Renommer",
  "dialog.delete_btn": "Supprimer",
  "dialog.delete_message_single": 'Supprimer "{name}" ? Cette action est irréversible.',
  "dialog.delete_message_multiple":
    "Supprimer {count} éléments ? Cette action est irréversible.",

  /* ---------- Properties ---------- */
  "properties.title": "Propriétés",
  "properties.close": "Fermer",
  "properties.loading": "Chargement…",
  "properties.name": "Nom",
  "properties.type": "Type",
  "properties.type_folder": "Dossier",
  "properties.path": "Chemin",
  "properties.size": "Taille",
  "properties.extension": "Extension",
  "properties.read_only": "Lecture seule",
  "properties.yes": "Oui",
  "properties.no": "Non",
  "properties.created": "Créé le",
  "properties.modified": "Modifié le",
  "properties.accessed": "Accédé le",

  /* ---------- Storage ---------- */
  "storage.title": "Aperçu du stockage",
  "storage.total": "Total",
  "storage.files": "Fichiers",
  "storage.by_category": "Répartition par catégorie",
  "storage.empty": "Aucun fichier dans ce dossier.",

  /* ---------- Category labels ---------- */
  "cat.folder": "Dossier",
  "cat.image": "Image",
  "cat.video": "Vidéo",
  "cat.audio": "Audio",
  "cat.document": "Document",
  "cat.archive": "Archive",
  "cat.code": "Code",
  "cat.executable": "Exécutable",
  "cat.other": "Autre",
  "cat.file": "Fichier",

  /* ---------- Breadcrumb ---------- */
  "breadcrumb.hint": "Cliquez pour saisir un chemin",

  /* ---------- Home view ---------- */
  "home.title": "Accueil",
  "home.most_used": "Éléments les plus utilisés",
  "home.recent": "Fichiers récents",
  "home.empty_most_used": "Aucun élément utilisé pour le moment.",
  "home.empty_recent": "Aucun fichier récent.",
  "home.open_count": "{count} accès",
  "home.pin": "Épingler",
  "home.unpin": "Désépingler",
};

const EN: Record<string, string> = {
  "app.name": "Noya Explorer",
  "app.open_folder": "Open another folder",
  "app.open_folder_btn": "Open…",
  "app.back": "Back (Alt+←)",
  "app.forward": "Forward (Alt+→)",
  "app.up": "Parent folder (Alt+↑)",
  "app.search": "Search…",
  "app.clear_search": "Clear search",
  "app.new_folder_title": "New folder (Ctrl+Shift+N)",
  "app.new_folder": "Folder",
  "app.new_file_title": "New file",
  "app.new_file": "File",
  "app.copy_title": "Copy (Ctrl+C)",
  "app.cut_title": "Cut (Ctrl+X)",
  "app.edit_title": "Edit",
  "app.paste_title": "Paste (Ctrl+V)",
  "app.delete_title": "Delete (Del)",
  "app.loading": "Loading…",
  "app.empty_folder": "This folder is empty.",
  "app.no_results": "No results.",
  "app.searching": "Searching…",

  /* ---------- Search ---------- */
  "search.by_content_on": "Content search enabled",
  "search.by_content_off": "Content search disabled",

  "sort.name": "Name",
  "sort.size": "Size",
  "sort.type": "Type",
  "sort.modified": "Date",

  "error.home_dir": "Could not find the user folder:",
  "error.open_file": "Could not open the file:",
  "error.analyze": "Analysis failed:",
  "error.create_dir": "Could not create folder:",
  "error.create_file": "Could not create file:",
  "error.rename": "Could not rename:",
  "error.delete": "Could not delete",
  "error.paste": "Could not paste",
  "error.no_current_path": "No folder selected.",
  "error.add_favorite": "Could not add to favorites:",
  "error.remove_favorite": "Could not remove favorite:",

  "sidebar.quick_access": "Quick access",
  "sidebar.home": "Home",
  "sidebar.desktop": "Desktop",
  "sidebar.documents": "Documents",
  "sidebar.downloads": "Downloads",
  "sidebar.this_pc": "This PC",
  "sidebar.analyze": "Analyze storage",
  "sidebar.analyzing": "Analyzing…",
  "sidebar.analyze_title": "Analyze storage of the current folder",
  "sidebar.settings": "Settings",
  "sidebar.settings_title": "Settings",
  "sidebar.favorites": "Favorites",
  "sidebar.favorites_empty": "Drag files here to pin them",
  "sidebar.remove_favorite": "Remove from favorites",
  "sidebar.add_favorite": "Add to favorites",

  "settings.title": "Settings",
  "settings.close": "Close",
  "settings.appearance": "Appearance",
  "settings.appearance_desc":
    "Choose the display mode. Auto mode follows your system preference (light or dark).",
  "settings.theme_auto": "Auto",
  "settings.theme_light": "Light",
  "settings.theme_dark": "Dark",
  "settings.language": "Language",
  "settings.mode_english": "English mode",
  "settings.mode_english_desc":
    "Display the interface in English instead of French.",

  "context.open": "Open",
  "context.cut": "Cut",
  "context.copy": "Copy",
  "context.rename": "Rename",
  "context.edit": "Edit",
  "context.delete": "Delete",
  "context.properties": "Properties",
  "context.new_folder": "New folder",
  "context.new_file": "New file",
  "context.paste": "Paste",

  "dialog.cancel": "Cancel",
  "dialog.new_folder_title": "New folder",
  "dialog.new_file_title": "New file",
  "dialog.rename_title": "Rename",
  "dialog.delete_title": "Delete",
  "dialog.name_label": "Name",
  "dialog.new_name_label": "New name",
  "dialog.create_btn": "Create",
  "dialog.rename_btn": "Rename",
  "dialog.delete_btn": "Delete",
  "dialog.delete_message_single":
    'Delete "{name}" ? This action is irreversible.',
  "dialog.delete_message_multiple":
    "Delete {count} items? This action is irreversible.",

  "properties.title": "Properties",
  "properties.close": "Close",
  "properties.loading": "Loading…",
  "properties.name": "Name",
  "properties.type": "Type",
  "properties.type_folder": "Folder",
  "properties.path": "Path",
  "properties.size": "Size",
  "properties.extension": "Extension",
  "properties.read_only": "Read only",
  "properties.yes": "Yes",
  "properties.no": "No",
  "properties.created": "Created",
  "properties.modified": "Modified",
  "properties.accessed": "Accessed",

  "storage.title": "Storage overview",
  "storage.total": "Total",
  "storage.files": "Files",
  "storage.by_category": "Breakdown by category",
  "storage.empty": "No files in this folder.",

  "cat.folder": "Folder",
  "cat.image": "Image",
  "cat.video": "Video",
  "cat.audio": "Audio",
  "cat.document": "Document",
  "cat.archive": "Archive",
  "cat.code": "Code",
  "cat.executable": "Executable",
  "cat.other": "Other",
  "cat.file": "File",

  "breadcrumb.hint": "Click to enter a path",

  "home.title": "Home",
  "home.most_used": "Most used items",
  "home.recent": "Recent files",
  "home.empty_most_used": "No items used yet.",
  "home.empty_recent": "No recent files.",
  "home.open_count": "{count} accesses",
  "home.pin": "Pin",
  "home.unpin": "Unpin",
};

const DICTIONARIES: Record<Language, Record<string, string>> = { fr: FR, en: EN } as const;

/**
 * Retourne le dictionnaire complet pour la langue donnée.
 */
export function getDictionary(lang: Language): Record<string, string> {
  return DICTIONARIES[lang];
}

/**
 * Résout une clé de traduction avec substitution de variables.
 * Exemple : t("dialog.delete_message_single", { name: "test.txt" })
 */
export type TranslateFn = (key: string, vars?: Record<string, string>) => string;

export function createTranslate(lang: Language): TranslateFn {
  const dict = getDictionary(lang);
  return (key: string, vars?: Record<string, string>): string => {
    let text = dict[key] ?? FR[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  };
}
