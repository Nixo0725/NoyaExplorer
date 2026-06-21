export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

export type SortKey = "name" | "size" | "type" | "modified";
export type SortDirection = "asc" | "desc";
