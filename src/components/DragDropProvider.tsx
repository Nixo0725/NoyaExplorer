import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface DragDropState {
  isDragging: boolean;
  items: string[];
  operation: "move" | "copy" | "link" | null;
  sourceType: "files" | "search" | "external" | null;
  /** Position actuelle du curseur (mise à jour en RAF) */
  mouseX: number;
  mouseY: number;
}

export interface DragDropContextValue {
  state: DragDropState;
  /** Déclenche un drag interne (appelé depuis onMouseDown des lignes) */
  startInternalDrag: (
    items: string[],
    clientX: number,
    clientY: number,
  ) => void;
  endDrag: () => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export function useDragDropContext(): DragDropContextValue {
  const ctx = useContext(DragDropContext);
  if (!ctx) {
    throw new Error(
      "useDragDropContext must be used within a DragDropProvider",
    );
  }
  return ctx;
}

const INITIAL_STATE: DragDropState = {
  isDragging: false,
  items: [],
  operation: null,
  sourceType: null,
  mouseX: 0,
  mouseY: 0,
};

interface DragDropProviderProps {
  children: React.ReactNode;
  onDrop?: (items: string[], targetEl: Element) => void;
}

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [state, setState] = useState<DragDropState>(INITIAL_STATE);
  const isDraggingRef = useRef(false);

  // Ref pour la position (évite React state pendant le drag → 60fps)
  const posRef = useRef({ x: 0, y: 0 });
  // Ref pour le preview DOM element
  const previewRef = useRef<HTMLDivElement | null>(null);
  // Items en cours de drag
  const itemsRef = useRef<string[]>([]);
  // Ref pour onDrop (évite de casser le useEffect)
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  /**
   * Déclenche un drag INTERNE (basé sur mousedown/mousemove/mouseup).
   * Fonctionne avec TOUS les navigateurs/WebViews car on n'utilise PAS
   * l'API HTML5 Drag & Drop (qui est cassée dans WebView2 pour les
   * éléments virtualisés).
   */
  const startInternalDrag = useCallback(
    (items: string[], clientX: number, clientY: number) => {
      if (items.length === 0) return;
      itemsRef.current = items;
      posRef.current = { x: clientX, y: clientY };
      isDraggingRef.current = true;

      setState({
        isDragging: true,
        items,
        operation: "move",
        sourceType: "files",
        mouseX: clientX,
        mouseY: clientY,
      });
    },
    [],
  );

  const endDrag = useCallback(() => {
    isDraggingRef.current = false;
    itemsRef.current = [];
    setState(INITIAL_STATE);
  }, []);

  // Listener global mousemove/mouseup pour le suivi du drag
  useEffect(() => {
    if (!state.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      posRef.current = { x: e.clientX, y: e.clientY };

      // Mise à jour directe du DOM pour le preview (60fps)
      if (previewRef.current) {
        previewRef.current.style.left = `${e.clientX + 14}px`;
        previewRef.current.style.top = `${e.clientY - 10}px`;
      }

      // Met aussi à jour le state React pour les consommateurs
      setState((prev) =>
        prev.isDragging
          ? { ...prev, mouseX: e.clientX, mouseY: e.clientY }
          : prev,
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      // Trouve l'élément sous le curseur
      const target = document.elementFromPoint(e.clientX, e.clientY);

      // Vérifie si le drop est sur un élément qui accepte les drops
      // en vérifiant la présence d'attributs data-drop-target ou de classes droppable
      const dropTarget = findDropTarget(target);

      if (dropTarget && onDropRef.current) {
        onDropRef.current(itemsRef.current, dropTarget);
      }

      endDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDraggingRef.current) {
        endDrag();
      }
    };

    // Pendant le drag, on change le curseur global
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [state.isDragging, endDrag]);

  const value: DragDropContextValue = {
    state,
    startInternalDrag,
    endDrag,
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
      {/* Preview positionné via le ref (manipulé directement en RAF) */}
    </DragDropContext.Provider>
  );
}

/**
 * Remonte la chaîne des parents pour trouver un élément qui accepte les drops.
 * Vérifie la présence d'attributs data-drop-target ou de classes droppable.
 */
function findDropTarget(el: Element | null): Element | null {
  let current = el;
  while (current) {
    if (
      current.hasAttribute("data-drop-target") ||
      current.classList.contains("droppable")
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
