import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import type { FileInfo } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { typeLabel } from "../lib/category";

interface PropertiesPanelProps {
  path: string;
  onClose: () => void;
}

export default function PropertiesPanel({ path, onClose }: PropertiesPanelProps) {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<FileInfo>("get_file_info", { path });
        setInfo(result);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [path]);

  return (
    <aside className="properties-panel">
      <div className="settings-header">
        <h2>Propriétés</h2>
        <button className="icon-btn" onClick={onClose} title="Fermer">
          <X size={16} />
        </button>
      </div>

      {loading && <div className="status">Chargement…</div>}
      {error && <div className="error">{error}</div>}

      {info && !loading && (
        <div className="properties-content">
          <div className="property-row">
            <span className="property-label">Nom</span>
            <span className="property-value">{info.name}</span>
          </div>
          <div className="property-row">
            <span className="property-label">Type</span>
            <span className="property-value">
              {info.isDir ? "Dossier" : typeLabel(info.name, false)}
            </span>
          </div>
          <div className="property-row">
            <span className="property-label">Chemin</span>
            <span className="property-value property-path" title={info.path}>
              {info.path}
            </span>
          </div>
          <div className="property-row">
            <span className="property-label">Taille</span>
            <span className="property-value">{formatSize(info.size)}</span>
          </div>
          {info.extension && !info.isDir && (
            <div className="property-row">
              <span className="property-label">Extension</span>
              <span className="property-value">.{info.extension}</span>
            </div>
          )}
          <div className="property-row">
            <span className="property-label">Lecture seule</span>
            <span className="property-value">
              {info.readOnly ? "Oui" : "Non"}
            </span>
          </div>
          {info.created >= 0 && (
            <div className="property-row">
              <span className="property-label">Créé le</span>
              <span className="property-value">
                {formatDate(info.created)}
              </span>
            </div>
          )}
          {info.modified >= 0 && (
            <div className="property-row">
              <span className="property-label">Modifié le</span>
              <span className="property-value">
                {formatDate(info.modified)}
              </span>
            </div>
          )}
          {info.accessed >= 0 && (
            <div className="property-row">
              <span className="property-label">Accédé le</span>
              <span className="property-value">
                {formatDate(info.accessed)}
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}