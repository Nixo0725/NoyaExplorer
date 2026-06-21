import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { FolderTree, BarChart3, FolderOpen } from "lucide-react";
import "./App.css";
import type {
  FileEntry,
  StorageStats,
  SortKey,
  SortDirection,
  SpecialDir,
  DriveInfo,
} from "./types";
import { formatSize, formatDate } from "./lib/format";
import { getTypeInfo } from "./lib/fileType";
import { categoryLabel, typeLabel } from "./lib/category";
import { parentPath } from "./lib/path";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileIcon from "./components/FileIcon";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nom",
  size: "Taille",
  type: "Type",
  modified: "Date",
};

const LAST_PATH_KEY = "noya:lastPath";

function App() {
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
          await openPath(entry.path);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goUp, history.length]);

  return (
    <main className="app">
      <Sidebar
        homePath={homePath}
        specialDirs={specialDirs}
        drives={drives}
        currentPath={currentPath}
        onNavigate={(p) => void navigateTo(p)}
      />

      <div className="main-area">
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark"><FolderTree size={20} /></span>
            <span className="brand-name">Noya Explorer</span>
          </div>
          <div className="header-actions">
            {currentPath && (
              <button
                className="ghost-btn"
                onClick={() => void analyzeStorage()}
                disabled={analyzing}
                title="Analyser le stockage du dossier courant"
              >
                {analyzing ? "Analyse…" : (<><BarChart3 size={14} /> Analyser le stockage</>)}
              </button>
            )}
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
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {currentPath && (
          <div className="content">
            <section className="file-list">
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
                  return (
                    <button
                      key={entry.path}
                      className="file-row"
                      onClick={() => void openEntry(entry)}
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
      </div>
    </main>
  );
}

export default App;
