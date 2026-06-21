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
