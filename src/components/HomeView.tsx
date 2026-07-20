import { Folder, FileText, Clock, TrendingUp, Star } from "lucide-react";
import type { AccessRecord, FavoriteItem } from "../types";
import { formatDate } from "../lib/format";
import { getTypeInfo } from "../lib/fileType";
import FileIcon from "./FileIcon";
import { useLanguage } from "../contexts/LanguageContext";

interface HomeViewProps {
  mostUsed: AccessRecord[];
  recentFiles: AccessRecord[];
  favorites: FavoriteItem[];
  onOpen: (record: AccessRecord) => void;
  onToggleFavorite: (record: AccessRecord) => void;
  isFavorite: (path: string) => boolean;
}

/**
 * Vue d'accueil par défaut.
 *
 * Affiche deux sections :
 * 1. Une grille des 4 éléments les plus utilisés (basés sur la fréquence d'accès).
 * 2. Une liste chronologique des fichiers récemment ouverts ou modifiés.
 */
function HomeView({
  mostUsed,
  recentFiles,
  favorites,
  onOpen,
  onToggleFavorite,
  isFavorite,
}: HomeViewProps) {
  const { t } = useLanguage();

  return (
    <div className="home-view">
      <h1 className="home-title">{t("home.title")}</h1>

      {/* ---------- Grille des éléments les plus utilisés ---------- */}
      <section className="home-section">
        <h2 className="home-section-title">
          <TrendingUp size={16} />
          {t("home.most_used")}
        </h2>
        {mostUsed.length === 0 ? (
          <p className="home-empty">{t("home.empty_most_used")}</p>
        ) : (
          <div className="home-grid">
            {mostUsed.map((item) => {
              const info = getTypeInfo(item.name, item.isDir);
              const pinned = isFavorite(item.path);
              return (
                <button
                  key={item.path}
                  className="home-card"
                  onClick={() => onOpen(item)}
                  title={item.path}
                >
                  <span
                    className="home-card-pin"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    title={pinned ? t("home.unpin") : t("home.pin")}
                  >
                    <Star
                      size={14}
                      fill={pinned ? "currentColor" : "none"}
                    />
                  </span>
                  <span className="home-card-icon">
                    <FileIcon category={info.category} />
                  </span>
                  <span className="home-card-name">{item.name}</span>
                  <span className="home-card-meta">
                    {t("home.open_count", { count: String(item.accessCount) })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Liste des fichiers récents ---------- */}
      <section className="home-section">
        <h2 className="home-section-title">
          <Clock size={16} />
          {t("home.recent")}
        </h2>
        {recentFiles.length === 0 ? (
          <p className="home-empty">{t("home.empty_recent")}</p>
        ) : (
          <div className="home-recent-list">
            {recentFiles.map((item) => {
              const pinned = isFavorite(item.path);
              return (
                <button
                  key={item.path}
                  className="home-recent-row"
                  onClick={() => onOpen(item)}
                  title={item.path}
                >
                  <span className="home-recent-icon">
                    {item.isDir ? <Folder size={16} /> : <FileText size={16} />}
                  </span>
                  <span className="home-recent-name">{item.name}</span>
                  <span className="home-recent-path">{item.path}</span>
                  <span className="home-recent-date">
                    {formatDate(item.lastAccessed)}
                  </span>
                  <span
                    className="home-recent-pin"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    title={pinned ? t("home.unpin") : t("home.pin")}
                  >
                    <Star
                      size={13}
                      fill={pinned ? "currentColor" : "none"}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {favorites.length > 0 && (
        <section className="home-section">
          <h2 className="home-section-title">
            <Star size={16} />
            {t("sidebar.favorites")}
          </h2>
          <div className="home-grid">
            {favorites.slice(0, 4).map((fav) => {
              const info = getTypeInfo(fav.name, fav.isDir);
              return (
                <button
                  key={fav.path}
                  className="home-card"
                  onClick={() =>
                    onOpen({
                      path: fav.path,
                      name: fav.name,
                      isDir: fav.isDir,
                      accessCount: 0,
                      lastAccessed: fav.addedAt,
                      modified: 0,
                    })
                  }
                  title={fav.path}
                >
                  <span className="home-card-icon">
                    <FileIcon category={info.category} />
                  </span>
                  <span className="home-card-name">{fav.name}</span>
                  <span className="home-card-meta">{fav.path}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default HomeView;