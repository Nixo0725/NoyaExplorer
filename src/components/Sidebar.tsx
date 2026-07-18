import {
  Home,
  Monitor,
  FileText,
  Download,
  HardDrive,
  Folder,
  Settings,
  BarChart3,
} from "lucide-react";
import type { SpecialDir, DriveInfo } from "../types";

interface SidebarProps {
  homePath: string | null;
  specialDirs: SpecialDir[];
  drives: DriveInfo[];
  currentPath: string | null;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  canAnalyze: boolean;
}

function specialDirIcon(label: string) {
  if (label === "Bureau") return <Monitor size={16} />;
  if (label === "Documents") return <FileText size={16} />;
  if (label === "Téléchargements") return <Download size={16} />;
  return <Folder size={16} />;
}

function Sidebar({
  homePath,
  specialDirs,
  drives,
  currentPath,
  onNavigate,
  onOpenSettings,
  onAnalyze,
  analyzing,
  canAnalyze,
}: SidebarProps) {
  const isActive = (path: string) =>
    currentPath !== null &&
    currentPath.replace(/\\+$/, "").toLowerCase() ===
      path.replace(/\\+$/, "").toLowerCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-title">Accès rapide</div>
          {homePath && (
            <button
              className={`sidebar-item ${isActive(homePath) ? "active" : ""}`}
              onClick={() => onNavigate(homePath)}
              title={homePath}
            >
              <span className="sidebar-icon">
                <Home size={16} />
              </span>
              <span className="sidebar-label">Accueil</span>
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
              <span className="sidebar-label">{dir.label}</span>
            </button>
          ))}
        </div>

        {drives.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-title">Ce PC</div>
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
            title="Analyser le stockage du dossier courant"
          >
            <span className="sidebar-icon">
              <BarChart3 size={16} />
            </span>
            <span className="sidebar-label">
              {analyzing ? "Analyse…" : "Analyser le stockage"}
            </span>
          </button>
        )}
        <button
          className="sidebar-item"
          onClick={onOpenSettings}
          title="Paramètres"
        >
          <span className="sidebar-icon">
            <Settings size={16} />
          </span>
          <span className="sidebar-label">Paramètres</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
