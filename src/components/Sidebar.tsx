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
  LayoutDashboard,
  FolderKanban,
  ShieldAlert,
  PieChart,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import type { SpecialDir, DriveInfo, FavoriteItem, AppView } from "../types";
import { useLanguage } from "../contexts/LanguageContext";
import { useDragDropContext } from "./DragDropProvider";

interface SidebarProps {
  homePath: string | null;
  specialDirs: SpecialDir[];
  drives: DriveInfo[];
  favorites: FavoriteItem[];
  currentPath: string | null;
  currentView: AppView;
  onNavigate: (path: string) => void;
  onOpenHome: () => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  canAnalyze: boolean;
  onRemoveFavorite: (path: string) => void;
  onNavigateView: (view: AppView) => void;
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
  currentView,
  onNavigate,
  onOpenHome,
  onOpenSettings,
  onAnalyze,
  analyzing,
  canAnalyze,
  onRemoveFavorite,
  onNavigateView,
}: SidebarProps) {
  const { t } = useLanguage();
  const { state: dndState } = useDragDropContext();

  // Menu dépliant « Analyser » du pied de sidebar (s'ouvre vers le haut)
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

  const handleAnalyzeToggle = () => {
    setAnalyzeOpen((o) => !o);
  };

  const handleNavigateAnalysis = (view: AppView) => {
    setAnalyzeOpen(false);
    onNavigateView(view);
  };

  // Surlignage des cibles pendant le drag CUSTOM (Pointer Events) :
  // la cible survolée est suivie en direct par le DragDropProvider.
  // NOTE : les anciens handlers HTML5 (onDragOver/onDrop/handleDrop/...)
  // ont été supprimés : ils étaient du code mort car (1) aucun producteur
  // n'appelait dataTransfer.setData(), et (2) Tauri garde dragDropEnabled
  // à true (défaut), ce qui désactive HTML5 DnD dans la WebView. Les
  // attributs [data-drop-target] sont conservés car le hit-tester du
  // DragDropProvider s'appuie dessus.
  const dndFavoritesHover =
    dndState.isDragging &&
    dndState.hoveredTarget != null &&
    dndState.hoveredTarget.closest("[data-drop-target='favorites']") != null;

  const isActive = (path: string) =>
    currentPath !== null &&
    currentPath.replace(/\\+$/, "").toLowerCase() ===
      path.replace(/\\+$/, "").toLowerCase();

  const isViewActive = (view: AppView) => currentView === view;

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-title">{t("sidebar.quick_access")}</div>
          <button
            className={`sidebar-item ${isViewActive("home") ? "active" : ""}`}
            onClick={onOpenHome}
            title={t("home.title")}
          >
            <span className="sidebar-icon">
              <Home size={16} />
            </span>
            <span className="sidebar-label">{t("sidebar.dashboard")}</span>
          </button>
          {homePath && (
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
          className={`sidebar-section favorites-section ${dndFavoritesHover ? "drag-over" : ""}`}
          data-drop-target="favorites"
          data-path="__favorites__"
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
        {/* ---------- Menu dépliant « Analyser » (s'ouvre vers le haut) ---------- */}
        <div className="sidebar-analyze-menu">
          <button
            className={`sidebar-item ${analyzeOpen ? "active" : ""}`}
            onClick={handleAnalyzeToggle}
            title={t("sidebar.analyze_title")}
          >
            <span className="sidebar-icon">
              <BarChart3 size={16} />
            </span>
            <span className="sidebar-label">
              {analyzing ? t("sidebar.analyzing") : t("sidebar.analyze")}
            </span>
            <span className="sidebar-chevron">
              {analyzeOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          </button>

          {analyzeOpen && (
            <div className="sidebar-analyze-popover">
              {canAnalyze && (
                <button
                  className="sidebar-item"
                  onClick={() => {
                    setAnalyzeOpen(false);
                    onAnalyze();
                  }}
                  disabled={analyzing}
                  title={t("sidebar.analyze_title")}
                >
                  <span className="sidebar-icon">
                    <Search size={16} />
                  </span>
                  <span className="sidebar-label">
                    {analyzing ? t("sidebar.analyzing") : t("sidebar.analyze_current")}
                  </span>
                </button>
              )}
              <button
                className={`sidebar-item ${isViewActive("biggest-files") ? "active" : ""}`}
                onClick={() => handleNavigateAnalysis("biggest-files")}
                title={t("biggest_files.title")}
              >
                <span className="sidebar-icon">
                  <LayoutDashboard size={16} />
                </span>
                <span className="sidebar-label">{t("biggest_files.title")}</span>
              </button>
              <button
                className={`sidebar-item ${isViewActive("biggest-folders") ? "active" : ""}`}
                onClick={() => handleNavigateAnalysis("biggest-folders")}
                title={t("biggest_folders.title")}
              >
                <span className="sidebar-icon">
                  <FolderKanban size={16} />
                </span>
                <span className="sidebar-label">{t("biggest_folders.title")}</span>
              </button>
              <button
                className={`sidebar-item ${isViewActive("insights") ? "active" : ""}`}
                onClick={() => handleNavigateAnalysis("insights")}
                title={t("insights.title")}
              >
                <span className="sidebar-icon">
                  <BarChart3 size={16} />
                </span>
                <span className="sidebar-label">{t("insights.title")}</span>
              </button>
              <button
                className={`sidebar-item ${isViewActive("suspicious") ? "active" : ""}`}
                onClick={() => handleNavigateAnalysis("suspicious")}
                title={t("suspicious.title")}
              >
                <span className="sidebar-icon">
                  <ShieldAlert size={16} />
                </span>
                <span className="sidebar-label">{t("suspicious.title")}</span>
              </button>
              <button
                className={`sidebar-item ${isViewActive("categories") ? "active" : ""}`}
                onClick={() => handleNavigateAnalysis("categories")}
                title={t("categories.title")}
              >
                <span className="sidebar-icon">
                  <PieChart size={16} />
                </span>
                <span className="sidebar-label">{t("categories.title")}</span>
              </button>
            </div>
          )}
        </div>

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
