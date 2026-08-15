import { useState } from "react";
import { RefreshCw, ShieldAlert, HardDrive } from "lucide-react";
import type { SuspiciousFile } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";
import { useAnalysis } from "../contexts/AnalysisContext";

/**
 * Page "Fichiers suspects".
 *
 * Utilise l'analyse globale mise en cache (`AnalysisContext`) : aucun choix
 * de dossier n'est nécessaire. Affiche les fichiers suspects avec leurs
 * raisons sous forme de badges.
 */
function SuspiciousFilesView() {
  const { t } = useLanguage();
  const { analysis, loading, refreshing, error, refresh } = useAnalysis();

  /* ---------- État ---------- */

  const [limit, setLimit] = useState<number>(100);

  const files: SuspiciousFile[] = (analysis?.suspicious ?? []).slice(0, limit);

  /* ---------- Rendu ---------- */

  return (
    <div className="content">
      <div className="biggest-view">
        {/* Titre */}
        <h1 className="view-title">{t("suspicious.title")}</h1>

        {/* Barre d'outils */}
        <div className="toolbar">
          {analysis && (
            <span className="ghost-btn" style={{ cursor: "default" }}>
              <HardDrive size={14} />
              <span>{t("analysis.root", { root: analysis.root })}</span>
            </span>
          )}

          <span className="toolbar-sep" />

          <label className="limit-label">
            {t("biggest_files.limit")}:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
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
              {t("suspicious.found", { count: String(files.length) })}
            </span>
          )}
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Chargement */}
        {loading && <div className="status">{t("analysis.scanning")}</div>}

        {/* État initial / vide */}
        {!loading && !error && files.length === 0 && (
          <div className="status">
            <ShieldAlert size={32} />
            <p>{t("suspicious.empty")}</p>
          </div>
        )}

        {/* Résultats */}
        {!loading && files.length > 0 && (
          <section className="file-list suspicious-list">
            {/* En-tête du tableau */}
            <div className="list-header">
              <span className="col-header">{t("suspicious.name")}</span>
              <span className="col-header">{t("suspicious.path")}</span>
              <span className="col-header col-size">
                {t("suspicious.size")}
              </span>
              <span className="col-header col-date">
                {t("suspicious.modified")}
              </span>
              <span className="col-header">{t("suspicious.reasons")}</span>
            </div>

            {/* Lignes de résultats */}
            <div className="file-rows">
              {files.map((file) => (
                <div key={file.path} className="file-row suspicious-row">
                  <span className="file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="file-path" title={file.path}>
                    {file.path}
                  </span>
                  <span className="file-size">{formatSize(file.size)}</span>
                  <span className="file-date">{formatDate(file.modified)}</span>
                  <span className="suspicious-reasons">
                    {file.reasons.map((reason) => (
                      <span key={reason} className="suspicious-badge">
                        {t(`suspicious.reasons.${reason}`)}
                      </span>
                    ))}
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

export default SuspiciousFilesView;
