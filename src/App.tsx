import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  FolderPlus,
  FilePlus,
  Trash2,
  Copy,
  ClipboardPaste,
  Scissors,
  Folder,
  FileText,
  Pencil,
  Info,
  FileEdit,
  Search,
  X,
  ToggleLeft,
  ToggleRight,
  Star,
} from "lucide-react";
import "./App.css";
import type {
  FileEntry,
  StorageStats,
  SortKey,
  SortDirection,
  SpecialDir,
  DriveInfo,
  ClipboardState,
  SearchResult,
  FavoriteItem,
  AccessRecord,
} from "./types";
import { formatSize } from "./lib/format";
import { categoryLabel, typeLabel } from "./lib/category";
import { parentPath, joinPath } from "./lib/path";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileList from "./components/FileList";
import HomeView from "./components/HomeView";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import SettingsPanel from "./components/SettingsPanel";
import ContextMenu, { type ContextMenuItem } from "./components/ContextMenu";
import Dialog from "./components/Dialog";
import PropertiesPanel from "./components/PropertiesPanel";

const LAST_PATH_KEY = "noya:lastPath";

/** Met en évidence les parties correspondantes d'un texte */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <strong className="search-highlight">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

type DialogState =
  | { type: "create-dir" }
  | { type: "create-file" }
  | { type: "rename"; path: string; name: string }
  | { type: "delete"; paths: string[]; names: string[] }
  | null;

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

function AppContent() {
  const { t } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [propertiesPath, setPropertiesPath] = useState<string | null>(null);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [forwardHistory, setForwardHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchContent, setSearchContent] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
  const folderSizesRef = useRef<Record<string, number>>({});

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [homePath, setHomePath] = useState<string | null>(null);
  const [specialDirs, setSpecialDirs] = useState<SpecialDir[]>([]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);

  // Favoris & historique d'accès (persistance backend)
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [mostUsed, setMostUsed] = useState<AccessRecord[]>([]);
  const [recentFiles, setRecentFiles] = useState<AccessRecord[]>([]);

  // Vue Home active par défaut au démarrage
  const [showHomeView, setShowHomeView] = useState(true);

  // Sélection multiple
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const lastSelectedPath = useRef<string | null>(null);

  // Presse-papier
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Menu contextuel
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Dialogs
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    (async () => {
      try {
        const home = await invoke<string>("home_dir");
        setHomePath(home);
      } catch (e) {
        setError(`${t("error.home_dir")} ${e}`);
      }
      try {
        const dirs = await invoke<SpecialDir[]>("special_dirs");
        setSpecialDirs(dirs);
      } catch {}
      try {
        const d = await invoke<DriveInfo[]>("list_drives");
        setDrives(d);
      } catch {}
      // Favoris & historique d'accès
      try {
        const favs = await invoke<FavoriteItem[]>("list_favorites");
        setFavorites(favs);
      } catch {}
      try {
        const mu = await invoke<AccessRecord[]>("get_most_used", { limit: 4 });
        setMostUsed(mu);
      } catch {}
      try {
        const rf = await invoke<AccessRecord[]>("get_recent_files", { limit: 20 });
        setRecentFiles(rf);
      } catch {}
    })();
  }, []);

  /* ---------- Recherche intelligente (debounce) ---------- */

  useEffect(() => {
    if (!search.trim() || !currentPath) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await invoke<SearchResult[]>("search_files", {
          rootPath: currentPath,
          query: search.trim(),
          searchContent,
          maxResults: 50,
        });
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchContent, currentPath]);

  // Timer de debounce pour les mises à jour groupées de folderSizes.
  const folderSizeFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Met à jour folderSizes de manière debouncée pour éviter les re-rendus en cascade. */
  const scheduleFolderSizesFlush = useCallback(() => {
    if (folderSizeFlushTimer.current) clearTimeout(folderSizeFlushTimer.current);
    folderSizeFlushTimer.current = setTimeout(() => {
      setFolderSizes({ ...folderSizesRef.current });
    }, 80);
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSearch("");
    setStorageStats(null);
    setSelectedPaths(new Set());
    lastSelectedPath.current = null;
    try {
      const result = await invoke<FileEntry[]>("list_dir", { path });
      setEntries(result);
      setCurrentPath(path);
      localStorage.setItem(LAST_PATH_KEY, path);

      folderSizesRef.current = {};
      setFolderSizes({});
      computedFolderPaths.current = new Set();
      // Les tailles de dossier sont calculées à la demande (lazy) via
      // onVisibleEntriesChange — voir handleVisibleEntriesChange.
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Au démarrage, on affiche la vue Home par défaut plutôt que de charger
  // immédiatement le dernier dossier. L'utilisateur peut naviguer ensuite.

  /** Set des chemins dont la taille est déjà calculée ou en cours de calcul. */
  const computedFolderPaths = useRef<Set<string>>(new Set());

  /**
   * Calcul lazy des tailles de dossier : déclenché par FileList quand les
   * entrées visibles changent. Seuls les dossiers visibles sans taille connue
   * sont calculés, avec une limite de concurrence de 4.
   */
  const handleVisibleEntriesChange = useCallback(
    (visible: FileEntry[]) => {
      const foldersToCompute = visible.filter(
        (e) =>
          e.isDir &&
          !computedFolderPaths.current.has(e.path) &&
          !(e.path in folderSizesRef.current),
      );
      if (foldersToCompute.length === 0) return;

      const MAX_CONCURRENT = 4;
      let nextIndex = 0;

      const processNext = (): void => {
        if (nextIndex >= foldersToCompute.length) return;
        const folder = foldersToCompute[nextIndex++];
        computedFolderPaths.current.add(folder.path);
        invoke<number>("folder_size", { path: folder.path, maxDepth: 10 })
          .then((size) => {
            folderSizesRef.current[folder.path] = size;
            scheduleFolderSizesFlush();
          })
          .catch(() => {})
          .finally(() => processNext());
      };

      for (let i = 0; i < Math.min(MAX_CONCURRENT, foldersToCompute.length); i++) {
        processNext();
      }
    },
    [scheduleFolderSizesFlush],
  );

  /** Rafraîchit les données de la vue Home depuis le backend. */
  const refreshHomeData = useCallback(async () => {
    try {
      const mu = await invoke<AccessRecord[]>("get_most_used", { limit: 4 });
      setMostUsed(mu);
    } catch {}
    try {
      const rf = await invoke<AccessRecord[]>("get_recent_files", { limit: 20 });
      setRecentFiles(rf);
    } catch {}
  }, []);

  /** Enregistre un accès (pour le suivi de fréquence + récence). */
  const recordAccess = useCallback(
    async (entry: { path: string; name: string; isDir: boolean; modified: number }) => {
      try {
        await invoke("record_access", {
          path: entry.path,
          name: entry.name,
          isDir: entry.isDir,
          modified: entry.modified,
        });
      } catch {}
    },
    [],
  );

  const navigateTo = useCallback(
    async (path: string) => {
      setShowHomeView(false);
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      setForwardHistory([]);
      await loadDirectory(path);
      // Tracking de l'accès au dossier
      const name = path.split(/[\\/]/).pop() || path;
      recordAccess({ path, name, isDir: true, modified: Date.now() });
    },
    [currentPath, loadDirectory, recordAccess],
  );

  const goBack = useCallback(async () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previous = next.pop()!;
      if (currentPath) {
        setForwardHistory((f) => [...f, currentPath]);
      }
      void loadDirectory(previous);
      return next;
    });
  }, [currentPath, loadDirectory]);

  const goForward = useCallback(async () => {
    setForwardHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const forward = next.pop()!;
      if (currentPath) {
        setHistory((h) => [...h, currentPath]);
      }
      void loadDirectory(forward);
      return next;
    });
  }, [currentPath, loadDirectory]);

  const goUp = useCallback(async () => {
    if (!currentPath) return;
    const parent = parentPath(currentPath);
    if (parent) {
      await navigateTo(parent);
    }
  }, [currentPath, navigateTo]);

  const openEntry = useCallback(
    async (entry: FileEntry) => {
      if (entry.isDir) {
        await navigateTo(entry.path);
      } else {
        try {
          await invoke("open_file", { path: entry.path });
          recordAccess(entry);
          refreshHomeData();
        } catch (e) {
          setError(`${t("error.open_file")} ${e}`);
        }
      }
    },
    [navigateTo, recordAccess, refreshHomeData],
  );

  const chooseFolder = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await navigateTo(selected);
    }
  }, [navigateTo]);

  const analyzeStorage = useCallback(async () => {
    if (!currentPath) return;
    setAnalyzing(true);
    setError(null);
    try {
      const stats = await invoke<StorageStats>("storage_stats", {
        path: currentPath,
      });
      setStorageStats(stats);
    } catch (e) {
      setError(`${t("error.analyze")} ${e}`);
    } finally {
      setAnalyzing(false);
    }
  }, [currentPath]);

  /* ---------- Favoris ---------- */

  const isFavorite = useCallback(
    (path: string) =>
      favorites.some((f) => f.path.toLowerCase() === path.toLowerCase()),
    [favorites],
  );

  const addFavorite = useCallback(
    async (entry: { path: string; name: string; isDir: boolean }) => {
      try {
        const favs = await invoke<FavoriteItem[]>("add_favorite", {
          path: entry.path,
          name: entry.name,
          isDir: entry.isDir,
        });
        setFavorites(favs);
      } catch (e) {
        setError(`${t("error.add_favorite")} ${e}`);
      }
    },
    [t],
  );

  const removeFavorite = useCallback(
    async (path: string) => {
      try {
        const favs = await invoke<FavoriteItem[]>("remove_favorite", { path });
        setFavorites(favs);
      } catch (e) {
        setError(`${t("error.remove_favorite")} ${e}`);
      }
    },
    [t],
  );

  /** Gestion du drag-and-drop depuis la liste de fichiers vers la sidebar. */
  const handleDropToSidebar = useCallback(
    async (path: string) => {
      const name = path.split(/[\\/]/).pop() || path;
      // On ne connaît pas isDir ici de façon fiable, on suppose un dossier si pas d'extension.
      const isDir = !name.includes(".") || name.endsWith("/");
      await addFavorite({ path, name, isDir });
    },
    [addFavorite],
  );

  /** Bascule un favori depuis la vue Home. */
  const toggleFavoriteFromRecord = useCallback(
    async (record: AccessRecord) => {
      if (isFavorite(record.path)) {
        await removeFavorite(record.path);
      } else {
        await addFavorite({
          path: record.path,
          name: record.name,
          isDir: record.isDir,
        });
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  );

  /** Ouvre un élément depuis la vue Home. */
  const openFromHome = useCallback(
    async (record: AccessRecord) => {
      if (record.isDir) {
        await navigateTo(record.path);
      } else {
        try {
          await invoke("open_file", { path: record.path });
          recordAccess(record);
          refreshHomeData();
        } catch (e) {
          setError(`${t("error.open_file")} ${e}`);
        }
      }
    },
    [navigateTo, recordAccess, refreshHomeData, t],
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  // On n'inclut folderSizes dans les dépendances que si le tri actif est "size",
  // pour éviter un re-tri complet (et un re-rendu) à chaque réponse folder_size
  // quand l'utilisateur trie par nom/type/date.
  const sortDependsOnFolderSizes = sortKey === "size";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folderSizesDep = sortDependsOnFolderSizes ? folderSizes : folderSizesRef.current;

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? entries.filter((e) => e.name.toLowerCase().includes(query))
      : entries;

    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case "size": {
          const aSize = a.isDir ? folderSizesDep[a.path] ?? 0 : a.size;
          const bSize = b.isDir ? folderSizesDep[b.path] ?? 0 : b.size;
          cmp = aSize - bSize;
          break;
        }
        case "type":
          cmp = typeLabel(t, a.name, a.isDir).localeCompare(
            typeLabel(t, b.name, b.isDir),
          );
          break;
        case "modified":
          cmp = a.modified - b.modified;
          break;
      }
      if (cmp === 0) {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      return cmp * dir;
    });

    return sorted;
  }, [entries, search, sortKey, sortDir, folderSizesDep, t]);

  /* ---------- Sélection ---------- */

  const handleRowClick = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+clic : bascule
        setSelectedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(entry.path)) {
            next.delete(entry.path);
          } else {
            next.add(entry.path);
          }
          return next;
        });
        lastSelectedPath.current = entry.path;
      } else if (e.shiftKey && lastSelectedPath.current) {
        // Shift+clic : plage
        const paths = visibleEntries.map((e) => e.path);
        const startIdx = paths.indexOf(lastSelectedPath.current);
        const endIdx = paths.indexOf(entry.path);
        if (startIdx >= 0 && endIdx >= 0) {
          const [from, to] =
            startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const range = new Set(paths.slice(from, to + 1));
          setSelectedPaths(range);
        }
      } else {
        // Clic simple : ouvrir si dossier, sinon sélection unique
        if (entry.isDir) {
          void openEntry(entry);
        } else {
          setSelectedPaths(new Set([entry.path]));
          lastSelectedPath.current = entry.path;
        }
      }
    },
    [visibleEntries, openEntry],
  );

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    lastSelectedPath.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(visibleEntries.map((e) => e.path)));
  }, [visibleEntries]);

  /* ---------- Actions CRUD ---------- */

  const refresh = useCallback(() => {
    if (currentPath) void loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const handleCreateDir = useCallback(
    async (name: string) => {
      if (!currentPath) {
        setDialog(null);
        setError(t("error.no_current_path"));
        return;
      }
      try {
        await invoke("create_dir", { path: joinPath(currentPath, name) });
        setDialog(null);
        refresh();
      } catch (e) {
        setError(`${t("error.create_dir")} ${e}`);
      }
    },
    [currentPath, refresh],
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      if (!currentPath) {
        setDialog(null);
        setError(t("error.no_current_path"));
        return;
      }
      try {
        await invoke("create_file", { path: joinPath(currentPath, name) });
        setDialog(null);
        refresh();
      } catch (e) {
        setError(`${t("error.create_file")} ${e}`);
      }
    },
    [currentPath, refresh],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      if (!dialog || dialog.type !== "rename") return;
      const newPath = joinPath(parentPath(dialog.path) || "", newName);
      try {
        await invoke("rename_entry", {
          oldPath: dialog.path,
          newPath,
        });
        setDialog(null);
        refresh();
      } catch (e) {
        setError(`${t("error.rename")} ${e}`);
      }
    },
    [dialog, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!dialog || dialog.type !== "delete") return;
    for (const p of dialog.paths) {
      try {
        await invoke("delete_entry", { path: p });
      } catch (e) {
        setError(`${t("error.delete")} ${p} : ${e}`);
      }
    }
    setDialog(null);
    clearSelection();
    refresh();
  }, [dialog, clearSelection, refresh]);

  /* ---------- Presse-papier ---------- */

  const copySelection = useCallback(() => {
    if (selectedPaths.size === 0) return;
    setClipboard({ paths: [...selectedPaths], operation: "copy" });
  }, [selectedPaths]);

  const cutSelection = useCallback(() => {
    if (selectedPaths.size === 0) return;
    setClipboard({ paths: [...selectedPaths], operation: "cut" });
  }, [selectedPaths]);

  const pasteClipboard = useCallback(async () => {
    if (!clipboard || !currentPath) return;
    for (const src of clipboard.paths) {
      const name = src.split(/[\\/]/).pop() || src;
      const dst = joinPath(currentPath, name);
      try {
        if (clipboard.operation === "copy") {
          await invoke("copy_entry", { src, dst });
        } else {
          await invoke("move_entry", { src, dst });
        }
      } catch (e) {
        setError(`${t("error.paste")} ${name} : ${e}`);
      }
    }
    if (clipboard.operation === "cut") {
      setClipboard(null);
    }
    refresh();
  }, [clipboard, currentPath, refresh]);

  /* ---------- Menu contextuel ---------- */

  const showContextMenu = useCallback(
    (e: React.MouseEvent, entry?: FileEntry) => {
      e.preventDefault();
      e.stopPropagation();
      const x = e.clientX;
      const y = e.clientY;

      const items: ContextMenuItem[] = [];

      if (entry) {
        // Menu sur un fichier/dossier
        if (entry.isDir) {
          items.push({
            label: t("context.open"),
            icon: Folder,
            onClick: () => void openEntry(entry),
          });
        } else {
          items.push({
            label: t("context.open"),
            icon: FileText,
            onClick: () => void openEntry(entry),
          });
          items.push({
            label: t("context.edit"),
            icon: FileEdit,
            onClick: () => void invoke("edit_file", { path: entry.path }),
          });
        }
        items.push({ label: "", separator: true });
        items.push({
          label: t("context.cut"),
          icon: Scissors,
          onClick: () => {
            setSelectedPaths(new Set([entry.path]));
            setClipboard({ paths: [entry.path], operation: "cut" });
          },
        });
        items.push({
          label: t("context.copy"),
          icon: Copy,
          onClick: () => {
            setSelectedPaths(new Set([entry.path]));
            setClipboard({ paths: [entry.path], operation: "copy" });
          },
        });
        items.push({
          label: t("context.rename"),
          icon: Pencil,
          onClick: () =>
            setDialog({
              type: "rename",
              path: entry.path,
              name: entry.name,
            }),
        });
        items.push({
          label: t("context.delete"),
          icon: Trash2,
          danger: true,
          onClick: () =>
            setDialog({
              type: "delete",
              paths: [entry.path],
              names: [entry.name],
            }),
        });
        items.push({ label: "", separator: true });
        items.push({
          label: t("context.properties"),
          icon: Info,
          onClick: () => setPropertiesPath(entry.path),
        });
      } else {
        // Menu sur le fond
        items.push({
          label: t("context.new_folder"),
          icon: FolderPlus,
          onClick: () => setDialog({ type: "create-dir" }),
        });
        items.push({
          label: t("context.new_file"),
          icon: FilePlus,
          onClick: () => setDialog({ type: "create-file" }),
        });
        if (clipboard) {
          items.push({ label: "", separator: true });
          items.push({
            label: t("context.paste"),
            icon: ClipboardPaste,
            onClick: () => void pasteClipboard(),
          });
        }
      }

      setContextMenu({ x, y, items });
    },
    [openEntry, clipboard, pasteClipboard],
  );

  /* ---------- Raccourcis clavier ---------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      // Raccourcis qui fonctionnent même dans les inputs
      if (e.key === "Backspace" && !inInput && history.length > 0) {
        e.preventDefault();
        void goBack();
      }
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        void goBack();
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        void goForward();
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        void goUp();
      }

      // Raccourcis hors inputs
      if (inInput) return;

      if (e.key === "Delete" && selectedPaths.size > 0) {
        e.preventDefault();
        const names = entries
          .filter((en) => selectedPaths.has(en.path))
          .map((en) => en.name);
        setDialog({
          type: "delete",
          paths: [...selectedPaths],
          names,
        });
      }
      if (e.key === "F2" && selectedPaths.size === 1) {
        e.preventDefault();
        const entry = entries.find((en) => selectedPaths.has(en.path));
        if (entry) {
          setDialog({ type: "rename", path: entry.path, name: entry.name });
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "c" && selectedPaths.size > 0) {
          e.preventDefault();
          copySelection();
        }
        if (e.key === "x" && selectedPaths.size > 0) {
          e.preventDefault();
          cutSelection();
        }
        if (e.key === "v" && clipboard) {
          e.preventDefault();
          void pasteClipboard();
        }
        if (e.key === "a") {
          e.preventDefault();
          selectAll();
        }
        if (e.shiftKey && e.key === "N") {
          e.preventDefault();
          setDialog({ type: "create-dir" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    goBack,
    goForward,
    goUp,
    history.length,
    selectedPaths,
    entries,
    clipboard,
    copySelection,
    cutSelection,
    pasteClipboard,
    selectAll,
  ]);

  const cutPaths = useMemo(() => {
    if (!clipboard || clipboard.operation !== "cut") return new Set<string>();
    return new Set(clipboard.paths);
  }, [clipboard]);

  return (
    <main
      className="app"
      onClick={() => {
        clearSelection();
        setContextMenu(null);
      }}
    >
      <Sidebar
        homePath={homePath}
        specialDirs={specialDirs}
        drives={drives}
        favorites={favorites}
        currentPath={currentPath}
        isHomeView={showHomeView}
        onNavigate={(p) => void navigateTo(p)}
        onOpenHome={() => {
          setShowHomeView(true);
          setCurrentPath(null);
          setEntries([]);
          void refreshHomeData();
        }}
        onOpenSettings={() => setShowSettings(true)}
        onAnalyze={() => void analyzeStorage()}
        analyzing={analyzing}
        canAnalyze={!!currentPath}
        onRemoveFavorite={(p) => void removeFavorite(p)}
        onDropToSidebar={(p) => void handleDropToSidebar(p)}
      />

      <div className="main-area">
        <header className="app-header">
          <div className="brand">
            <span className="brand-name">Noya Explorer</span>
          </div>
          <div className="header-actions">
            <button
              className="ghost-btn"
              onClick={() => void chooseFolder()}
              title={t("app.open_folder")}
            >
              <><FolderOpen size={14} /> {t("app.open_folder_btn")}</>
            </button>
          </div>
        </header>

        {showHomeView && (
          <div className="content home-content">
            <HomeView
              mostUsed={mostUsed}
              recentFiles={recentFiles}
              favorites={favorites}
              onOpen={(r) => void openFromHome(r)}
              onToggleFavorite={(r) => void toggleFavoriteFromRecord(r)}
              isFavorite={isFavorite}
            />
          </div>
        )}

        {currentPath && !showHomeView && (
          <div className="toolbar">
            <button
              className="icon-btn"
              onClick={() => void goBack()}
              disabled={history.length === 0}
              title={t("app.back")}
            >
              ←
            </button>
            <button
              className="icon-btn"
              onClick={() => void goForward()}
              disabled={forwardHistory.length === 0}
              title={t("app.forward")}
            >
              →
            </button>
            <button
              className="icon-btn"
              onClick={() => void goUp()}
              disabled={!parentPath(currentPath)}
              title={t("app.up")}
            >
              ↑
            </button>
            <Breadcrumb
              path={currentPath}
              onNavigate={(p) => void navigateTo(p)}
            />
            <div className="search-container">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                type="text"
                placeholder={t("app.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className={`search-toggle-btn ${searchContent ? "active" : ""}`}
                onClick={() => setSearchContent(!searchContent)}
                title={searchContent ? t("search.by_content_on") : t("search.by_content_off")}
              >
                {searchContent ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              {search && (
                <button
                  className="icon-btn"
                  onClick={() => {
                    setSearch("");
                    setSearchResults([]);
                  }}
                  title={t("app.clear_search")}
                >
                  <X size={14} />
                </button>
              )}

              {/* Résultats de recherche */}
              {search && searchResults.length > 0 && (
                <div className="search-results">
                  {searching && <div className="search-status">{t("app.searching")}</div>}
                  {searchResults.map((r) => (
                    <button
                      key={r.path}
                      className="search-result-item"
                      onClick={() => {
                        const parent = parentPath(r.path);
                        if (parent) void navigateTo(r.path);
                        else if (!r.is_dir) {
                          const p = parentPath(r.path);
                          if (p) void navigateTo(p);
                        }
                        setSearch("");
                        setSearchResults([]);
                      }}
                      onDoubleClick={() => {
                        if (!r.is_dir) void invoke("open_file", { path: r.path });
                      }}
                    >
                      <span className="search-result-icon">
                        {r.is_dir ? <FolderOpen size={14} /> : <FileText size={14} />}
                      </span>
                      <div className="search-result-info">
                        <span className="search-result-name">{highlightMatch(r.name, search)}</span>
                        <span className="search-result-path">{r.path}</span>
                        {r.context && (
                          <span className="search-result-context">{r.context}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {search && !searching && searchResults.length === 0 && (
                <div className="search-results">
                  <div className="search-status">{t("app.no_results")}</div>
                </div>
              )}
            </div>
            <div className="toolbar-divider" />
            <button
              className="toolbar-action"
              onClick={() => setDialog({ type: "create-dir" })}
              title={t("app.new_folder_title")}
            >
              <FolderPlus size={14} /> {t("app.new_folder")}
            </button>
            <button
              className="toolbar-action"
              onClick={() => setDialog({ type: "create-file" })}
              title={t("app.new_file_title")}
            >
              <FilePlus size={14} /> {t("app.new_file")}
            </button>
            <button
              className="toolbar-action"
              onClick={copySelection}
              disabled={selectedPaths.size === 0}
              title={t("app.copy_title")}
            >
              <Copy size={14} />
            </button>
            <button
              className="toolbar-action"
              onClick={cutSelection}
              disabled={selectedPaths.size === 0}
              title={t("app.cut_title")}
            >
              <Scissors size={14} />
            </button>
            <button
              className="toolbar-action"
              onClick={() => void pasteClipboard()}
              disabled={!clipboard}
              title={t("app.paste_title")}
            >
              <ClipboardPaste size={14} />
            </button>
            <button
              className="toolbar-action"
              onClick={() => {
                const entry = entries.find(e => selectedPaths.has(e.path));
                if (entry && !entry.isDir) void invoke("edit_file", { path: entry.path });
              }}
              disabled={selectedPaths.size !== 1 || !entries.find(e => selectedPaths.has(e.path))?.isDir === false}
              title={t("app.edit_title")}
            >
              <FileEdit size={14} />
            </button>
            <button
              className="toolbar-action danger"
              onClick={() => {
                if (selectedPaths.size > 0) {
                  const names = entries
                    .filter((en) => selectedPaths.has(en.path))
                    .map((en) => en.name);
                  setDialog({
                    type: "delete",
                    paths: [...selectedPaths],
                    names,
                  });
                }
              }}
              disabled={selectedPaths.size === 0}
              title={t("app.delete_title")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {currentPath && !showHomeView && (
          <div className="content">
            <FileList
              entries={visibleEntries}
              folderSizes={folderSizes}
              selectedPaths={selectedPaths}
              cutPaths={cutPaths}
              sortKey={sortKey}
              sortDir={sortDir}
              loading={loading}
              search={search}
              onToggleSort={toggleSort}
              onRowClick={handleRowClick}
              onRowContextMenu={showContextMenu}
              onRowDoubleClick={(entry) => void openEntry(entry)}
              onBackgroundContextMenu={showContextMenu}
              onBackgroundClick={(e) => {
                if (e.target === e.currentTarget) clearSelection();
              }}
              onVisibleEntriesChange={handleVisibleEntriesChange}
              rowAction={(entry) => {
                const pinned = isFavorite(entry.path);
                return (
                  <button
                    className="row-pin-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pinned) void removeFavorite(entry.path);
                      else
                        void addFavorite({
                          path: entry.path,
                          name: entry.name,
                          isDir: entry.isDir,
                        });
                    }}
                    title={pinned ? t("home.unpin") : t("home.pin")}
                  >
                    <Star size={13} fill={pinned ? "currentColor" : "none"} />
                  </button>
                );
              }}
            />

            {storageStats && (
              <aside className="storage-panel">
                <h2>{t("storage.title")}</h2>
                <div className="storage-total">
                  <span className="label">{t("storage.total")}</span>
                  <strong>{formatSize(storageStats.totalSize)}</strong>
                </div>
                <div className="storage-total">
                  <span className="label">{t("storage.files")}</span>
                  <strong>{storageStats.fileCount.toLocaleString()}</strong>
                </div>
                <h3>{t("storage.by_category")}</h3>
                {storageStats.byCategory.length === 0 && (
                  <p className="muted">{t("storage.empty")}</p>
                )}
                {storageStats.byCategory.map((cat) => {
                  const percent =
                    storageStats.totalSize > 0
                      ? (cat.size / storageStats.totalSize) * 100
                      : 0;
                  return (
                    <div key={cat.category} className="storage-bar">
                      <div className="storage-bar-label">
                        <span>{categoryLabel(t, cat.category)}</span>
                        <span className="muted">
                          {formatSize(cat.size)} · {cat.count.toLocaleString()}{" "}
                          {t("storage.files").toLowerCase()}{cat.count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </aside>
            )}
          </div>
        )}

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
        {propertiesPath && (
          <PropertiesPanel
            path={propertiesPath}
            onClose={() => setPropertiesPath(null)}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        )}
        {dialog && (
          <Dialog
            title={
              dialog.type === "create-dir"
                ? t("dialog.new_folder_title")
                : dialog.type === "create-file"
                  ? t("dialog.new_file_title")
                  : dialog.type === "rename"
                    ? t("dialog.rename_title")
                    : t("dialog.delete_title")
            }
            message={
              dialog.type === "delete"
                ? dialog.names.length === 1
                  ? t("dialog.delete_message_single", { name: dialog.names[0] })
                  : t("dialog.delete_message_multiple", { count: String(dialog.names.length) })
                : undefined
            }
            inputLabel={
              dialog.type === "create-dir" || dialog.type === "create-file"
                ? t("dialog.name_label")
                : dialog.type === "rename"
                  ? t("dialog.new_name_label")
                  : undefined
            }
            inputValue={dialog.type === "rename" ? dialog.name : ""}
            cancelLabel={t("dialog.cancel")}
            confirmLabel={
              dialog.type === "create-dir"
                ? t("dialog.create_btn")
                : dialog.type === "create-file"
                  ? t("dialog.create_btn")
                  : dialog.type === "rename"
                    ? t("dialog.rename_btn")
                    : t("dialog.delete_btn")
            }
            danger={dialog.type === "delete"}
            onConfirm={(value) => {
              if (dialog.type === "create-dir") void handleCreateDir(value!);
              else if (dialog.type === "create-file") void handleCreateFile(value!);
              else if (dialog.type === "rename") void handleRename(value!);
              else if (dialog.type === "delete") void handleDelete();
            }}
            onClose={() => setDialog(null)}
          />
        )}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
