import { useState } from "react";
import {
  Home,
  Monitor,
  FileText,
  Download,
  HardDrive,
  Folder,
  Settings,
  BarChart3,
  X,
} from "lucide-react";
import type { SpecialDir, DriveInfo, FavoriteItem } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

interface SidebarProps {
  homePath: string | null;
  specialDirs: SpecialDir[];
  drives: DriveInfo[];
  favorites: FavoriteItem[];
  currentPath: string | null;
  /** Indique si la vue Home est actuellement affichée. */
  isHomeView: boolean;
  onNavigate: (path: string) => void;
  onOpenHome: () => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  canAnalyze: boolean;
  onRemoveFavorite: (path: string) => void;
  onDropToSidebar: (path: string) => void;
}

/** Mapping des labels des dossiers spéciaux système vers les clés de traduction */
function translateDirLabel(t: (key: string) => string, label: string): string {
  const map: Record<string, string> = {
    "Bureau": t("sidebar.desktop"),
    "Desktop": t("sidebar.desktop"),
    "Documents": t("sidebar.documents"),
    "Téléchargements": t("sidebar.downloads"),
    "Downloads": t("sidebar.downloads"),
  };
  return map[label] ?? label;
}

function specialDirIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower === "bureau" || lower === "desktop") return <Monitor size={16} />;
  if (lower === "documents") return <FileText size={16} />;
  if (lower === "téléchargements" || lower === "downloads") return <Download size={16} />;
  return <Folder size={16} />;
}

function Sidebar({
  homePath,
  specialDirs,
  drives,
  favorites,
  currentPath,
  isHomeView,
  onNavigate,
  onOpenHome,
  onOpenSettings,
  onAnalyze,
  analyzing,
  canAnalyze,
  onRemoveFavorite,
  onDropToSidebar,
}: SidebarProps) {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);

  const isActive = (path: string) =>
    currentPath !== null &&
    currentPath.replace(/\\+$/, "").toLowerCase() ===
      path.replace(/\\+$/, "").toLowerCase();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const path = e.dataTransfer.getData("application/x-noya-entry") ||
      e.dataTransfer.getData("text/plain");
    if (path) onDropToSidebar(path);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-title">{t("sidebar.quick_access")}</div>
          <button
            className={`sidebar-item ${isHomeView ? "active" : ""}`}
            onClick={onOpenHome}
            title={t("home.title")}
          >
            <span className="sidebar-icon">
              <Home size={16} />
            </span>
            <span className="sidebar-label">{t("sidebar.home")}</span>
          </button>
          {homePath && !isHomeView && (
            <button
              className={`sidebar-item ${isActive(homePath) ? "active" : ""}`}
              onClick={() => onNavigate(homePath)}
              title={homePath}
            >
              <span className="sidebar-icon">
                <Folder size={16} />
              </span>
              <span className="sidebar-label">{t("sidebar.home")}</span>
            </button>
          )}
          {specialDirs.map((dir) => (
            <button
              key={dir.path}
              className={`sidebar-item ${isActive(dir.path) ? "active" : ""}`}
              onClick={() => onNavigate(dir.path)}
              title={dir.path}
            >
              <span className="sidebar-icon">{specialDirIcon(dir.label)}</span>
              <span className="sidebar-label">{translateDirLabel(t, dir.label)}</span>
            </button>
          ))}
        </div>

        {/* ---------- Favoris ---------- */}
        <div
          className={`sidebar-section favorites-section ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="sidebar-title">{t("sidebar.favorites")}</div>
          {favorites.length === 0 && (
            <div className="sidebar-favorites-empty">
              {t("sidebar.favorites_empty")}
            </div>
          )}
          {favorites.map((fav) => (
            <div
              key={fav.path}
              className={`sidebar-item sidebar-favorite ${isActive(fav.path) ? "active" : ""}`}
              onClick={() => onNavigate(fav.path)}
              title={fav.path}
            >
              <span className="sidebar-icon">
                {fav.isDir ? <Folder size={16} /> : <FileText size={16} />}
              </span>
              <span className="sidebar-label">{fav.name}</span>
              <button
                className="favorite-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFavorite(fav.path);
                }}
                title={t("sidebar.remove_favorite")}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {drives.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-title">{t("sidebar.this_pc")}</div>
            {drives.map((drive) => (
              <button
                key={drive.path}
                className={`sidebar-item ${isActive(drive.path) ? "active" : ""}`}
                onClick={() => onNavigate(drive.path)}
                title={drive.path}
              >
                <span className="sidebar-icon">
                  <HardDrive size={16} />
                </span>
                <span className="sidebar-label">{drive.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        {canAnalyze && (
          <button
            className="sidebar-item"
            onClick={onAnalyze}
            disabled={analyzing}
            title={t("sidebar.analyze_title")}
          >
            <span className="sidebar-icon">
              <BarChart3 size={16} />
            </span>
            <span className="sidebar-label">
              {analyzing ? t("sidebar.analyzing") : t("sidebar.analyze")}
            </span>
          </button>
        )}
        <button
          className="sidebar-item"
          onClick={onOpenSettings}
          title={t("sidebar.settings_title")}
        >
          <span className="sidebar-icon">
            <Settings size={16} />
          </span>
          <span className="sidebar-label">{t("sidebar.settings")}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
