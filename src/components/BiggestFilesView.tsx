import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, ExternalLink, Trash2, HardDrive, RefreshCw } from "lucide-react";
import type { BiggestFile } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { categoryLabel } from "../lib/category";
import { useLanguage } from "../contexts/LanguageContext";
import { useAnalysis } from "../contexts/AnalysisContext";

/* ---------- Types internes ---------- */

type SortKey = "name" | "path" | "size" | "category" | "modified";
type SortDir = "asc" | "desc";

const LIMIT_OPTIONS = [10, 50, 100] as const;

/* ---------- Utilitaires ---------- */

/** Extrait le chemin du dossier parent. */
function getParentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return path;
  return normalized.slice(0, lastSlash);
}

/* ---------- Composant ---------- */

/**
 * Page "Plus gros fichiers".
 *
 * Utilise l'analyse globale mise en cache (`AnalysisContext`) : aucun choix
 * de dossier n'est nécessaire. Le Top N est appliqué côté client sur les
 * résultats du scan global.
 */
function BiggestFilesView() {
  const { t } = useLanguage();
  const { analysis, loading, refreshing, error, refresh, mutate } =
    useAnalysis();

  /* ---------- État ---------- */

  const [limit, setLimit] = useState<number>(100);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const files: BiggestFile[] = analysis?.biggestFiles ?? [];
  const displayError = error ?? errorLocal;

  /* ---------- Tri ---------- */

  const handleToggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // Par défaut : ordre descendant pour la taille, ascendant pour le texte
      setSortKey(key);
      setSortDir(key === "name" || key === "path" || key === "category" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...files].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case "path":
          cmp = a.path.toLowerCase().localeCompare(b.path.toLowerCase());
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "category": {
          const la = categoryLabel(t, a.category);
          const lb = categoryLabel(t, b.category);
          cmp = la.localeCompare(lb);
          break;
        }
        case "modified":
          cmp = a.modified - b.modified;
          break;
      }
      if (cmp === 0) {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      return cmp * dir;
    }).slice(0, limit);
  }, [files, sortKey, sortDir, limit, t]);

  /* ---------- Actions par ligne ---------- */

  const handleOpen = async (file: BiggestFile) => {
    try {
      await invoke("open_file", { path: file.path });
    } catch (err) {
      setErrorLocal(String(err));
    }
  };

  const handleOpenContaining = async (file: BiggestFile) => {
    try {
      const parent = getParentPath(file.path);
      await invoke("open_file", { path: parent });
    } catch (err) {
      setErrorLocal(String(err));
    }
  };

  const handleDelete = async (file: BiggestFile) => {
    const confirmed = window.confirm(
      t("biggest_files.delete_confirm", { name: file.name }),
    );
    if (!confirmed) return;
    try {
      await invoke("delete_entry", { path: file.path });
      // Met à jour localement l'analyse globale sans relancer un scan complet
      // (une resynchronisation périodique se chargera du cache à terme).
      mutate((a) => ({
        ...a,
        biggestFiles: a.biggestFiles.filter((f) => f.path !== file.path),
      }));
    } catch (err) {
      setErrorLocal(String(err));
    }
  };

  /* ---------- Rendu ---------- */

  return (
    <div className="content">
      <div className="biggest-view">
        {/* Titre */}
        <h1 className="view-title">{t("biggest_files.title")}</h1>

        {/* Barre d'outils */}
        <div className="toolbar">
          {analysis && (
            <span className="ghost-btn" style={{ cursor: "default" }}>
              <HardDrive size={14} />
              <span>
                {t("analysis.root", { root: analysis.root })}
              </span>
            </span>
          )}

          <span className="toolbar-sep" />

          <label className="limit-label">
            {t("biggest_files.limit")}:
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

          <button
            className="toolbar-action"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
          >
            <RefreshCw size={14} />
            {refreshing ? t("analysis.refreshing") : t("analysis.refresh")}
          </button>

          {files.length > 0 && !loading && (
            <span className="scan-count">
              {t("biggest_files.total_scanned", {
                count: String(files.length),
              })}
            </span>
          )}
        </div>

        {/* Erreur */}
        {displayError && <div className="status error">{displayError}</div>}

        {/* Chargement */}
        {loading && <div className="status">{t("analysis.scanning")}</div>}

        {/* État initial / vide */}
        {!loading && !displayError && files.length === 0 && (
          <div className="status">
            <HardDrive size={32} />
            <p>{t("analysis.empty")}</p>
          </div>
        )}

        {/* Résultats */}
        {!loading && files.length > 0 && (
          <section className="file-list biggest-file-list">
            {/* En-tête du tableau */}
            <div className="list-header">
              <button
                className={`col-header ${sortKey === "name" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("name")}
              >
                {t("biggest_files.name")}
              </button>
              <button
                className={`col-header ${sortKey === "path" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("path")}
              >
                {t("biggest_files.path")}
              </button>
              <button
                className={`col-header col-size ${sortKey === "size" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("size")}
              >
                {t("biggest_files.size")}
              </button>
              <button
                className={`col-header ${sortKey === "category" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("category")}
              >
                {t("biggest_files.category")}
              </button>
              <button
                className={`col-header col-date ${sortKey === "modified" ? `active ${sortDir}` : ""}`}
                onClick={() => handleToggleSort("modified")}
              >
                {t("biggest_files.modified")}
              </button>
              <span className="col-actions-header">
                {t("biggest_files.open")}
              </span>
            </div>

            {/* Lignes de résultats */}
            <div className="file-rows">
              {sorted.map((file) => (
                <div key={file.path} className="file-row biggest-file-row">
                  <span className="file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="file-path" title={file.path}>
                    {file.path}
                  </span>
                  <span className="file-size">{formatSize(file.size)}</span>
                  <span className="file-category">
                    {categoryLabel(t, file.category)}
                  </span>
                  <span className="file-date">
                    {formatDate(file.modified)}
                  </span>
                  <span className="file-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleOpen(file)}
                      title={t("biggest_files.open")}
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleOpenContaining(file)}
                      title={t("biggest_files.open_containing")}
                    >
                      <Folder size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleDelete(file)}
                      title={t("biggest_files.delete")}
                    >
                      <Trash2 size={14} />
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

export default BiggestFilesView;
