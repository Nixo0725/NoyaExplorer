import { X, Monitor, Sun, Moon, Languages, type LucideIcon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { ThemeMode } from "../types";

interface SettingsPanelProps {
  onClose: () => void;
}

interface ModeOption {
  mode: ThemeMode;
  labelKey: string;
  icon: LucideIcon;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { mode, setMode } = useTheme();
  const { lang, setLang, t } = useLanguage();

  const MODE_OPTIONS: ModeOption[] = [
    { mode: "auto", labelKey: "settings.theme_auto", icon: Monitor },
    { mode: "light", labelKey: "settings.theme_light", icon: Sun },
    { mode: "dark", labelKey: "settings.theme_dark", icon: Moon },
  ];

  return (
    <aside className="settings-panel">
      <div className="settings-header">
        <h2>{t("settings.title")}</h2>
        <button className="icon-btn" onClick={onClose} title={t("settings.close")}>
          <X size={16} />
        </button>
      </div>

      <section className="settings-section">
        <h3 className="settings-section-title">{t("settings.appearance")}</h3>
        <p className="settings-section-desc">
          {t("settings.appearance_desc")}
        </p>

        <div className="theme-switcher" role="radiogroup" aria-label={t("settings.appearance")}>
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = opt.mode === mode;
            const label = t(opt.labelKey);
            return (
              <button
                key={opt.mode}
                role="radio"
                aria-checked={active}
                className={`theme-option ${active ? "active" : ""}`}
                onClick={() => setMode(opt.mode)}
                title={label}
              >
                <span className="theme-option-icon">
                  <Icon size={14} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t("settings.language")}</h3>
        <p className="settings-section-desc">
          {t("settings.mode_english_desc")}
        </p>

        <div className="language-switcher">
          <button
            className={`theme-option ${lang === "fr" ? "active" : ""}`}
            onClick={() => setLang("fr")}
            title="Français"
          >
            <span className="theme-option-icon">
              <Languages size={14} />
            </span>
            Français
          </button>
          <button
            className={`theme-option ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
            title="English"
          >
            <span className="theme-option-icon">
              <Languages size={14} />
            </span>
            English
          </button>
        </div>
      </section>
    </aside>
  );
}
