import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { lightTheme, darkTheme, DEFAULT_MODE } from "../themes";
import type { Theme, ThemeMode, ResolvedTheme } from "../types";

const STORAGE_KEY = "noya:theme-mode";
const LEGACY_STORAGE_KEY = "noya:theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const { colors } = theme;
  const root = document.documentElement;

  root.style.setProperty("--bg", colors.bg);
  root.style.setProperty("--bg-secondary", colors.bgSecondary);
  root.style.setProperty("--bg-tertiary", colors.bgTertiary);
  root.style.setProperty("--bg-selected", colors.bgSelected);
  root.style.setProperty("--text", colors.text);
  root.style.setProperty("--text-secondary", colors.textSecondary);
  root.style.setProperty("--text-muted", colors.textMuted);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-hover", colors.accentHover);
  root.style.setProperty("--accent-soft", colors.accentSoft);
  root.style.setProperty("--border", colors.border);
  root.style.setProperty("--border-strong", colors.borderStrong);
  root.style.setProperty("--error", colors.error);
  root.style.setProperty("--error-bg", colors.errorBg);
  root.style.setProperty("--success", colors.success);
  root.style.setProperty("--warning", colors.warning);
  root.style.setProperty("--shadow", colors.shadow);
  root.style.setProperty("--radius", colors.radius);
  root.style.setProperty("--cat-folder", colors.catFolder);
  root.style.setProperty("--cat-image", colors.catImage);
  root.style.setProperty("--cat-video", colors.catVideo);
  root.style.setProperty("--cat-audio", colors.catAudio);
  root.style.setProperty("--cat-document", colors.catDocument);
  root.style.setProperty("--cat-archive", colors.catArchive);
  root.style.setProperty("--cat-code", colors.catCode);
  root.style.setProperty("--cat-executable", colors.catExecutable);
  root.style.setProperty("--cat-other", colors.catOther);

  // Met à jour l'attribut data-theme pour d'éventuels sélecteurs CSS spécifiques
  root.setAttribute("data-theme", theme.id);
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function loadMode(): ThemeMode {
  try {
    // Migration : si l'ancienne clé existe, on la supprime et on utilise le défaut
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "auto" || stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage peut être indisponible
  }
  return DEFAULT_MODE;
}

function saveMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage peut être indisponible
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Écoute des changements de préférence système
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (mode === "auto") return systemTheme;
    return mode;
  }, [mode, systemTheme]);

  const theme: Theme = resolvedTheme === "dark" ? darkTheme : lightTheme;

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    saveMode(next);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, theme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
