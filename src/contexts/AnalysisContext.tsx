import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GlobalAnalysis } from "../types";

/** Intervalle de resynchronisation du cache (10 minutes). */
const RESYNC_INTERVAL_MS = 10 * 60 * 1000;

interface AnalysisContextValue {
  /** Analyse globale (depuis le cache ou un scan frais). */
  analysis: GlobalAnalysis | null;
  /** Vrai pendant le premier scan (cache vide). */
  loading: boolean;
  /** Vrai pendant une resynchronisation en arrière-plan. */
  refreshing: boolean;
  error: string | null;
  /** Date du dernier scan effectif (ms). */
  lastUpdated: number | null;
  /** Relance un scan complet et met à jour le cache. */
  refresh: () => Promise<void>;
  /** Met à jour localement l'analyse (ex. après une suppression). */
  mutate: (updater: (a: GlobalAnalysis) => GlobalAnalysis) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

/**
 * Fournit l'analyse globale du stockage à toute l'application.
 *
 * - Au montage : lit le cache persistant (`get_cached_analysis`) ; s'il est
 *   absent, lance un premier scan complet (`analyze_global`).
 * - Puis : une vérification de synchronisation périodique relance un scan
 *   complet en arrière-plan pour garder le cache à jour.
 */
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analysis, setAnalysis] = useState<GlobalAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Garde une référence stable à la dernière analyse pour l'intervalle
  const analysisRef = useRef<GlobalAnalysis | null>(null);
  analysisRef.current = analysis;

  /** Lance un scan complet et met à jour l'état + le cache. */
  const refresh = useMemo(
    () => async () => {
      setRefreshing(true);
      setError(null);
      try {
        const result = await invoke<GlobalAnalysis>("analyze_global");
        setAnalysis(result);
        setLastUpdated(result.scannedAt);
      } catch (err) {
        setError(String(err));
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  /** Met à jour l'analyse en mémoire (sans réécrire le cache). */
  const mutate = useMemo(
    () => (updater: (a: GlobalAnalysis) => GlobalAnalysis) => {
      setAnalysis((prev) => (prev ? updater(prev) : prev));
    },
    [],
  );

  /* ---------- Chargement initial ---------- */

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        // 1. Tente de lire le cache persistant
        const cached = await invoke<GlobalAnalysis | null>(
          "get_cached_analysis",
        );
        if (cancelled) return;

        if (cached) {
          setAnalysis(cached);
          setLastUpdated(cached.scannedAt);
        } else {
          // 2. Premier démarrage : scan complet
          const result = await invoke<GlobalAnalysis>("analyze_global");
          if (cancelled) return;
          setAnalysis(result);
          setLastUpdated(result.scannedAt);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- Resynchronisation périodique ---------- */

  useEffect(() => {
    const interval = setInterval(() => {
      // Ne pas lancer deux scans simultanés
      if (analysisRef.current === null) return;
      void refresh();
    }, RESYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh]);

  const value = useMemo(
    () => ({ analysis, loading, refreshing, error, lastUpdated, refresh, mutate }),
    [analysis, loading, refreshing, error, lastUpdated, refresh, mutate],
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis doit être utilisé dans un AnalysisProvider");
  }
  return ctx;
}
