import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Folder,
  FileCode,
  Monitor,
  FileImage,
  FileAudio,
  FileVideo,
  Book,
  Archive,
  Layers,
  X,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Space } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

interface SpaceManagerProps {
  /** `null` ou `undefined` pour le mode création, un objet Space pour édition. */
  space?: Space | null;
  /** Ferme le dialog. */
  onClose: () => void;
  /** Callback après une modification (création, renommage, ajout/retrait dossier). */
  onChange: () => void;
}

/* ---------- Palette d'icônes ---------- */

interface IconOption {
  key: string;
  icon: LucideIcon;
  label: string;
}

const ICON_OPTIONS: IconOption[] = [
  { key: "folder", icon: Folder, label: "Dossier" },
  { key: "code", icon: FileCode, label: "Code" },
  { key: "monitor", icon: Monitor, label: "Écran" },
  { key: "image", icon: FileImage, label: "Image" },
  { key: "audio", icon: FileAudio, label: "Audio" },
  { key: "video", icon: FileVideo, label: "Vidéo" },
  { key: "book", icon: Book, label: "Livre" },
  { key: "archive", icon: Archive, label: "Archive" },
  { key: "layers", icon: Layers, label: "Calques" },
];

/**
 * Dialog de gestion d'un Space (espace de travail virtuel).
 *
 * - Mode **création** : un nom et une icône à choisir.
 * - Mode **édition** : renommer, ajouter / retirer des dossiers.
 */
export default function SpaceManager({
  space,
  onClose,
  onChange,
}: SpaceManagerProps) {
  const { t } = useLanguage();
  const isCreation = !space;

  const [name, setName] = useState(space?.name ?? "");
  const [icon, setIcon] = useState(space?.icon ?? "folder");
  const [folders, setFolders] = useState<string[]>(space?.folders ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* ---------- Re-sync quand la prop `space` change ---------- */
  useEffect(() => {
    if (space) {
      setName(space.name);
      setIcon(space.icon);
      setFolders([...space.folders]);
    } else {
      setName("");
      setIcon("folder");
      setFolders([]);
    }
    setError(null);
  }, [space]);

  /* ---------- Fermeture avec Escape ---------- */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  /* ---------- Création ---------- */

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("create_space", { name: trimmed, icon });
      onChange();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Renommage ---------- */

  const handleRename = async () => {
    if (!space) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === space.name) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("rename_space", { id: space.id, name: trimmed });
      onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Ajout d'un dossier ---------- */

  const handleAddFolder = async () => {
    if (!space) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected !== "string") return;

    // Normalisation
    const normalized = selected.replace(/[/\\]+$/, "");
    if (folders.some((f) => f.toLowerCase() === normalized.toLowerCase())) {
      return; // déjà présent, silencieux
    }

    setSaving(true);
    setError(null);
    try {
      await invoke("add_folder_to_space", { id: space.id, folder: normalized });
      setFolders((prev) => [...prev, normalized]);
      onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Retrait d'un dossier ---------- */

  const handleRemoveFolder = async (folder: string) => {
    if (!space) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("remove_folder_from_space", { id: space.id, folder });
      setFolders((prev) => prev.filter((f) => f !== folder));
      onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Validation du nom au blur ---------- */

  const handleBlur = () => {
    if (!isCreation && space && name.trim() && name.trim() !== space.name) {
      void handleRename();
    }
  };

  /* ---------- Rendu ---------- */

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-modal space-manager-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="space-manager-header">
          <h2 className="dialog-title">
            {isCreation ? t("spaces.create") : t("spaces.rename")}
          </h2>
          <button className="icon-btn icon-btn-small" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Nom */}
        <div className="dialog-input-group">
          <label className="dialog-input-label">
            {t("dialog.name_label")}
          </label>
          <input
            className="dialog-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            placeholder={t("spaces.name_placeholder")}
            autoFocus
          />
        </div>

        {/* Icône */}
        <div className="dialog-input-group">
          <label className="dialog-input-label">{t("spaces.icon")}</label>
          <div className="icon-palette">
            {ICON_OPTIONS.map((opt) => {
              const IconComp = opt.icon;
              const selected = icon === opt.key;
              return (
                <button
                  key={opt.key}
                  className={`icon-option ${selected ? "selected" : ""}`}
                  onClick={() => setIcon(opt.key)}
                  title={opt.label}
                >
                  <IconComp size={20} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Dossiers (mode édition uniquement) */}
        {!isCreation && (
          <div className="dialog-input-group">
            <div className="space-folders-header">
              <label className="dialog-input-label">
                {t("spaces.add_folder")}
              </label>
              <button
                className="icon-btn icon-btn-small"
                onClick={handleAddFolder}
                disabled={saving}
                title={t("spaces.add_folder")}
              >
                <Plus size={14} />
              </button>
            </div>

            {folders.length === 0 ? (
              <p className="space-folders-empty">{t("spaces.no_folders")}</p>
            ) : (
              <ul className="space-folders-list">
                {folders.map((folder) => (
                  <li key={folder} className="space-folder-item">
                    <span className="space-folder-path" title={folder}>
                      <Folder size={14} className="space-folder-icon" />
                      {folder}
                    </span>
                    <button
                      className="icon-btn icon-btn-small danger"
                      onClick={() => handleRemoveFolder(folder)}
                      disabled={saving}
                      title={t("spaces.remove_folder")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Erreur */}
        {error && <p className="dialog-error">{error}</p>}

        {/* Actions */}
        {isCreation && (
          <div className="dialog-actions">
            <button className="dialog-btn dialog-cancel" onClick={onClose}>
              {t("dialog.cancel")}
            </button>
            <button
              className="dialog-btn dialog-confirm"
              onClick={handleCreate}
              disabled={!name.trim() || saving}
            >
              {t("dialog.create_btn")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
