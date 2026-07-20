import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileEntry, SortKey, SortDirection } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { getTypeInfo } from "../lib/fileType";
import { typeLabel } from "../lib/category";
import FileIcon from "./FileIcon";
import { useLanguage } from "../contexts/LanguageContext";

interface FileListProps {
  entries: FileEntry[];
  folderSizes: Record<string, number>;
  selectedPaths: Set<string>;
  cutPaths: Set<string>;
  sortKey: SortKey;
  sortDir: SortDirection;
  loading: boolean;
  search: string;
  onToggleSort: (key: SortKey) => void;
  onRowClick: (e: React.MouseEvent, entry: FileEntry) => void;
  onRowContextMenu: (e: React.MouseEvent, entry?: FileEntry) => void;
  onRowDoubleClick: (entry: FileEntry) => void;
  onBackgroundContextMenu: (e: React.MouseEvent) => void;
  onBackgroundClick: (e: React.MouseEvent) => void;
  /** Rendu optionnel d'un bouton d'action par ligne (ex. épingler). */
  rowAction?: (entry: FileEntry) => React.ReactNode;
  /** Notifie le parent des entrées actuellement visibles (pour le calcul lazy des tailles). */
  onVisibleEntriesChange?: (visible: FileEntry[]) => void;
}

/** Hauteur estimée d'une ligne de fichier (en px). Doit correspondre au CSS. */
const ROW_HEIGHT = 34;

/**
 * Liste de fichiers virtualisée.
 *
 * Utilise `@tanstack/react-virtual` pour ne rendre que les lignes visibles dans
 * la zone de défilement, ce qui garantit un défilement fluide même avec des
 * dizaines de milliers d'entrées. L'en-tête reste collé en haut.
 */
function FileList({
  entries,
  folderSizes,
  selectedPaths,
  cutPaths,
  sortKey,
  sortDir,
  loading,
  search,
  onToggleSort,
  onRowClick,
  onRowContextMenu,
  onRowDoubleClick,
  onBackgroundContextMenu,
  onBackgroundClick,
  rowAction,
  onVisibleEntriesChange,
}: FileListProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  // Notifie le parent des entrées visibles pour permettre le calcul lazy
  // des tailles de dossier uniquement pour les dossiers à l'écran.
  useEffect(() => {
    if (!onVisibleEntriesChange) return;
    const visible = items.map((vi) => entries[vi.index]).filter(Boolean);
    onVisibleEntriesChange(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, entries]);

  return (
    <section
      className="file-list"
      ref={scrollRef}
      onContextMenu={onBackgroundContextMenu}
      onClick={onBackgroundClick}
    >
      <div className="list-header">
        <span className="col-icon" />
        <button
          className={`col-header ${sortKey === "name" ? `active ${sortDir}` : ""}`}
          onClick={() => onToggleSort("name")}
        >
          {t("sort.name")}
        </button>
        <button
          className={`col-header col-size ${sortKey === "size" ? `active ${sortDir}` : ""}`}
          onClick={() => onToggleSort("size")}
        >
          {t("sort.size")}
        </button>
        <button
          className={`col-header col-type ${sortKey === "type" ? `active ${sortDir}` : ""}`}
          onClick={() => onToggleSort("type")}
        >
          {t("sort.type")}
        </button>
        <button
          className={`col-header col-date ${sortKey === "modified" ? `active ${sortDir}` : ""}`}
          onClick={() => onToggleSort("modified")}
        >
          {t("sort.modified")}
        </button>
      </div>

      {loading && <div className="status">{t("app.loading")}</div>}
      {!loading && entries.length === 0 && (
        <div className="status">
          {search ? t("app.no_results") : t("app.empty_folder")}
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div
          className="virtual-rows"
          style={{ height: `${totalHeight}px`, position: "relative" }}
        >
          {items.map((virtualItem) => {
            const entry = entries[virtualItem.index];
            const info = getTypeInfo(entry.name, entry.isDir);
            const size = entry.isDir ? folderSizes[entry.path] : entry.size;
            const isSelected = selectedPaths.has(entry.path);
            const isCut = cutPaths.has(entry.path);

            return (
              <button
                key={entry.path}
                className={`file-row ${isSelected ? "selected" : ""} ${isCut ? "cut" : ""}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={(e) => onRowClick(e, entry)}
                onContextMenu={(e) => onRowContextMenu(e, entry)}
                onDoubleClick={() => onRowDoubleClick(entry)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", entry.path);
                  e.dataTransfer.setData("application/x-noya-entry", entry.path);
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                draggable
                title={entry.path}
              >
                <span className="file-icon">
                  <FileIcon category={info.category} />
                </span>
                <span className="file-name">{entry.name}</span>
                <span className="file-size">
                  {entry.isDir
                    ? size !== undefined
                      ? formatSize(size)
                      : "…"
                    : formatSize(entry.size)}
                </span>
                <span className="file-type">
                  {typeLabel(t, entry.name, entry.isDir)}
                </span>
                <span className="file-date">{formatDate(entry.modified)}</span>
                {rowAction && (
                  <span
                    className="row-action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowAction(entry)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default FileList;