import { useEffect, useRef } from "react";
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

/**
 * Liste de fichiers virtualisée.
 *
 * Utilise `@tanstack/react-virtual` pour ne rendre que les lignes visibles dans
 * la zone de défilement, ce qui garantit un défilement fluide même avec des
 * dizaines de milliers d'entrées. L'en-tête reste collé en haut.
 *
 * Le drag & drop interne est géré par Pointer Events (voir DragDropProvider) :
 * les lignes de dossier portent un attribut `data-drop-target="folder"` afin
 * que le hit-tester géométrique les reconnaisse comme cibles de drop (pour
 * déplacer/copier des fichiers dans le dossier). L'auto-scroll pendant le
 * drag est désormais piloté par le DragDropProvider via l'attribut
 * `data-scroll-container` posé sur cette section.
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
  const dragStartPos = useRef<{
    x: number;
    y: number;
    entry: FileEntry | null;
    pointerId: number;
    element: HTMLElement | null;
  }>({
    x: 0, y: 0, entry: null, pointerId: -1, element: null,
  });
  // Ref qui signale qu'un drag vient d'avoir lieu (pour ignorer le click
  // de fin de drag qui arriverait sinon sur la ligne).
  const didDragRef = useRef(false);

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

  // Détection du drag : quand l'utilisateur pointerdown sur une ligne puis
  // déplace la souris de plus de DRAG_THRESHOLD px, on initie un drag custom.
  // Utilise des Pointer Events + setPointerCapture (voir onPointerDown des
  // lignes) pour que le drag fonctionne de façon fiable sur Linux (WebKitGTK
  // tenterait sinon de lancer un drag de texte HTML5 natif qui casse tout).
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const start = dragStartPos.current;
      if (!start.entry) return;
      if (state.isDragging) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        didDragRef.current = true;
        const entry = start.entry;
        const paths =
          selectedPaths.size > 0 && selectedPaths.has(entry.path)
            ? [...selectedPaths]
            : [entry.path];
        startInternalDrag(paths, e.clientX, e.clientY);
      }
    };
    const handlePointerUp = () => {
      dragStartPos.current = {
        x: 0, y: 0, entry: null, pointerId: -1, element: null,
      };
    };
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [selectedPaths, startInternalDrag, state.isDragging]);

  // Feedback visuel de la cible de drop dossier survolée pendant le drag.
  const hoveredFolderPath =
    state.isDragging && state.hoveredTarget
      ? state.hoveredTarget.getAttribute("data-folder-path")
      : null;

  return (
    <section
      className="file-list"
      ref={scrollRef}
      data-scroll-container
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
            // Une ligne de dossier est une cible de drop (déplacer/copier des
            // fichiers dedans). On expose les attributs utilisés par le
            // hit-tester du DragDropProvider et par la branche "folder" du
            // handleInternalDrop.
            const isFolderDropTarget =
              entry.isDir && hoveredFolderPath === entry.path;

            return (
              <button
                key={entry.path}
                className={`file-row ${isSelected ? "selected" : ""} ${isCut ? "cut" : ""} ${isFolderDropTarget ? "drop-target-active" : ""}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                {...(entry.isDir
                  ? {
                      "data-drop-target": "folder",
                      "data-folder-path": entry.path,
                    }
                  : {})}
                onClick={(e) => {
                  // Si on était en train de draguer ou qu'un drag vient
                  // d'avoir lieu, on ignore le click de fin de drag.
                  if (state.isDragging || didDragRef.current) return;
                  onRowClick(e, entry);
                }}
                onContextMenu={(e) => onRowContextMenu(e, entry)}
                onDoubleClick={() => {
                  if (state.isDragging || didDragRef.current) return;
                  onRowDoubleClick(entry);
                }}
                onPointerDown={(e) => {
                  // NOTE : on n'appelle PAS e.preventDefault() ici — sur
                  // WebKitGTK, annuler pointerdown peut annuler toute la
                  // séquence pointermove/pointerup et donc empêcher le drag
                  // de démarrer. La prévention du drag de texte HTML5 natif
                  // est assurée par le CSS (.file-row user-select + drag none).
                  didDragRef.current = false;
                  // Capture le pointeur : garantit que pointermove/pointerup
                  // sont délivrés même si le curseur sort de la ligne.
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Certaines WebViews lèvent une erreur si le pointeur
                    // est déjà libéré — on ignore.
                  }
                  // Enregistre la position pour détecter click vs drag
                  // L'écouteur window pointermove (useEffect) vérifiera le seuil
                  dragStartPos.current = {
                    x: e.clientX,
                    y: e.clientY,
                    entry,
                    pointerId: e.pointerId,
                    element: e.currentTarget,
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
