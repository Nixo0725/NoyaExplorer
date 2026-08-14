import { useDragDropContext } from "./DragDropProvider";
import { useLanguage } from "../contexts/LanguageContext";
import FileIcon from "./FileIcon";
import { getTypeInfo } from "../lib/fileType";

/**
 * Overlay positionné au curseur qui affiche les informations du drag en cours.
 *
 * Reproduit le style de Windows Explorer :
 *  - Carte semi-transparente (icône + nom du fichier)
 *  - Badge de compteur en bas à droite quand plusieurs éléments sont dragués
 *  - Infobulle sous la carte indiquant l'action (Déplacer vers / Copier vers + cible)
 */
export default function DragPreview() {
  const { state } = useDragDropContext();
  const { t } = useLanguage();

  // La visibilité est contrôlée par la classe CSS body.dnd-active (gérée
  // par DragDropProvider) plutôt que par state.isDragging — c'est plus
  // fiable car le toggle CSS est synchrone (pas de batching React).
  // On ne rend rien s'il n'y a pas d'items à afficher.
  if (state.items.length === 0) return null;

  // Nom du premier élément (dernier segment du chemin)
  const firstPath = state.items[0];
  const firstName = firstPath.split(/[\\/]/).pop() || firstPath;
  const isDir =
    !firstName.includes(".") ||
    firstPath.endsWith("/") ||
    firstPath.endsWith("\\");

  // Catégorie de fichier pour l'icône
  const info = getTypeInfo(firstName, isDir);
  const count = state.items.length;

  // Nom de la cible de drop (dossier, favoris, espace…)
  const target = state.hoveredTarget;
  let targetName: string | null = null;
  if (target) {
    const folderPath = target.getAttribute("data-folder-path");
    const targetType = target.getAttribute("data-drop-target");
    if (folderPath) {
      targetName = folderPath.split(/[\\/]/).pop() || folderPath;
    } else if (targetType === "favorites") {
      targetName = t("sidebar.favorites");
    } else if (targetType === "space") {
      targetName = t("spaces.title");
    }
  }

  const actionLabel = state.copy ? t("drag.copy_to") : t("drag.move_to");

  return (
    <div
      className="drag-preview"
      style={{
        position: "fixed",
        zIndex: 9999,
        pointerEvents: "none",
        userSelect: "none",
        left: state.mouseX + 12,
        top: state.mouseY + 8,
      }}
    >
      {/* Carte principale : icône + nom */}
      <div className="drag-preview-card">
        <span className="drag-preview-card-icon">
          <FileIcon category={info.category} size={20} />
        </span>
        <span className="drag-preview-card-name">{firstName}</span>
        {count > 1 && (
          <span className="drag-preview-card-count">{count}</span>
        )}
      </div>

      {/* Infobulle d'action : "Déplacer vers Dossier" / "Copier vers Dossier" */}
      {targetName && (
        <div className={`drag-preview-action ${state.copy ? "copy" : "move"}`}>
          {actionLabel} {targetName}
        </div>
      )}
    </div>
  );
}
