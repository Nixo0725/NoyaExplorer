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
}

const EXTENSION_MAP: Record<string, TypeInfo> = {
  // Images
  png: { category: "image" },
  jpg: { category: "image" },
  jpeg: { category: "image" },
  gif: { category: "image" },
  webp: { category: "image" },
  svg: { category: "image" },
  bmp: { category: "image" },
  // Videos
  mp4: { category: "video" },
  mkv: { category: "video" },
  mov: { category: "video" },
  avi: { category: "video" },
  webm: { category: "video" },
  // Audio
  mp3: { category: "audio" },
  wav: { category: "audio" },
  flac: { category: "audio" },
  ogg: { category: "audio" },
  // Documents
  pdf: { category: "document" },
  doc: { category: "document" },
  docx: { category: "document" },
  xls: { category: "document" },
  xlsx: { category: "document" },
  ppt: { category: "document" },
  pptx: { category: "document" },
  txt: { category: "document" },
  md: { category: "document" },
  // Archives
  zip: { category: "archive" },
  rar: { category: "archive" },
  "7z": { category: "archive" },
  tar: { category: "archive" },
  gz: { category: "archive" },
  // Code
  js: { category: "code" },
  ts: { category: "code" },
  tsx: { category: "code" },
  jsx: { category: "code" },
  rs: { category: "code" },
  py: { category: "code" },
  json: { category: "code" },
  html: { category: "code" },
  css: { category: "code" },
  // Executables
  exe: { category: "executable" },
  msi: { category: "executable" },
  bat: { category: "executable" },
  sh: { category: "executable" },
};

const FOLDER_INFO: TypeInfo = { category: "folder" };
const OTHER_INFO: TypeInfo = { category: "other" };

export function getTypeInfo(name: string, isDir: boolean): TypeInfo {
  if (isDir) return FOLDER_INFO;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return OTHER_INFO;

  const ext = name.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? OTHER_INFO;
}
