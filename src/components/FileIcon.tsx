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

const CATEGORY_COLOR: Record<FileCategory, string> = {
  folder: "#64748b",
  image: "#94a3b8",
  video: "#94a3b8",
  audio: "#94a3b8",
  document: "#94a3b8",
  archive: "#94a3b8",
  code: "#94a3b8",
  executable: "#94a3b8",
  other: "#94a3b8",
};

export default function FileIcon({ category, size = 16 }: FileIconProps) {
  const Icon = CATEGORY_ICON[category];
  const color = CATEGORY_COLOR[category];
  return <Icon size={size} color={color} />;
}
