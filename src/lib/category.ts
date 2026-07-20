import type { FileCategory } from "./fileType";
import type { TranslateFn } from "../i18n";

const LABELS: Record<FileCategory, string> = {
  folder: "cat.folder",
  image: "cat.image",
  video: "cat.video",
  audio: "cat.audio",
  document: "cat.document",
  archive: "cat.archive",
  code: "cat.code",
  executable: "cat.executable",
  other: "cat.other",
};

/** Returns a human-readable label for a file category (translated). */
export function categoryLabel(t: TranslateFn, category: FileCategory | string): string {
  if (category in LABELS) {
    return t(LABELS[category as FileCategory]);
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Returns a readable type label for a single file entry (translated). */
export function typeLabel(t: TranslateFn, name: string, isDir: boolean): string {
  if (isDir) return t("cat.folder");

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return t("cat.file");

  const ext = name.slice(dotIndex + 1).toUpperCase();
  return `${t("cat.file")} ${ext}`;
}
