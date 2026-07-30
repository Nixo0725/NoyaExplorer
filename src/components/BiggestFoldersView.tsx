import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, Search, FolderOpen } from "lucide-react";
import type { BiggestFolder, DriveInfo } from "../types";
import { formatSize } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";

/* ---------- Types internes ---------- */

type SortKey = "name" | "path" | "totalSize" | "fileCount";
type SortDir = "asc" | "desc";

const LIMIT_OPTIONS = [10, 50, 100, 500] as const;

/* ---------- Composant ---------- */

interface BiggestFoldersViewProps {
  /** Callback de navigation vers un dossier (double‑clic ou bouton). */
  onNavigate: (path: string) => void;
}

/**
 * Page "Plus gros dossiers".
 *
 * Props :
 *  - `onNavigate` : appelée au double‑clic sur une ligne ou au clic sur le
 *    bouton "Ouvrir" pour naviguer vers le dossier.
 *
 * Gère son propre état :
 *  - Liste des disques récupérée via `invoke("list_drives")`
 *  - Choix du Top N
 *  - Appel à `invoke("get_biggest_folders")`
 *  - Tri par colonne
 *  - Indicateur de progression pendant le scan
 */
function BiggestFoldersView({ onNavigate }: BiggestFoldersViewProps) {
  const { t } = useLanguage();

  /* ---------- État ---------- */

  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [folders, setFolders] = useState<BiggestFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("totalSize");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ---------- Chargement des disques ---------- */

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<DriveInfo[]>("list_drives");
        setDrives(result);
        if (result.length > 0) {
          setSelectedDrive(result[0].path);
        }
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  /* ---------- Analyse ---------- */

  const handleAnalyze = async () => {
    if (!selectedDrive) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<BiggestFolder[]>("get_biggest_folders", {
        path: selectedDrive,
        limit,
        maxDepth: 12,
      });
      setFolders(result);
    } catch (err) {
      setError(String(err));
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

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
    return [...folders].sort((a, b) => {
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
    });
  }, [folders, sortKey, sortDir]);

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
          {/* Sélecteur de disque */}
          <select
            className="drive-select"
            value={selectedDrive}
            onChange={(e) => setSelectedDrive(e.target.value)}
            disabled={loading}
          >
            {drives.length === 0 && (
              <option value="">{t("biggest_folders.select_source")}</option>
            )}
            {drives.map((drive) => (
              <option key={drive.path} value={drive.path}>
                {drive.label || drive.letter} ({drive.path})
              </option>
            ))}
          </select>

          <span className="toolbar-sep" />

          {/* Sélecteur Top N */}
          <label className="limit-label">
            {t("biggest_folders.limit")}:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </label>

          {/* Bouton Analyser */}
          <button
            className="toolbar-action"
            onClick={handleAnalyze}
            disabled={!selectedDrive || loading}
          >
            <Search size={14} />
            {loading ? t("biggest_folders.scanning") : t("biggest_folders.scan")}
          </button>

          {/* Compteur de progression */}
          {loading && folders.length > 0 && (
            <span className="scan-count">
              {t("biggest_folders.progress", {
                count: String(folders.length),
              })}
            </span>
          )}
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Chargement initial (aucun résultat précédent) */}
        {loading && folders.length === 0 && (
          <div className="status">{t("app.loading")}</div>
        )}

        {/* État vide */}
        {!loading && !error && folders.length === 0 && (
          <div className="status">
            <HardDrive size={32} />
            <p>{t("biggest_folders.empty")}</p>
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
                  <span className="file-size">{formatSize(folder.totalSize)}</span>
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
