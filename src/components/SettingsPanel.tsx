import { X, Monitor, Sun, Moon, type LucideIcon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { ThemeMode } from "../types";

interface SettingsPanelProps {
  onClose: () => void;
}

interface ModeOption {
  mode: ThemeMode;
  label: string;
  icon: LucideIcon;
}

const MODE_OPTIONS: ModeOption[] = [
  { mode: "auto", label: "Auto", icon: Monitor },
  { mode: "light", label: "Clair", icon: Sun },
  { mode: "dark", label: "Sombre", icon: Moon },
];

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { mode, setMode } = useTheme();

  return (
    <aside className="settings-panel">
      <div className="settings-header">
        <h2>Paramètres</h2>
        <button className="icon-btn" onClick={onClose} title="Fermer">
          <X size={16} />
        </button>
      </div>

      <section className="settings-section">
        <h3 className="settings-section-title">Apparence</h3>
        <p className="settings-section-desc">
          Choisis le mode d'affichage. Le mode Auto suit la préférence de ton
          système (clair ou sombre).
        </p>

        <div className="theme-switcher" role="radiogroup" aria-label="Mode d'affichage">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = opt.mode === mode;
            return (
              <button
                key={opt.mode}
                role="radio"
                aria-checked={active}
                className={`theme-option ${active ? "active" : ""}`}
                onClick={() => setMode(opt.mode)}
                title={opt.label}
              >
                <span className="theme-option-icon">
                  <Icon size={14} />
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
