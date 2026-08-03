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
  Layers,
  Plus,
} from "lucide-react";
import type { SpecialDir, DriveInfo, FavoriteItem, Space, AppView } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

interface SidebarProps {
  homePath: string | null;
  specialDirs: SpecialDir[];
  drives: DriveInfo[];
  favorites: FavoriteItem[];
  spaces: Space[];
  currentPath: string | null;
  currentView: AppView;
  currentSpaceId: string | null;
  onNavigate: (path: string) => void;
  onOpenHome: () => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  canAnalyze: boolean;
  onRemoveFavorite: (path: string) => void;
  onDropToSidebar: (path: string) => void;
  onNavigateView: (view: AppView) => void;
  onOpenSpace: (id: string) => void;
  onCreateSpace: () => void;
  onDeleteSpace: (id: string) => void;
  onDropToSpace: (spaceId: string, folder: string) => void;
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

/** Icons disponibles pour les Spaces */
const SPACE_ICONS: Record<string, React.ReactNode> = {
  folder: <Folder size={16} />,
  code: <FileText size={16} />,
  gamepad: <Monitor size={16} />,
  image: <FileText size={16} />,
  music: <FileText size={16} />,
  video: <FileText size={16} />,
  book: <FileText size={16} />,
  archive: <FileText size={16} />,
  default: <Layers size={16} />,
};

function spaceIcon(icon: string) {
  return SPACE_ICONS[icon] ?? SPACE_ICONS.default;
}

function Sidebar({
  homePath,
  specialDirs,
  drives,
  favorites,
  spaces,
  currentPath,
  currentView,
  currentSpaceId,
  onNavigate,
  onOpenHome,
  onOpenSettings,
  onAnalyze,
  analyzing,
  canAnalyze,
  onRemoveFavorite,
  onDropToSidebar,
  onNavigateView,
  onOpenSpace,
  onCreateSpace,
  onDeleteSpace,
  onDropToSpace,
}: SidebarProps) {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);

  const isActive = (path: string) =>
    currentPath !== null &&
    currentPath.replace(/\\+$/, "").toLowerCase() ===
      path.replace(/\\+$/, "").toLowerCase();

  const isViewActive = (view: AppView) => currentView === view;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const path = e.dataTransfer.getData("application/x-noya-entry") ||
      e.dataTransfer.getData("text/plain");
    if (path) onDropToSidebar(path);
  };

  const handleSpaceDrop = (e: React.DragEvent, spaceId: string) => {
    e.preventDefault();
    setDragOverSpaceId(null);
    const path = e.dataTransfer.getData("application/x-noya-entry") ||
      e.dataTransfer.getData("text/plain");
    if (path) onDropToSpace(spaceId, path);
  };

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
            <span className="sidebar-label">{t("sidebar.home")}</span>
          </button>
          {homePath && currentView === "files" && (
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

        {/* ---------- Sections d'analyse ---------- */}
        <div className="sidebar-section">
          <div className="sidebar-title">{t("sidebar.analyze")}</div>
          <button
            className={`sidebar-item ${isViewActive("biggest-files") ? "active" : ""}`}
            onClick={() => onNavigateView("biggest-files")}
            title={t("biggest_files.title")}
          >
            <span className="sidebar-icon">
              <LayoutDashboard size={16} />
            </span>
            <span className="sidebar-label">{t("biggest_files.title")}</span>
          </button>
          <button
            className={`sidebar-item ${isViewActive("biggest-folders") ? "active" : ""}`}
            onClick={() => onNavigateView("biggest-folders")}
            title={t("biggest_folders.title")}
          >
            <span className="sidebar-icon">
              <FolderKanban size={16} />
            </span>
            <span className="sidebar-label">{t("biggest_folders.title")}</span>
          </button>
          <button
            className={`sidebar-item ${isViewActive("insights") ? "active" : ""}`}
            onClick={() => onNavigateView("insights")}
            title={t("insights.title")}
          >
            <span className="sidebar-icon">
              <BarChart3 size={16} />
            </span>
            <span className="sidebar-label">{t("insights.title")}</span>
          </button>
        </div>

        {/* ---------- Favoris ---------- */}
        <div
          className={`sidebar-section favorites-section ${dragOver ? "drag-over" : ""}`}
          data-drop-target="favorites"
          data-path="__favorites__"
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

        {/* ---------- Spaces ---------- */}
        <div className="sidebar-section">
          <div className="sidebar-title sidebar-title-row">
            <span>{t("spaces.title")}</span>
            <button
              className="icon-btn icon-btn-small"
              onClick={onCreateSpace}
              title={t("spaces.create")}
            >
              <Plus size={14} />
            </button>
          </div>
          {spaces.length === 0 && (
            <div className="sidebar-favorites-empty">
              {t("spaces.empty")}
            </div>
          )}
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`sidebar-item sidebar-space ${currentSpaceId === space.id ? "active" : ""} ${dragOverSpaceId === space.id ? "drag-over" : ""}`}
              data-drop-target="space"
              data-space-id={space.id}
              data-folder-path={space.folders[0] ?? ""}
              onClick={() => onOpenSpace(space.id)}
              title={space.name}
              onDragOver={(e) => {
                e.preventDefault();
                // Utilise "link" pour indiquer qu'on ne déplace PAS les fichiers
                e.dataTransfer.dropEffect = "link";
                setDragOverSpaceId(space.id);
              }}
              onDragLeave={() => setDragOverSpaceId(null)}
              onDrop={(e) => handleSpaceDrop(e, space.id)}
            >
              <span className="sidebar-icon">{spaceIcon(space.icon)}</span>
              <span className="sidebar-label">{space.name}</span>
              <button
                className="favorite-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSpace(space.id);
                }}
                title={t("spaces.delete")}
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
