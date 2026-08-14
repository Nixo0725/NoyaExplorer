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
  /** Position actuelle du curseur */
  mouseX: number;
  mouseY: number;
  /** Cible de drop actuellement survolée (pour le feedback visuel) */
  hoveredTarget: Element | null;
  /** Vrai si Ctrl/Cmd est maintenu → l'opération sera une copie au lieu d'un déplacement */
  copy: boolean;
}

export interface DragDropContextValue {
  state: DragDropState;
  /** Déclenche un drag interne (appelé depuis onPointerDown des lignes) */
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
  hoveredTarget: null,
  copy: false,
};

/** Seuil (px) depuis le bord d'un conteneur scrollable pour déclencher l'auto-scroll */
const SCROLL_THRESHOLD = 50;
/** Vitesse maximale de l'auto-scroll (px par frame) */
const MAX_SCROLL_SPEED = 12;

interface DragDropProviderProps {
  children: React.ReactNode;
  /** Appelé quand un drop interne aboutit sur une cible valide. `copy` indique
   * si l'utilisateur maintenait Ctrl/Cmd (copie au lieu de déplacement). */
  onDrop?: (items: string[], targetEl: Element, copy: boolean) => void;
}

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [state, setState] = useState<DragDropState>(INITIAL_STATE);
  // Compteur incrémenté à chaque endDrag pour forcer un re-render du
  // Provider (et donc des consommateurs du contexte comme DragPreview),
  // même si le setState principal ne déclenche pas de re-render.
  const [, setTick] = useState(0);
  const isDraggingRef = useRef(false);

  // Ref pour la position du curseur (évite de dépendre du state React)
  const posRef = useRef({ x: 0, y: 0 });
  // Items en cours de drag
  const itemsRef = useRef<string[]>([]);
  // Cible survolée (ref pour ne pas re-créer les listeners à chaque move)
  const hoveredRef = useRef<Element | null>(null);
  // Modificateur copie (Ctrl/Cmd)
  const copyRef = useRef(false);
  // Ref pour onDrop (évite de casser les listeners synchrones)
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  // Handle de la boucle d'auto-scroll (rAF)
  const autoScrollRef = useRef<number | null>(null);
  // Ref vers endDrag pour permettre aux handlers stables de le résoudre
  const endDragRef = useRef<() => void>(() => {});

  /**
   * Boucle d'auto-scroll pilotée par Pointer Events : tant qu'un drag est
   * actif, on lit la position courante du curseur (posRef) et on fait
   * défiler tout conteneur marqué [data-scroll-container] dont le bord
   * supérieur ou inférieur est proche du curseur. Cela remplace l'ancien
   * auto-scroll basé sur HTML5 `dragover` (qui ne se déclenche jamais dans
   * WebView2 quand `dragDropEnabled` est true).
   */
  const startAutoScroll = useCallback(() => {
    // Annule une éventuelle boucle précédente
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
    }
    const tick = () => {
      if (!isDraggingRef.current) {
        autoScrollRef.current = null;
        return;
      }
      const { x, y } = posRef.current;
      const containers = document.querySelectorAll<HTMLElement>(
        "[data-scroll-container]",
      );
      for (const el of containers) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        // Ne scroll que si le curseur est dans la largeur du conteneur
        if (x < rect.left || x > rect.right) continue;
        if (y >= rect.top && y < rect.top + SCROLL_THRESHOLD) {
          const factor = 1 - (y - rect.top) / SCROLL_THRESHOLD;
          el.scrollTop -= Math.min(Math.max(factor, 0), 1) * MAX_SCROLL_SPEED;
        } else if (y > rect.bottom - SCROLL_THRESHOLD && y <= rect.bottom) {
          const factor = (y - (rect.bottom - SCROLL_THRESHOLD)) / SCROLL_THRESHOLD;
          el.scrollTop += Math.min(Math.max(factor, 0), 1) * MAX_SCROLL_SPEED;
        }
      }
      autoScrollRef.current = requestAnimationFrame(tick);
    };
    autoScrollRef.current = requestAnimationFrame(tick);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const x = e.clientX;
    const y = e.clientY;
    posRef.current = { x, y };
    const copy = e.ctrlKey || e.metaKey;
    copyRef.current = copy;

    // Hit-testing géométrique : détermine la cible de drop sous le curseur
    // indépendamment de elementFromPoint (qui peut être perturbé par la
    // capture du pointeur ou par le preview pendant le drag).
    const target = hitTestDropTargets(x, y);
    hoveredRef.current = target;

    setState((prev) =>
      prev.isDragging
        ? { ...prev, mouseX: x, mouseY: y, hoveredTarget: target, copy }
        : prev,
    );
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    console.debug("[DragDrop] pointerup fired; isDraggingRef=", isDraggingRef.current);
    if (!isDraggingRef.current) return;

    // Priorité : la cible suivie pendant le drag (dernier pointermove).
    let dropTarget = hoveredRef.current;

    // Sécurité : re-test au moment du relâchement si besoin.
    if (!dropTarget) {
      dropTarget = hitTestDropTargets(e.clientX, e.clientY);
    }

    // Fallback ultime : elementFromPoint + remontée des parents.
    if (!dropTarget) {
      dropTarget = findDropTarget(
        document.elementFromPoint(e.clientX, e.clientY),
      );
    }

    const copy = e.ctrlKey || e.metaKey;
    // try/finally : garantit que endDrag est TOUJOURS appelé, même si
    // le callback onDrop lève une exception. Sans cela, l'animation
    // (bulle + curseur grabbing) resterait affichée après le drop.
    try {
      if (dropTarget && onDropRef.current) {
        onDropRef.current(itemsRef.current, dropTarget, copy);
      }
    } finally {
      endDragRef.current();
    }
  }, []);

  const handlePointerCancel = useCallback(() => {
    if (!isDraggingRef.current) return;
    endDragRef.current();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && isDraggingRef.current) {
      endDragRef.current();
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return; // évite double-reset + boucle
    console.debug("[DnD] endDrag; isDragging=", isDraggingRef.current);
    isDraggingRef.current = false;
    itemsRef.current = [];
    hoveredRef.current = null;
    copyRef.current = false;

    // Arrête l'auto-scroll
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }

    // Restaure les styles globaux
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.body.style.touchAction = "";
    // Retire la classe CSS qui contrôle la visibilité de la prévisualisation.
    // C'est fait de manière synchrone (pas de batching React) → la carte
    // disparaît immédiatement, même si le setState est différé.
    document.body.classList.remove("dnd-active");

    // Détache les listeners (no-op si non attachés)
    window.removeEventListener("pointermove", handlePointerMove, true);
    window.removeEventListener("pointerup", handlePointerUp, true);
    window.removeEventListener("pointercancel", handlePointerCancel, true);
    window.removeEventListener("keydown", handleKeyDown, true);

    // Objet frais (pas la constante INITIAL_STATE) pour garantir que
    // React détecte un changement de référence et déclenche un re-render.
    setState({ ...INITIAL_STATE });
    // Force un re-render du Provider (et donc des consommateurs du contexte)
    // en incrémentant un compteur indépendant. C'est le filet de sécurité
    // ultime : même si le setState ci-dessus ne déclenche pas de re-render
    // (problème de batching React 19 dans le WebView Tauri), le setTick
    // garantit que le Provider re-render et que la nouvelle valeur du
    // contexte (avec state.isDragging = false) est propagée.
    setTick((t) => t + 1);
  }, [handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown]);

  endDragRef.current = endDrag;

  /**
   * Déclenche un drag INTERNE (basé sur pointerdown/pointermove/pointerup).
   * On n'utilise PAS l'API HTML5 Drag & Drop (cassée dans WebView2 pour les
   * éléments virtualisés) — à la place, on suit le pointeur et on détecte
   * la cible par hit-testing géométrique (robuste sur toutes les WebViews).
   *
   * Les listeners `pointerup`/`pointercancel` sont attachés SYNCHRONOUSMENT
   * ici (et non dans un useEffect) afin qu'un relâchement très rapide ne
   * soit jamais manqué : un useEffect ne s'exécute qu'après le rendu, et un
   * `pointerup` survenu entre-temps serait perdu, laissant l'app bloquée en
   * état "dragging".
   */
  const startInternalDrag = useCallback(
    (items: string[], clientX: number, clientY: number) => {
      if (items.length === 0) return;
      // Garde contre une ré-entrée pendant un drag déjà actif
      if (isDraggingRef.current) return;

      itemsRef.current = items;
      posRef.current = { x: clientX, y: clientY };
      hoveredRef.current = null;
      copyRef.current = false;
      isDraggingRef.current = true;

      // Attache les listeners globaux immédiatement (capture phase).
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerCancel, true);
      window.addEventListener("keydown", handleKeyDown, true);

      // Pendant le drag, on change le curseur global et on bloque la sélection
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.body.style.touchAction = "none";
      // Classe CSS sur le body pour contrôler la visibilité de la
      // prévisualisation (plus fiable que le state React — bypass
      // le batching et garantit que la carte disparaît au relâchement).
      document.body.classList.add("dnd-active");

      // Démarre l'auto-scroll piloté par Pointer Events
      startAutoScroll();

      console.debug("[DragDrop] startInternalDrag; items=", items, "clientX/Y=", clientX, clientY);
      setState({
        isDragging: true,
        items,
        operation: "move",
        sourceType: "files",
        mouseX: clientX,
        mouseY: clientY,
        hoveredTarget: null,
        copy: false,
      });
    },
    [
      handlePointerMove,
      handlePointerUp,
      handlePointerCancel,
      handleKeyDown,
      startAutoScroll,
    ],
  );

  // Nettoyage au démontage : arrête l'auto-scroll et détache les listeners
  // si un drag était encore actif.
  useEffect(() => {
    return () => {
      if (autoScrollRef.current !== null) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown]);

  const value: DragDropContextValue = {
    state,
    startInternalDrag,
    endDrag,
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}

/**
 * Hit-test géométrique : renvoie la cible de drop la plus proche du curseur
 * parmi toutes les cibles enregistrées via [data-drop-target] ou .droppable.
 * On sélectionne le rectangle contenant le curseur le plus petit (le plus
 * spécifique), ce qui privilégie un Space individuel plutôt que la section
 * entière.
 */
function hitTestDropTargets(x: number, y: number): Element | null {
  const candidates = document.querySelectorAll<Element>(
    "[data-drop-target], .droppable",
  );
  let best: Element | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      continue;
    }

    const area = rect.width * rect.height;
    if (area < bestArea) {
      bestArea = area;
      best = el;
    }
  }
  return best;
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
