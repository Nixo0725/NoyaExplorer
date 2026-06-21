import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";
import type { FileEntry } from "./types";
import { formatSize, formatDate } from "./lib/format";
import { getTypeInfo } from "./lib/fileType";

function App() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileEntry[]>("list_dir", { path });
      setEntries(result);
      setCurrentPath(path);
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const chooseFolder = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setHistory([]);
      await loadDirectory(selected);
    }
  }, [loadDirectory]);

  const navigateTo = useCallback(
    async (path: string) => {
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      await loadDirectory(path);
    },
    [currentPath, loadDirectory],
  );

  const goBack = useCallback(async () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previous = next.pop()!;
      void loadDirectory(previous);
      return next;
    });
  }, [loadDirectory]);

  const goUp = useCallback(async () => {
    if (!currentPath) return;
    const normalized = currentPath.replace(/\//g, "\\");
    const parts = normalized.split("\\").filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    const parent = parts.join("\\") + "\\";
    await navigateTo(parent);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (history.length > 0) {
        e.preventDefault();
        void goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, history.length]);

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">🗂️</span>
          <span className="brand-name">Noya Explorer</span>
        </div>
        <button className="choose-btn" onClick={() => void chooseFolder()}>
          Choisir un dossier
        </button>
      </header>

      {currentPath && (
        <div className="toolbar">
          <button
            className="icon-btn"
            onClick={() => void goBack()}
            disabled={history.length === 0}
            title="Retour"
          >
            ←
          </button>
          <button
            className="icon-btn"
            onClick={() => void goUp()}
            title="Dossier parent"
          >
            ↑
          </button>
          <div className="path" title={currentPath}>
            {currentPath}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {!currentPath && !error && (
        <section className="empty-state">
          <h1>Explorez vos fichiers plus intelligemment.</h1>
          <p>
            Sélectionnez un dossier pour commencer à parcourir son contenu.
          </p>
        </section>
      )}

      {currentPath && (
        <section className="file-list">
          {loading && <div className="status">Chargement…</div>}
          {!loading && entries.length === 0 && (
            <div className="status">Ce dossier est vide.</div>
          )}
          {!loading &&
            entries.map((entry) => {
              const info = getTypeInfo(entry.name, entry.isDir);
              return (
                <button
                  key={entry.path}
                  className="file-row"
                  onClick={() => void openEntry(entry)}
                  title={entry.path}
                >
                  <span className="file-icon">{info.icon}</span>
                  <span className="file-name">{entry.name}</span>
                  <span className="file-size">
                    {entry.isDir ? "—" : formatSize(entry.size)}
                  </span>
                  <span className="file-date">{formatDate(entry.modified)}</span>
                </button>
              );
            })}
        </section>
      )}
    </main>
  );
}

export default App;
