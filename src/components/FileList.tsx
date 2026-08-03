import { useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileEntry, SortKey, SortDirection } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { getTypeInfo } from "../lib/fileType";
import { typeLabel } from "../lib/category";
import FileIcon from "./FileIcon";
import { useLanguage } from "../contexts/LanguageContext";
import { useDragDropContext } from "./DragDropProvider";

/** Distance minimale (px) de mouvement pour initier un drag (anti-accroc) */
const DRAG_THRESHOLD = 5;

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

/** Seuil (px) depuis le bord pour déclencher l'auto-scroll */
const SCROLL_THRESHOLD = 50;
/** Vitesse maximale de l'auto-scroll (px par frame) */
const MAX_SCROLL_SPEED = 10;

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
  const { startInternalDrag, state } = useDragDropContext();
  // Ref pour détecter click vs drag
  const dragStartPos = useRef<{ x: number; y: number; entry: FileEntry | null }>({
    x: 0, y: 0, entry: null,
  });

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

  // Détection du drag : quand l'utilisateur mousedown sur une ligne puis
  // déplace la souris de plus de DRAG_THRESHOLD px, on initie un drag custom.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const start = dragStartPos.current;
      if (!start.entry) return;
      if (state.isDragging) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        const entry = start.entry;
        const paths =
          selectedPaths.size > 0 && selectedPaths.has(entry.path)
            ? [...selectedPaths]
            : [entry.path];
        startInternalDrag(paths, e.clientX, e.clientY);
      }
    };
    const handleMouseUp = () => {
      dragStartPos.current = { x: 0, y: 0, entry: null };
    };
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [selectedPaths, startInternalDrag, state.isDragging]);

  /* ---------- Auto-scroll pendant le drag ---------- */

  const autoScrollRef = useRef<number | null>(null);

  // Nettoie l'animation au démontage
  useEffect(() => {
    return () => {
      if (autoScrollRef.current !== null) {
        cancelAnimationFrame(autoScrollRef.current);
      }
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const el = scrollRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Annule toute animation en cours
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }

    if (y < SCROLL_THRESHOLD) {
      // Curseur près du bord supérieur → scroll vers le haut
      const factor = 1 - y / SCROLL_THRESHOLD;
      const speed = Math.min(factor, 1) * MAX_SCROLL_SPEED;
      const scroll = () => {
        if (el) {
          el.scrollTop -= speed;
          autoScrollRef.current = requestAnimationFrame(scroll);
        }
      };
      autoScrollRef.current = requestAnimationFrame(scroll);
    } else if (y > height - SCROLL_THRESHOLD) {
      // Curseur près du bord inférieur → scroll vers le bas
      const factor = (y - (height - SCROLL_THRESHOLD)) / SCROLL_THRESHOLD;
      const speed = Math.min(factor, 1) * MAX_SCROLL_SPEED;
      const scroll = () => {
        if (el) {
          el.scrollTop += speed;
          autoScrollRef.current = requestAnimationFrame(scroll);
        }
      };
      autoScrollRef.current = requestAnimationFrame(scroll);
    }
  }, []);

  return (
    <section
      className="file-list"
      ref={scrollRef}
      onContextMenu={onBackgroundContextMenu}
      onClick={onBackgroundClick}
      onDragOver={handleDragOver}
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
                onClick={(e) => {
                  // Si on était en train de draguer, on ignore le click
                  if (state.isDragging) return;
                  onRowClick(e, entry);
                }}
                onContextMenu={(e) => onRowContextMenu(e, entry)}
                onDoubleClick={() => {
                  if (state.isDragging) return;
                  onRowDoubleClick(entry);
                }}
                onMouseDown={(e) => {
                  // Enregistre la position pour détecter click vs drag
                  // L'écouteur window mousemove (useEffect) vérifiera le seuil
                  dragStartPos.current = {
                    x: e.clientX,
                    y: e.clientY,
                    entry,
                  };
                }}
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
