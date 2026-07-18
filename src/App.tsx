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
} from "./types";
import { formatSize, formatDate } from "./lib/format";
import { getTypeInfo } from "./lib/fileType";
import { categoryLabel, typeLabel } from "./lib/category";
import { parentPath, joinPath } from "./lib/path";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileIcon from "./components/FileIcon";
import { ThemeProvider } from "./contexts/ThemeContext";
import SettingsPanel from "./components/SettingsPanel";
import ContextMenu, { type ContextMenuItem } from "./components/ContextMenu";
import Dialog from "./components/Dialog";
import PropertiesPanel from "./components/PropertiesPanel";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nom",
  size: "Taille",
  type: "Type",
  modified: "Date",
};

const LAST_PATH_KEY = "noya:lastPath";

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
  const [showSettings, setShowSettings] = useState(false);
  const [propertiesPath, setPropertiesPath] = useState<string | null>(null);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [forwardHistory, setForwardHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
  const folderSizesRef = useRef<Record<string, number>>({});

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [homePath, setHomePath] = useState<string | null>(null);
  const [specialDirs, setSpecialDirs] = useState<SpecialDir[]>([]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);

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
        setError(`Impossible de trouver le dossier utilisateur : ${e}`);
      }
      try {
        const dirs = await invoke<SpecialDir[]>("special_dirs");
        setSpecialDirs(dirs);
      } catch {}
      try {
        const d = await invoke<DriveInfo[]>("list_drives");
        setDrives(d);
      } catch {}
    })();
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

      const folders = result.filter((e) => e.isDir);
      for (const folder of folders) {
        invoke<number>("folder_size", { path: folder.path })
          .then((size) => {
            folderSizesRef.current = {
              ...folderSizesRef.current,
              [folder.path]: size,
            };
            setFolderSizes({ ...folderSizesRef.current });
          })
          .catch(() => {});
      }
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentPath !== null) return;
    if (homePath === null) return;
    const lastPath = localStorage.getItem(LAST_PATH_KEY);
    void loadDirectory(lastPath || homePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePath]);

  const navigateTo = useCallback(
    async (path: string) => {
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      setForwardHistory([]);
      await loadDirectory(path);
    },
    [currentPath, loadDirectory],
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
        } catch (e) {
          setError(`Impossible d'ouvrir le fichier : ${e}`);
        }
      }
    },
    [navigateTo],
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
      setError(`Analyse impossible : ${e}`);
    } finally {
      setAnalyzing(false);
    }
  }, [currentPath]);

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
          const aSize = a.isDir ? folderSizes[a.path] ?? 0 : a.size;
          const bSize = b.isDir ? folderSizes[b.path] ?? 0 : b.size;
          cmp = aSize - bSize;
          break;
        }
        case "type":
          cmp = typeLabel(a.name, a.isDir).localeCompare(
            typeLabel(b.name, b.isDir),
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
  }, [entries, search, sortKey, sortDir, folderSizes]);

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
      if (!currentPath) return;
      try {
        await invoke("create_dir", { path: joinPath(currentPath, name) });
        setDialog(null);
        refresh();
      } catch (e) {
        setError(`Impossible de créer le dossier : ${e}`);
      }
    },
    [currentPath, refresh],
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      if (!currentPath) return;
      try {
        await invoke("create_file", { path: joinPath(currentPath, name) });
        setDialog(null);
        refresh();
      } catch (e) {
        setError(`Impossible de créer le fichier : ${e}`);
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
        setError(`Impossible de renommer : ${e}`);
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
        setError(`Impossible de supprimer ${p} : ${e}`);
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
        setError(`Impossible de coller ${name} : ${e}`);
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
            label: "Ouvrir",
            icon: Folder,
            onClick: () => void openEntry(entry),
          });
        } else {
          items.push({
            label: "Ouvrir",
            icon: FileText,
            onClick: () => void openEntry(entry),
          });
        }
        items.push({ label: "", separator: true });
        items.push({
          label: "Couper",
          icon: Scissors,
          onClick: () => {
            setSelectedPaths(new Set([entry.path]));
            setClipboard({ paths: [entry.path], operation: "cut" });
          },
        });
        items.push({
          label: "Copier",
          icon: Copy,
          onClick: () => {
            setSelectedPaths(new Set([entry.path]));
            setClipboard({ paths: [entry.path], operation: "copy" });
          },
        });
        items.push({
          label: "Renommer",
          icon: Pencil,
          onClick: () =>
            setDialog({
              type: "rename",
              path: entry.path,
              name: entry.name,
            }),
        });
        items.push({
          label: "Supprimer",
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
          label: "Propriétés",
          icon: Info,
          onClick: () => setPropertiesPath(entry.path),
        });
      } else {
        // Menu sur le fond
        items.push({
          label: "Nouveau dossier",
          icon: FolderPlus,
          onClick: () => setDialog({ type: "create-dir" }),
        });
        items.push({
          label: "Nouveau fichier",
          icon: FilePlus,
          onClick: () => setDialog({ type: "create-file" }),
        });
        if (clipboard) {
          items.push({ label: "", separator: true });
          items.push({
            label: "Coller",
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
        currentPath={currentPath}
        onNavigate={(p) => void navigateTo(p)}
        onOpenSettings={() => setShowSettings(true)}
        onAnalyze={() => void analyzeStorage()}
        analyzing={analyzing}
        canAnalyze={!!currentPath}
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
              title="Ouvrir un autre dossier"
            >
              <><FolderOpen size={14} /> Ouvrir…</>
            </button>
          </div>
        </header>

        {currentPath && (
          <div className="toolbar">
            <button
              className="icon-btn"
              onClick={() => void goBack()}
              disabled={history.length === 0}
              title="Précédent (Alt+←)"
            >
              ←
            </button>
            <button
              className="icon-btn"
              onClick={() => void goForward()}
              disabled={forwardHistory.length === 0}
              title="Suivant (Alt+→)"
            >
              →
            </button>
            <button
              className="icon-btn"
              onClick={() => void goUp()}
              disabled={!parentPath(currentPath)}
              title="Dossier parent (Alt+↑)"
            >
              ↑
            </button>
            <Breadcrumb
              path={currentPath}
              onNavigate={(p) => void navigateTo(p)}
            />
            <input
              className="search-input"
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-btn"
                onClick={() => setSearch("")}
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
            <div className="toolbar-divider" />
            <button
              className="toolbar-action"
              onClick={() => setDialog({ type: "create-dir" })}
              title="Nouveau dossier (Ctrl+Shift+N)"
            >
              <FolderPlus size={14} /> Dossier
            </button>
            <button
              className="toolbar-action"
              onClick={() => setDialog({ type: "create-file" })}
              title="Nouveau fichier"
            >
              <FilePlus size={14} /> Fichier
            </button>
            <button
              className="toolbar-action"
              onClick={copySelection}
              disabled={selectedPaths.size === 0}
              title="Copier (Ctrl+C)"
            >
              <Copy size={14} />
            </button>
            <button
              className="toolbar-action"
              onClick={cutSelection}
              disabled={selectedPaths.size === 0}
              title="Couper (Ctrl+X)"
            >
              <Scissors size={14} />
            </button>
            <button
              className="toolbar-action"
              onClick={() => void pasteClipboard()}
              disabled={!clipboard}
              title="Coller (Ctrl+V)"
            >
              <ClipboardPaste size={14} />
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
              title="Supprimer (Suppr)"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {currentPath && (
          <div className="content">
            <section
              className="file-list"
              onContextMenu={(e) => showContextMenu(e)}
              onClick={(e) => {
                if (e.target === e.currentTarget) clearSelection();
              }}
            >
              <div className="list-header">
                <span className="col-icon" />
                <button
                  className={`col-header ${sortKey === "name" ? `active ${sortDir}` : ""}`}
                  onClick={() => toggleSort("name")}
                >
                  {SORT_LABELS.name}
                </button>
                <button
                  className={`col-header col-size ${sortKey === "size" ? `active ${sortDir}` : ""}`}
                  onClick={() => toggleSort("size")}
                >
                  {SORT_LABELS.size}
                </button>
                <button
                  className={`col-header col-type ${sortKey === "type" ? `active ${sortDir}` : ""}`}
                  onClick={() => toggleSort("type")}
                >
                  {SORT_LABELS.type}
                </button>
                <button
                  className={`col-header col-date ${sortKey === "modified" ? `active ${sortDir}` : ""}`}
                  onClick={() => toggleSort("modified")}
                >
                  {SORT_LABELS.modified}
                </button>
              </div>

              {loading && <div className="status">Chargement…</div>}
              {!loading && visibleEntries.length === 0 && (
                <div className="status">
                  {search ? "Aucun résultat." : "Ce dossier est vide."}
                </div>
              )}
              {!loading &&
                visibleEntries.map((entry) => {
                  const info = getTypeInfo(entry.name, entry.isDir);
                  const size = entry.isDir
                    ? folderSizes[entry.path]
                    : entry.size;
                  const isSelected = selectedPaths.has(entry.path);
                  const isCut = cutPaths.has(entry.path);
                  return (
                    <button
                      key={entry.path}
                      className={`file-row ${isSelected ? "selected" : ""} ${isCut ? "cut" : ""}`}
                      onClick={(e) => handleRowClick(e, entry)}
                      onContextMenu={(e) => showContextMenu(e, entry)}
                      onDoubleClick={() => void openEntry(entry)}
                      title={entry.path}
                    >
                      <span className="file-icon"><FileIcon category={info.category} /></span>
                      <span className="file-name">{entry.name}</span>
                      <span className="file-size">
                        {entry.isDir
                          ? size !== undefined
                            ? formatSize(size)
                            : "…"
                          : formatSize(entry.size)}
                      </span>
                      <span className="file-type">
                        {typeLabel(entry.name, entry.isDir)}
                      </span>
                      <span className="file-date">
                        {formatDate(entry.modified)}
                      </span>
                    </button>
                  );
                })}
            </section>

            {storageStats && (
              <aside className="storage-panel">
                <h2>Aperçu du stockage</h2>
                <div className="storage-total">
                  <span className="label">Total</span>
                  <strong>{formatSize(storageStats.totalSize)}</strong>
                </div>
                <div className="storage-total">
                  <span className="label">Fichiers</span>
                  <strong>{storageStats.fileCount.toLocaleString()}</strong>
                </div>
                <h3>Répartition par catégorie</h3>
                {storageStats.byCategory.length === 0 && (
                  <p className="muted">Aucun fichier dans ce dossier.</p>
                )}
                {storageStats.byCategory.map((cat) => {
                  const percent =
                    storageStats.totalSize > 0
                      ? (cat.size / storageStats.totalSize) * 100
                      : 0;
                  return (
                    <div key={cat.category} className="storage-bar">
                      <div className="storage-bar-label">
                        <span>{categoryLabel(cat.category)}</span>
                        <span className="muted">
                          {formatSize(cat.size)} · {cat.count.toLocaleString()}{" "}
                          fichier{cat.count > 1 ? "s" : ""}
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
                ? "Nouveau dossier"
                : dialog.type === "create-file"
                  ? "Nouveau fichier"
                  : dialog.type === "rename"
                    ? "Renommer"
                    : "Supprimer"
            }
            message={
              dialog.type === "delete"
                ? `Supprimer ${dialog.names.length === 1 ? `"${dialog.names[0]}"` : `${dialog.names.length} éléments`} ? Cette action est irréversible.`
                : undefined
            }
            inputLabel={
              dialog.type === "create-dir" || dialog.type === "create-file"
                ? "Nom"
                : dialog.type === "rename"
                  ? "Nouveau nom"
                  : undefined
            }
            inputValue={dialog.type === "rename" ? dialog.name : ""}
            confirmLabel={
              dialog.type === "create-dir"
                ? "Créer"
                : dialog.type === "create-file"
                  ? "Créer"
                  : dialog.type === "rename"
                    ? "Renommer"
                    : "Supprimer"
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
      <AppContent />
    </ThemeProvider>
  );
}
