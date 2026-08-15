import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  HardDrive,
  FileText,
  Clock,
  Archive,
  Download,
  FileJson,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { StorageInsights } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";
import { useAnalysis } from "../contexts/AnalysisContext";
import Dialog from "./Dialog";

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

/* ---------- Utilitaires d'export ---------- */

/** Échappe une valeur pour le format CSV (guillemets, virgules, retours à la ligne). */
function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Construit le texte CSV du rapport à partir des insights. */
function buildCsv(insights: StorageInsights): string {
  const lines: string[] = [];

  // Section : plus grandes extensions
  lines.push(["extension", "totalSize", "fileCount", "percentage"].map(csvEscape).join(","));
  for (const ext of insights.largestExtensions) {
    lines.push(
      [ext.extension, ext.totalSize, ext.fileCount, ext.percentage.toFixed(2)]
        .map(csvEscape)
        .join(","),
    );
  }

  lines.push("");

  // Section : fichiers anciens
  lines.push(["name", "path", "size", "lastModified", "category"].map(csvEscape).join(","));
  for (const file of insights.oldFiles) {
    lines.push(
      [file.name, file.path, file.size, file.lastModified, file.category]
        .map(csvEscape)
        .join(","),
    );
  }

  return lines.join("\n");
}

/* ---------- Composant ---------- */

/**
 * Page "Aperçu du stockage".
 *
 * Utilise l'analyse globale mise en cache (`AnalysisContext`) : aucun choix
 * de dossier n'est nécessaire. Propose :
 *  - l'export du rapport en JSON / CSV
 *  - la sélection et la suppression des fichiers anciens
 */
function InsightsView() {
  const { t } = useLanguage();
  const { analysis, loading, refreshing, error, refresh, mutate } =
    useAnalysis();

  /* ---------- État ---------- */

  // Feature 3 : feedback d'export
  const [exportMsg, setExportMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Feature 4 : sélection des fichiers anciens + suppression
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const insights = analysis?.insights ?? null;

  /* ---------- Export (Feature 3) ---------- */

  const handleExport = async (kind: "json" | "csv") => {
    if (!insights) return;
    const isJson = kind === "json";
    const content = isJson
      ? JSON.stringify(insights, null, 2)
      : buildCsv(insights);
    const defaultPath = isJson ? "rapport.json" : "rapport.csv";
    const filters = isJson
      ? [{ name: "JSON", extensions: ["json"] }]
      : [{ name: "CSV", extensions: ["csv"] }];
    try {
      const target = await saveDialog({ defaultPath, filters });
      if (!target) return; // annulé
      await invoke("write_report", { path: target, content });
      setExportMsg({ type: "success", text: t("export.success") });
    } catch (err) {
      setExportMsg({ type: "error", text: `${t("export.error")} ${err}` });
    }
  };

  /* ---------- Sélection & suppression (Feature 4) ---------- */

  const oldFiles = insights?.oldFiles ?? [];

  const selectedFiles = oldFiles.filter((f) => selected.has(f.path));
  const selectedSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const handleToggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(new Set(oldFiles.map((f) => f.path)));
  };

  const handleDeselectAll = () => {
    setSelected(new Set());
  };

  const handleDeleteSelected = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    const deletedPaths = new Set<string>();
    const failures: string[] = [];
    // Supprime un à un en continuant en cas d'échec partiel
    for (const file of selectedFiles) {
      try {
        await invoke("delete_entry", { path: file.path });
        deletedPaths.add(file.path);
      } catch {
        failures.push(file.name);
      }
    }
    setDeleting(false);
    setSelected(new Set());
    // Met à jour localement l'analyse globale (sans attendre la resynchronisation)
    if (deletedPaths.size > 0) {
      mutate((a) => ({
        ...a,
        insights: {
          ...a.insights,
          oldFiles: a.insights.oldFiles.filter(
            (f) => !deletedPaths.has(f.path),
          ),
        },
      }));
    }
    if (failures.length === 0) {
      setExportMsg({
        type: "success",
        text: t("insights.delete_success", { count: String(selectedFiles.length) }),
      });
    } else {
      setExportMsg({
        type: "error",
        text: t("insights.delete_error", { count: String(failures.length) }),
      });
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
          {analysis && (
            <span className="ghost-btn" style={{ cursor: "default" }}>
              <HardDrive size={14} />
              <span>{t("analysis.root", { root: analysis.root })}</span>
            </span>
          )}

          <span className="toolbar-sep" />

          <button
            className="toolbar-action"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
          >
            <RefreshCw size={14} />
            {refreshing ? t("analysis.refreshing") : t("analysis.refresh")}
          </button>

          {insights && !loading && (
            <span className="scan-count">
              {t("insights.total_scanned", {
                count: String(insights.totalScanned),
              })}
            </span>
          )}

          {insights && !loading && (
            <>
              <span className="toolbar-sep" />
              <button
                className="ghost-btn"
                onClick={() => handleExport("json")}
                title={t("export.json")}
              >
                <FileJson size={14} />
                <span>{t("export.json")}</span>
              </button>
              <button
                className="ghost-btn"
                onClick={() => handleExport("csv")}
                title={t("export.csv")}
              >
                <FileSpreadsheet size={14} />
                <span>{t("export.csv")}</span>
              </button>
            </>
          )}
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Feedback export / suppression */}
        {exportMsg && (
          <div
            className={`status ${exportMsg.type === "error" ? "error" : "success"}`}
          >
            {exportMsg.text}
          </div>
        )}

        {/* Chargement */}
        {loading && <div className="status">{t("analysis.scanning")}</div>}

        {/* État initial / vide */}
        {!loading && !error && !insights && (
          <div className="status">
            <HardDrive size={32} />
            <p>{t("analysis.empty")}</p>
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

              {oldFiles.length > 0 && (
                <div className="old-file-toolbar">
                  <button
                    className="ghost-btn"
                    onClick={handleSelectAll}
                    disabled={deleting}
                  >
                    <CheckSquare size={14} />
                    <span>{t("insights.select_all")}</span>
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={handleDeselectAll}
                    disabled={deleting}
                  >
                    <Square size={14} />
                    <span>{t("insights.deselect_all")}</span>
                  </button>

                  <span className="toolbar-sep" />

                  <button
                    className="toolbar-action danger"
                    onClick={() => setConfirmOpen(true)}
                    disabled={selectedFiles.length === 0 || deleting}
                  >
                    <Trash2 size={14} />
                    <span>
                      {t("insights.delete_selected", {
                        count: String(selectedFiles.length),
                      })}
                    </span>
                  </button>

                  {selectedFiles.length > 0 && (
                    <span className="scan-count">
                      {formatSize(selectedSize)}
                    </span>
                  )}
                </div>
              )}

              {oldFiles.length === 0 ? (
                <p className="status">{t("insights.old_files_empty")}</p>
              ) : (
                CATEGORY_GROUPS.map((group) => {
                  const filtered = oldFiles.filter(
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
                          <div
                            key={file.path}
                            className={`old-file-item ${selected.has(file.path) ? "selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="old-file-check"
                              checked={selected.has(file.path)}
                              onChange={() => handleToggleSelect(file.path)}
                              disabled={deleting}
                              aria-label={file.name}
                            />
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

      {/* Boîte de dialogue de confirmation de suppression */}
      {confirmOpen && (
        <Dialog
          title={t("insights.delete_confirm_title")}
          message={t("insights.delete_confirm", {
            count: String(selectedFiles.length),
            size: formatSize(selectedSize),
          })}
          confirmLabel={t("dialog.delete_btn")}
          cancelLabel={t("dialog.cancel")}
          danger
          onConfirm={handleDeleteSelected}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

export default InsightsView;
