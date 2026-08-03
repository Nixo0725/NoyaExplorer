import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileEntry, SortKey, SortDirection } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { getTypeInfo } from "../lib/fileType";
import { typeLabel } from "../lib/category";
import FileIcon from "./FileIcon";
import { useLanguage } from "../contexts/LanguageContext";

interface SpacesViewProps {
  spaceId: string;
  spaceName: string;
  onNavigateToFolder: (path: string) => void;
}

/** Extrait le chemin du dossier parent depuis un chemin complet. */
function getSourceFolder(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return path;
  return normalized.slice(0, lastSlash);
}

/** Hauteur estimée d'une ligne (doit correspondre au CSS). */
const ROW_HEIGHT = 34;

/**
 * Vue agrégée du contenu d'un Space (espace de travail virtuel).
 *
 * Affiche tous les fichiers des dossiers rattachés au space dans une liste
 * unique, avec une colonne "Dossier source" permettant de tracer l'origine
 * de chaque fichier. Les dossiers sont cliquables pour naviguer.
 */
export default function SpacesView({
  spaceId,
  spaceName,
  onNavigateToFolder,
}: SpacesViewProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  /* ---------- Chargement des entrées du space ---------- */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await invoke<FileEntry[]>("list_space_entries", {
          id: spaceId,
        });
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  /* ---------- Tri ---------- */

  const handleToggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...entries].sort((a, b) => {
      // Dossiers en premier
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "modified":
          cmp = a.modified - b.modified;
          break;
        case "type": {
          const ta = getTypeInfo(a.name, a.isDir).category;
          const tb = getTypeInfo(b.name, b.isDir).category;
          cmp = ta.localeCompare(tb);
          break;
        }
      }
      if (cmp === 0) {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      return cmp * dir;
    });
  }, [entries, sortKey, sortDir]);

  /* ---------- Virtualisation ---------- */

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  /* ---------- Navigation ---------- */

  const handleRowDoubleClick = (entry: FileEntry) => {
    if (entry.isDir) {
      onNavigateToFolder(entry.path);
    }
  };

  /* ---------- États ---------- */

  if (loading) {
    return (
      <div className="content">
        <h2 className="space-title">{spaceName}</h2>
        <div className="status">{t("app.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content">
        <h2 className="space-title">{spaceName}</h2>
        <div className="status error">{error}</div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="content">
        <h2 className="space-title">{spaceName}</h2>
        <div className="status">{t("spaces.no_folders")}</div>
      </div>
    );
  }

  return (
    <div className="content">
      <h2 className="space-title">{spaceName}</h2>

      <section className="file-list space-file-list" ref={scrollRef}>
        {/* En-tête */}
        <div className="list-header space-list-header">
          <span className="col-icon" />
          <button
            className={`col-header ${sortKey === "name" ? `active ${sortDir}` : ""}`}
            onClick={() => handleToggleSort("name")}
          >
            {t("sort.name")}
          </button>
          <button
            className={`col-header col-size ${sortKey === "size" ? `active ${sortDir}` : ""}`}
            onClick={() => handleToggleSort("size")}
          >
            {t("sort.size")}
          </button>
          <button
            className={`col-header col-type ${sortKey === "type" ? `active ${sortDir}` : ""}`}
            onClick={() => handleToggleSort("type")}
          >
            {t("sort.type")}
          </button>
          <button
            className={`col-header col-date ${sortKey === "modified" ? `active ${sortDir}` : ""}`}
            onClick={() => handleToggleSort("modified")}
          >
            {t("sort.modified")}
          </button>
          <span className="col-header col-source">{t("spaces.source_folder")}</span>
        </div>

        {/* Lignes virtualisées */}
        <div
          className="virtual-rows"
          style={{ height: `${totalHeight}px`, position: "relative" }}
        >
          {items.map((virtualItem) => {
            const entry = sorted[virtualItem.index];
            const info = getTypeInfo(entry.name, entry.isDir);
            const source = getSourceFolder(entry.path);

            return (
              <button
                key={entry.path}
                className="file-row space-file-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onDoubleClick={() => handleRowDoubleClick(entry)}
                title={entry.path}
              >
                <span className="file-icon">
                  <FileIcon category={info.category} />
                </span>
                <span className="file-name">{entry.name}</span>
                <span className="file-size">
                  {entry.isDir ? "—" : formatSize(entry.size)}
                </span>
                <span className="file-type">
                  {typeLabel(t, entry.name, entry.isDir)}
                </span>
                <span className="file-date">{formatDate(entry.modified)}</span>
                <span className="file-source">
                  <button
                        className="source-folder-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToFolder(source);
                        }}
                        title={source}
                      >
                        {source}
                      </button>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
