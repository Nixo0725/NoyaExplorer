import { useState, useMemo } from "react";
import { HardDrive, RefreshCw, FolderOpen } from "lucide-react";
import type { BiggestFolder } from "../types";
import { formatSize } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";
import { useAnalysis } from "../contexts/AnalysisContext";

/* ---------- Types internes ---------- */

type SortKey = "name" | "path" | "totalSize" | "fileCount";
type SortDir = "asc" | "desc";

const LIMIT_OPTIONS = [10, 50, 100] as const;

/* ---------- Composant ---------- */

interface BiggestFoldersViewProps {
  /** Callback de navigation vers un dossier (double‑clic ou bouton). */
  onNavigate: (path: string) => void;
}

/**
 * Page "Plus gros dossiers".
 *
 * Utilise l'analyse globale mise en cache (`AnalysisContext`) : aucun choix
 * de disque n'est nécessaire. Le Top N est appliqué côté client.
 */
function BiggestFoldersView({ onNavigate }: BiggestFoldersViewProps) {
  const { t } = useLanguage();
  const { analysis, loading, refreshing, error, refresh } = useAnalysis();

  /* ---------- État ---------- */

  const [limit, setLimit] = useState<number>(100);
  const [sortKey, setSortKey] = useState<SortKey>("totalSize");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const folders: BiggestFolder[] = analysis?.biggestFolders ?? [];

  /* ---------- Tri ---------- */

  const handleToggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // Par défaut : descendant pour les colonnes numériques, ascendant pour le texte
      setSortKey(key);
      setSortDir(key === "name" || key === "path" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...folders]
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "name":
            cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            break;
          case "path":
            cmp = a.path.toLowerCase().localeCompare(b.path.toLowerCase());
            break;
          case "totalSize":
            cmp = a.totalSize - b.totalSize;
            break;
          case "fileCount":
            cmp = a.fileCount - b.fileCount;
            break;
        }
        if (cmp === 0) {
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        return cmp * dir;
      })
      .slice(0, limit);
  }, [folders, sortKey, sortDir, limit]);

  /* ---------- Navigation ---------- */

  const handleNavigate = (path: string) => {
    onNavigate(path);
  };

  /* ---------- Rendu ---------- */

  return (
    <div className="content">
      <div className="biggest-view">
        {/* Titre */}
        <h1 className="view-title">{t("biggest_folders.title")}</h1>

        {/* Barre d'outils */}
        <div className="toolbar">
          {analysis && (
            <span className="ghost-btn" style={{ cursor: "default" }}>
              <HardDrive size={14} />
              <span>{t("analysis.root", { root: analysis.root })}</span>
            </span>
          )}

          <span className="toolbar-sep" />

          {/* Sélecteur Top N */}
          <label className="limit-label">
            {t("biggest_folders.limit")}:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </label>

          {/* Bouton Actualiser */}
          <button
            className="toolbar-action"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
          >
            <RefreshCw size={14} />
            {refreshing ? t("analysis.refreshing") : t("analysis.refresh")}
          </button>
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Chargement initial */}
        {loading && <div className="status">{t("analysis.scanning")}</div>}

        {/* État vide */}
        {!loading && !error && folders.length === 0 && (
          <div className="status">
            <HardDrive size={32} />
            <p>{t("analysis.empty")}</p>
          </div>
        )}

        {/* Résultats */}
        {!loading && folders.length > 0 && (
          <section className="file-list biggest-folder-list">
            {/* En-tête du tableau */}
            <div className="list-header">
              <button
                className={`col-header ${sortKey === "name" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("name")}
              >
                {t("biggest_folders.name")}
              </button>
              <button
                className={`col-header ${sortKey === "path" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("path")}
              >
                {t("biggest_folders.path")}
              </button>
              <button
                className={`col-header col-size ${sortKey === "totalSize" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("totalSize")}
              >
                {t("biggest_folders.total_size")}
              </button>
              <button
                className={`col-header ${sortKey === "fileCount" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("fileCount")}
              >
                {t("biggest_folders.file_count")}
              </button>
              <span className="col-actions-header">
                {t("biggest_folders.navigate")}
              </span>
            </div>

            {/* Lignes de résultats */}
            <div className="file-rows">
              {sorted.map((folder) => (
                <div
                  key={folder.path}
                  className="file-row biggest-folder-row"
                  onDoubleClick={() => handleNavigate(folder.path)}
                >
                  <span className="file-name" title={folder.name}>
                    {folder.name}
                  </span>
                  <span className="file-path" title={folder.path}>
                    {folder.path}
                  </span>
                  <span className="file-size">
                    {formatSize(folder.totalSize)}
                  </span>
                  <span className="file-count">
                    {folder.fileCount.toLocaleString()}
                  </span>
                  <span className="file-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleNavigate(folder.path)}
                      title={t("biggest_folders.navigate")}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default BiggestFoldersView;
