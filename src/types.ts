export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  /** Modification time in milliseconds since the Unix epoch. -1 when unavailable. */
  modified: number;
}

export type SortKey = "name" | "size" | "type" | "modified";
export type SortDirection = "asc" | "desc";

export interface SpecialDir {
  label: string;
  path: string;
}

export interface DriveInfo {
  letter: string;
  path: string;
  label: string;
}

export interface CategoryStat {
  category: string;
  size: number;
  count: number;
}

export interface StorageStats {
  totalSize: number;
  fileCount: number;
  byCategory: CategoryStat[];
}

/* ---------- File management ---------- */

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  created: number;
  modified: number;
  accessed: number;
  readOnly: boolean;
  extension: string;
}

export interface ClipboardState {
  paths: string[];
  operation: "copy" | "cut";
}

/* ---------- Theme system ---------- */

/** Mode sélectionné par l'utilisateur. "auto" suit le système. */
export type ThemeMode = "auto" | "light" | "dark";

/** Thème effectivement appliqué (résolu depuis le mode + préférence système). */
export type ResolvedTheme = "light" | "dark";

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgSelected: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  border: string;
  borderStrong: string;
  error: string;
  errorBg: string;
  success: string;
  warning: string;
  shadow: string;
  radius: string;
  /** Couleurs des icônes par catégorie de fichier */
  catFolder: string;
  catImage: string;
  catVideo: string;
  catAudio: string;
  catDocument: string;
  catArchive: string;
  catCode: string;
  catExecutable: string;
  catOther: string;
}

export interface Theme {
  id: ResolvedTheme;
  name: string;
  colors: ThemeColors;
}
