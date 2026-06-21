/** Splits a path into breadcrumb segments for display. */
export interface BreadcrumbSegment {
  label: string;
  path: string;
}

/**
 * Converts an absolute path into clickable breadcrumb segments.
 * Handles Windows paths (C:\Users\...) and Unix paths (/home/...).
 */
export function toBreadcrumbs(path: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  // Windows path: C:\Users\robin\Documents
  if (/^[a-zA-Z]:[\\/]/.test(path)) {
    const driveLetter = path[0].toUpperCase();
    segments.push({ label: `Disque (${driveLetter}:)`, path: `${driveLetter}:\\` });

    const rest = path.slice(3); // skip "C:\"
    const parts = rest.split(/[\\/]/).filter(Boolean);
    let accumulated = `${driveLetter}:\\`;
    for (const part of parts) {
      accumulated = accumulated.endsWith("\\") || accumulated.endsWith("/")
        ? accumulated + part
        : accumulated + "\\" + part;
      segments.push({ label: part, path: accumulated });
    }
    return segments;
  }

  // Unix path: /home/robin/Documents
  if (path.startsWith("/")) {
    segments.push({ label: "Racine", path: "/" });
    const parts = path.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated + "/" + part;
      segments.push({ label: part, path: accumulated });
    }
    return segments;
  }

  // Fallback: single segment
  segments.push({ label: path, path });
  return segments;
}

/** Returns the parent directory of a path, or null if at the root. */
export function parentPath(path: string): string | null {
  // Windows drive root: C:\
  if (/^[a-zA-Z]:[\\/]?$/.test(path)) return null;

  // Normalize separators
  const normalized = path.replace(/\//g, "\\").replace(/\\+$/, "");
  const lastSep = normalized.lastIndexOf("\\");
  if (lastSep <= 2) {
    // e.g. C:\Users -> C:\
    const driveMatch = normalized.match(/^([a-zA-Z]:)/);
    if (driveMatch) return `${driveMatch[1]}\\`;
    return null;
  }
  return normalized.slice(0, lastSep);
}
