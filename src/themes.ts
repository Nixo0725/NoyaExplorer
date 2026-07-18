import type { Theme, ThemeMode } from "./types";

/**
 * Palette claire — fond neutre très clair, accent violet #8b5cf6.
 * Contraste WCAG AA respecté pour les paires texte/fond.
 */
export const lightTheme: Theme = {
  id: "light",
  name: "Clair",
  colors: {
    bg: "#fafafa",
    bgSecondary: "#f4f4f5",
    bgTertiary: "#e4e4e7",
    bgSelected: "#ede9fe",
    text: "#18181b",
    textSecondary: "#3f3f46",
    textMuted: "#71717a",
    accent: "#8b5cf6",
    accentHover: "#7c3aed",
    accentSoft: "rgba(139, 92, 246, 0.10)",
    border: "#e4e4e7",
    borderStrong: "#d4d4d8",
    error: "#dc2626",
    errorBg: "rgba(220, 38, 38, 0.08)",
    success: "#16a34a",
    warning: "#d97706",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
    radius: "3px",
    catFolder: "#6366f1",
    catImage: "#ec4899",
    catVideo: "#f97316",
    catAudio: "#14b8a6",
    catDocument: "#3b82f6",
    catArchive: "#f59e0b",
    catCode: "#10b981",
    catExecutable: "#ef4444",
    catOther: "#71717a",
  },
};

/**
 * Palette sombre — fond zinc-900, accent violet #a78bfa (plus lumineux pour le sombre).
 */
export const darkTheme: Theme = {
  id: "dark",
  name: "Sombre",
  colors: {
    bg: "#18181b",
    bgSecondary: "#1f1f23",
    bgTertiary: "#27272a",
    bgSelected: "rgba(167, 139, 250, 0.18)",
    text: "#fafafa",
    textSecondary: "#d4d4d8",
    textMuted: "#a1a1aa",
    accent: "#a78bfa",
    accentHover: "#c4b5fd",
    accentSoft: "rgba(167, 139, 250, 0.15)",
    border: "#27272a",
    borderStrong: "#3f3f46",
    error: "#f87171",
    errorBg: "rgba(248, 113, 113, 0.10)",
    success: "#4ade80",
    warning: "#fbbf24",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
    radius: "3px",
    catFolder: "#818cf8",
    catImage: "#f472b6",
    catVideo: "#fb923c",
    catAudio: "#2dd4bf",
    catDocument: "#60a5fa",
    catArchive: "#fbbf24",
    catCode: "#34d399",
    catExecutable: "#f87171",
    catOther: "#a1a1aa",
  },
};

export const themes: Theme[] = [lightTheme, darkTheme];

export const DEFAULT_MODE: ThemeMode = "auto";
