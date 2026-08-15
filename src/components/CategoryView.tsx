import { useState } from "react";
import { PieChart, HardDrive, RefreshCw, X } from "lucide-react";
import { formatSize, formatDate } from "../lib/format";
import { categoryLabel } from "../lib/category";
import { useLanguage } from "../contexts/LanguageContext";
import { useAnalysis } from "../contexts/AnalysisContext";

/**
 * Page "Vue par catégorie".
 *
 * Utilise l'analyse globale mise en cache (`AnalysisContext`) : aucun choix
 * de dossier n'est nécessaire. Affiche la répartition par catégorie avec
 * barres de pourcentage. Un clic sur une catégorie filtre les plus gros
 * fichiers de cette catégorie.
 */
function CategoryView() {
  const { t } = useLanguage();
  const { analysis, loading, refreshing, error, refresh } = useAnalysis();

  /* ---------- État ---------- */

  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const stats = analysis?.stats ?? null;
  const biggestFiles = analysis?.biggestFiles ?? [];
  const totalSize = stats?.totalSize ?? 0;

  /* ---------- Filtrage client ---------- */

  const filteredFiles =
    filterCategory !== null
      ? biggestFiles.filter((f) => f.category === filterCategory)
      : [];

  const filteredSize = filteredFiles.reduce((sum, f) => sum + f.size, 0);

  const handleReset = () => {
    setFilterCategory(null);
  };

  /* ---------- Rendu ---------- */

  return (
    <div className="content">
      <div className="biggest-view">
        {/* Titre */}
        <h1 className="view-title">{t("categories.title")}</h1>

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
        </div>

        {/* Erreur */}
        {error && <div className="status error">{error}</div>}

        {/* Chargement */}
        {loading && <div className="status">{t("analysis.scanning")}</div>}

        {/* État vide */}
        {!loading && !error && !stats && (
          <div className="status">
            <PieChart size={32} />
            <p>{t("analysis.empty")}</p>
          </div>
        )}

        {/* Résultats */}
        {!loading && !error && stats && (
          <div className="insights-results">
            <section className="insights-section">
              <h2 className="insights-section-title">
                <PieChart size={16} />
                {t("storage.by_category")}
              </h2>

              {stats.byCategory.length === 0 ? (
                <p className="status">{t("storage.empty")}</p>
              ) : (
                <div className="category-rows">
                  {stats.byCategory.map((cat) => {
                    const percent =
                      totalSize > 0 ? (cat.size / totalSize) * 100 : 0;
                    const active = filterCategory === cat.category;
                    return (
                      <button
                        key={cat.category}
                        className={`category-row ${active ? "active" : ""}`}
                        onClick={() =>
                          setFilterCategory(active ? null : cat.category)
                        }
                        title={categoryLabel(t, cat.category)}
                      >
                        <span className="category-name">
                          {categoryLabel(t, cat.category)}
                        </span>
                        <span className="category-size">
                          {formatSize(cat.size)}
                        </span>
                        <span className="category-count">
                          {cat.count.toLocaleString()} {t("categories.files")}
                        </span>
                        <div className="extension-bar">
                          <div className="extension-bar-track">
                            <div
                              className="extension-bar-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <span className="category-percent">
                          {percent.toFixed(1)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Filtre actif : plus gros fichiers de la catégorie */}
            {filterCategory !== null && (
              <section className="insights-section">
                <div className="old-file-toolbar">
                  <span className="scan-count">
                    {t("categories.filtered_by", {
                      category: categoryLabel(t, filterCategory),
                    })}{" "}
                    — {filteredFiles.length} · {formatSize(filteredSize)}
                  </span>
                  <button className="ghost-btn" onClick={handleReset}>
                    <X size={14} />
                    <span>{t("categories.reset")}</span>
                  </button>
                </div>

                {filteredFiles.length === 0 ? (
                  <p className="status">{t("categories.empty")}</p>
                ) : (
                  <section className="file-list">
                    <div className="list-header">
                      <span className="col-header">{t("sort.name")}</span>
                      <span className="col-header">{t("sort.type")}</span>
                      <span className="col-header col-size">
                        {t("categories.size")}
                      </span>
                      <span className="col-header col-date">
                        {t("sort.modified")}
                      </span>
                    </div>
                    <div className="file-rows">
                      {filteredFiles.map((file) => (
                        <div key={file.path} className="file-row">
                          <span className="file-name" title={file.name}>
                            {file.name}
                          </span>
                          <span className="file-category">
                            {categoryLabel(t, file.category)}
                          </span>
                          <span className="file-size">
                            {formatSize(file.size)}
                          </span>
                          <span className="file-date">
                            {formatDate(file.modified)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoryView;
