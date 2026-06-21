import type { FileCategory } from "./fileType";

const LABELS: Record<FileCategory, string> = {
  folder: "Dossier",
  image: "Image",
  video: "Vidéo",
  audio: "Audio",
  document: "Document",
  archive: "Archive",
  code: "Code",
  executable: "Exécutable",
  other: "Autre",
};

export function categoryLabel(category: FileCategory | string): string {
  if (category in LABELS) {
    return LABELS[category as FileCategory];
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function typeLabel(name: string, isDir: boolean): string {
  if (isDir) return "Dossier";

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return "Fichier";

  const ext = name.slice(dotIndex + 1).toUpperCase();
  return `Fichier ${ext}`;
}
