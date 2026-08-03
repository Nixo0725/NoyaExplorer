import { Folder, FileText, ArrowRight } from "lucide-react";
import { useDragDropContext } from "./DragDropProvider";

/**
 * Overlay positionné au curseur qui affiche les informations du drag en cours.
 * Utilise les refs DOM pour un suivi 60fps via le provider.
 */
export default function DragPreview() {
  const { state } = useDragDropContext();

  if (!state.isDragging) return null;

  const firstName =
    state.items.length > 0
      ? (state.items[0].split(/[\\/]/).pop() ?? state.items[0])
      : "";
  const isDir =
    state.items.length > 0 &&
    (!firstName.includes(".") ||
      state.items[0].endsWith("/") ||
      state.items[0].endsWith("\\"));

  return (
    <div
      className="drag-preview"
      style={{
        position: "fixed",
        zIndex: 9999,
        pointerEvents: "none",
        userSelect: "none",
        left: state.mouseX + 14,
        top: state.mouseY - 10,
      }}
    >
      <div className="drag-preview-inner">
        <span className="drag-preview-icon">
          {isDir ? <Folder size={14} /> : <FileText size={14} />}
        </span>
        <span className="drag-preview-name">
          {firstName}
          {state.items.length > 1 && (
            <span className="drag-preview-count">
              {" "}+{state.items.length - 1}
            </span>
          )}
        </span>
        <span className="drag-preview-badge move">
          <ArrowRight size={10} />
          Déplacer
        </span>
      </div>
    </div>
  );
}
