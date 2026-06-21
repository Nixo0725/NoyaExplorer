export type FileCategory =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "executable"
  | "other";

interface TypeInfo {
  category: FileCategory;
  icon: string;
}

const EXTENSION_MAP: Record<string, TypeInfo> = {
  png: { category: "image", icon: "🖼️" },
  jpg: { category: "image", icon: "🖼️" },
  jpeg: { category: "image", icon: "🖼️" },
  gif: { category: "image", icon: "🖼️" },
  webp: { category: "image", icon: "🖼️" },
  svg: { category: "image", icon: "🖼️" },
  bmp: { category: "image", icon: "🖼️" },
  mp4: { category: "video", icon: "🎬" },
  mkv: { category: "video", icon: "🎬" },
  mov: { category: "video", icon: "🎬" },
  avi: { category: "video", icon: "🎬" },
  webm: { category: "video", icon: "🎬" },
  mp3: { category: "audio", icon: "🎵" },
  wav: { category: "audio", icon: "🎵" },
  flac: { category: "audio", icon: "🎵" },
  ogg: { category: "audio", icon: "🎵" },
  pdf: { category: "document", icon: "📄" },
  doc: { category: "document", icon: "📄" },
  docx: { category: "document", icon: "📄" },
  xls: { category: "document", icon: "📄" },
  xlsx: { category: "document", icon: "📄" },
  ppt: { category: "document", icon: "📄" },
  pptx: { category: "document", icon: "📄" },
  txt: { category: "document", icon: "📄" },
  md: { category: "document", icon: "📄" },
  zip: { category: "archive", icon: "🗜️" },
  rar: { category: "archive", icon: "🗜️" },
  "7z": { category: "archive", icon: "🗜️" },
  tar: { category: "archive", icon: "🗜️" },
  gz: { category: "archive", icon: "🗜️" },
  js: { category: "code", icon: "📜" },
  ts: { category: "code", icon: "📜" },
  tsx: { category: "code", icon: "📜" },
  jsx: { category: "code", icon: "📜" },
  rs: { category: "code", icon: "📜" },
  py: { category: "code", icon: "📜" },
  json: { category: "code", icon: "📜" },
  html: { category: "code", icon: "📜" },
  css: { category: "code", icon: "📜" },
  exe: { category: "executable", icon: "⚙️" },
  msi: { category: "executable", icon: "⚙️" },
  bat: { category: "executable", icon: "⚙️" },
  sh: { category: "executable", icon: "⚙️" },
};

const FOLDER_INFO: TypeInfo = { category: "folder", icon: "📁" };
const OTHER_INFO: TypeInfo = { category: "other", icon: "📄" };

export function getTypeInfo(name: string, isDir: boolean): TypeInfo {
  if (isDir) return FOLDER_INFO;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return OTHER_INFO;

  const ext = name.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? OTHER_INFO;
}
