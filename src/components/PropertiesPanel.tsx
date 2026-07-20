import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import type { FileInfo } from "../types";
import { formatSize, formatDate } from "../lib/format";
import { useLanguage } from "../contexts/LanguageContext";

interface PropertiesPanelProps {
  path: string;
  onClose: () => void;
}

export default function PropertiesPanel({ path, onClose }: PropertiesPanelProps) {
  const { t } = useLanguage();
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
        <h2>{t("properties.title")}</h2>
        <button className="icon-btn" onClick={onClose} title={t("properties.close")}>
          <X size={16} />
        </button>
      </div>

      {loading && <div className="status">{t("properties.loading")}</div>}
      {error && <div className="error">{error}</div>}

      {info && !loading && (
        <div className="properties-content">
          <div className="property-row">
            <span className="property-label">{t("properties.name")}</span>
            <span className="property-value">{info.name}</span>
          </div>
          <div className="property-row">
            <span className="property-label">{t("properties.type")}</span>
            <span className="property-value">
              {info.isDir ? t("properties.type_folder") : typeLabel(t, info.name, false)}
            </span>
          </div>
          <div className="property-row">
            <span className="property-label">{t("properties.path")}</span>
            <span className="property-value property-path" title={info.path}>
              {info.path}
            </span>
          </div>
          <div className="property-row">
            <span className="property-label">{t("properties.size")}</span>
            <span className="property-value">{formatSize(info.size)}</span>
          </div>
          {info.extension && !info.isDir && (
            <div className="property-row">
              <span className="property-label">{t("properties.extension")}</span>
              <span className="property-value">.{info.extension}</span>
            </div>
          )}
          <div className="property-row">
            <span className="property-label">{t("properties.read_only")}</span>
            <span className="property-value">
              {info.readOnly ? t("properties.yes") : t("properties.no")}
            </span>
          </div>
          {info.created >= 0 && (
            <div className="property-row">
              <span className="property-label">{t("properties.created")}</span>
              <span className="property-value">
                {formatDate(info.created)}
              </span>
            </div>
          )}
          {info.modified >= 0 && (
            <div className="property-row">
              <span className="property-label">{t("properties.modified")}</span>
              <span className="property-value">
                {formatDate(info.modified)}
              </span>
            </div>
          )}
          {info.accessed >= 0 && (
            <div className="property-row">
              <span className="property-label">{t("properties.accessed")}</span>
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

/** Returns a readable type label for a single file entry. */
function typeLabel(t: (key: string) => string, name: string, isDir: boolean): string {
  if (isDir) return t("properties.type_folder");

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return t("cat.file");

  const ext = name.slice(dotIndex + 1).toUpperCase();
  return `${t("cat.file")} ${ext}`;
}