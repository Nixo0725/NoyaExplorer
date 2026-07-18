import {
  Folder,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  FileArchive,
  FileCode,
  Settings,
  File,
  type LucideIcon,
} from "lucide-react";
import type { FileCategory } from "../lib/fileType";

interface FileIconProps {
  category: FileCategory;
  size?: number;
}

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  archive: FileArchive,
  code: FileCode,
  executable: Settings,
  other: File,
};

/** Variables CSS correspondant aux couleurs de chaque catégorie. */
const CATEGORY_COLOR_VAR: Record<FileCategory, string> = {
  folder: "var(--cat-folder)",
  image: "var(--cat-image)",
  video: "var(--cat-video)",
  audio: "var(--cat-audio)",
  document: "var(--cat-document)",
  archive: "var(--cat-archive)",
  code: "var(--cat-code)",
  executable: "var(--cat-executable)",
  other: "var(--cat-other)",
};

export default function FileIcon({ category, size = 16 }: FileIconProps) {
  const Icon = CATEGORY_ICON[category];
  const color = CATEGORY_COLOR_VAR[category];
  return <Icon size={size} color={color} />;
}
