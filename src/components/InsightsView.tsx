import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  HardDrive,
  FolderOpen,
  Search,
  FileText,
  Clock,
  Archive,
  Download,
} from "lucide-react";
import type { StorageInsights } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";

/* ---------- Configuration des groupes de fichiers anciens ---------- */

interface CategoryGroup {
  key: string;
  i18nKey: string;
  i18nDescKey: string;
  icon: ReactNode;
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "old_file",
    i18nKey: "insights.old_file",
    i18nDescKey: "insights.old_files_desc",
    icon: <Clock size={16} />,
  },
  {
    key: "abandoned_download",
    i18nKey: "insights.abandoned_download",
    i18nDescKey: "insights.abandoned_download_desc",
    icon: <Download size={16} />,
  },
  {
    key: "unused_archive",
    i18nKey: "insights.unused_archive",
    i18nDescKey: "insights.unused_archive_desc",
    icon: <Archive size={16} />,
  },
];

/* ---------- Composant ---------- */

/**
 * Page "Aperçu du stockage".
 *
 * Autonome (aucune props) : gère son propre état :
 *  - Sélection du dossier source via la boîte de dialogue native
 *  - Appel à `get_storage_insights` côté Rust
 *  - Affichage des plus grandes extensions (tableau + barres)
 *  - Affichage des fichiers anciens catégorisés
 */
function InsightsView() {
  const { t } = useLanguage();

  /* ---------- État ---------- */

  const [sourcePath, setSourcePath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<StorageInsights | null>(null);

  /* ---------- Sélection du dossier source ---------- */

  const handleSelectSource = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("insights.select_source"),
      });
      if (selected) {
        setSourcePath(selected);
        setError(null);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  /* ---------- Analyse ---------- */

  const handleAnalyze = async () => {
    if (!sourcePath) return;
    setLoading(true);
    setError(null);
    setInsights(null);
    try {
      const result = await invoke<StorageInsights>("get_storage_insights", {
        path: sourcePath,
        extensionLimit: 20,
        oldFilesLimit: 50,
      });
      setInsights(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Rendu ---------- */

  return (
    <div className="content">
      <div className="biggest-view">
        {/* Titre */}
        <h1 className="view-title">{t("insights.title")}</h1>

        {/* Barre d'outils */}
        <div className="toolbar">
          <button
            className="ghost-btn"
            onClick={handleSelectSource}
            title={t("insights.select_source")}
          >
            <FolderOpen size={14} />
            <span>{sourcePath || t("insights.select_source")}</span>
          </button>

          <span className="toolbar-sep" />

          <button
            className="toolbar-action"
            onClick={handleAnalyze}
            disabled={!sourcePath || loading}
          >
            <Search size={14} />
            {loading ? t("insights.scanning") : t("insights.scan")}
          </button>

          {insights && !loading && (
            <span className="scan-count">
              {t("insights.total_scanned", {
                count: String(insights.totalScanned),
              })}
            </span>
          )}
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Chargement */}
        {loading && <div className="status">{t("app.loading")}</div>}

        {/* État initial / vide */}
        {!loading && !error && !insights && (
          <div className="status">
            <HardDrive size={32} />
            <p>{t("insights.select_source")}</p>
          </div>
        )}

        {/* Résultats */}
        {!loading && !error && insights && (
          <div className="insights-results">
            {/* ---- Section : Plus grandes extensions ---- */}
            <section className="insights-section">
              <h2 className="insights-section-title">
                <FileText size={16} />
                {t("insights.largest_extensions")}
              </h2>

              {insights.largestExtensions.length === 0 ? (
                <p className="status">{t("insights.extensions_empty")}</p>
              ) : (
                <div className="extension-table">
                  {/* En-tête */}
                  <div className="list-header">
                    <span className="col-header">
                      {t("insights.extension")}
                    </span>
                    <span className="col-header col-size">
                      {t("insights.total_size")}
                    </span>
                    <span className="col-header">
                      {t("insights.file_count")}
                    </span>
                    <span className="col-header">
                      {t("insights.percentage")}
                    </span>
                    <span /> {/* colonne pour la barre */}
                  </div>

                  {/* Lignes */}
                  <div className="extension-rows">
                    {insights.largestExtensions.map((ext) => (
                      <div key={ext.extension} className="extension-row">
                        <span className="extension-name">
                          .{ext.extension}
                        </span>
                        <span className="file-size">
                          {formatSize(ext.totalSize)}
                        </span>
                        <span className="file-count">
                          {ext.fileCount.toLocaleString()}
                        </span>
                        <span className="extension-percentage">
                          {ext.percentage.toFixed(1)}%
                        </span>
                        <div className="extension-bar">
                          <div className="extension-bar-track">
                            <div
                              className="extension-bar-fill"
                              style={{ width: `${ext.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ---- Section : Fichiers anciens ---- */}
            <section className="insights-section">
              <h2 className="insights-section-title">
                <Clock size={16} />
                {t("insights.old_files")}
              </h2>

              {insights.oldFiles.length === 0 ? (
                <p className="status">{t("insights.old_files_empty")}</p>
              ) : (
                CATEGORY_GROUPS.map((group) => {
                  const filtered = insights.oldFiles.filter(
                    (f) => f.category === group.key,
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div key={group.key} className="old-file-group">
                      <div className="old-file-group-header">
                        {group.icon}
                        <span>{t(group.i18nKey)}</span>
                        <span className="old-file-count">
                          {filtered.length}
                        </span>
                      </div>
                      <p className="old-file-desc">
                        {t(group.i18nDescKey)}
                      </p>
                      <div className="old-file-items">
                        {filtered.map((file) => (
                          <div key={file.path} className="old-file-item">
                            <span
                              className="old-file-name"
                              title={file.name}
                            >
                              {file.name}
                            </span>
                            <span className="file-path" title={file.path}>
                              {file.path}
                            </span>
                            <span className="file-size">
                              {formatSize(file.size)}
                            </span>
                            <span className="file-date">
                              {formatDate(file.lastModified)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {/* Note d'information */}
            <p className="info-note">{t("insights.information_only")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsView;
