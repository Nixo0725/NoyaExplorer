import { useState, useCallback } from "react";
import type { SearchFilters } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

const CATEGORIES = [
  "image",
  "video",
  "audio",
  "document",
  "archive",
  "code",
  "executable",
  "other",
] as const;

export default function SearchFilters({
  filters,
  onFiltersChange,
  onClear,
}: SearchFiltersProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<SearchFilters>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange],
  );

  /* ---------- Extension (string → string[]) ---------- */

  const extValue = filters.extensions?.join(", ") ?? "";

  const handleExtensions = (value: string) => {
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    update({ extensions: parts.length > 0 ? parts : undefined });
  };

  /* ---------- Dates (YYYY-MM-DD ↔ timestamp ms) ---------- */

  const dateToTimestamp = (value: string): number | undefined => {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d.getTime();
  };

  const timestampToDate = (ts: number | undefined): string => {
    if (ts === undefined || ts === null) return "";
    try {
      return new Date(ts).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  /* ---------- Bool helpers ---------- */

  const boolVal = (v: boolean | undefined): boolean => v ?? false;

  /* ---------- Détection de filtres actifs ---------- */

  const hasAnyFilter =
    filters.extensions !== undefined ||
    filters.location !== undefined ||
    filters.category !== undefined ||
    filters.minSize !== undefined ||
    filters.maxSize !== undefined ||
    filters.modifiedBefore !== undefined ||
    filters.modifiedAfter !== undefined ||
    filters.createdBefore !== undefined ||
    filters.createdAfter !== undefined ||
    filters.recentOnly === true ||
    filters.oldOnly === true ||
    filters.largeOnly === true;

  /* ---------- Rendu ---------- */

  return (
    <div className="search-filters">
      <button
        className={"search-filters-toggle" + (open ? " active" : "")}
        onClick={() => setOpen((o) => !o)}
        title={t("filters.title")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        {t("filters.title")}
      </button>

      {open && (
        <div className="search-filters-panel">
          <div className="filters-content">
            {/* ---- Extension ---- */}
            <div className="filter-group">
              <label className="filter-label">{t("filters.extension")}</label>
              <input
                className="filter-input"
                type="text"
                value={extValue}
                onChange={(e) => handleExtensions(e.target.value)}
                placeholder="pdf, doc, txt"
              />
            </div>

            {/* ---- Catégorie ---- */}
            <div className="filter-group">
              <label className="filter-label">{t("filters.category")}</label>
              <select
                className="filter-select"
                value={filters.category ?? ""}
                onChange={(e) =>
                  update({ category: e.target.value || undefined })
                }
              >
                <option value="">—</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t("cat." + cat)}
                  </option>
                ))}
              </select>
            </div>

            {/* ---- Emplacement ---- */}
            <div className="filter-group">
              <label className="filter-label">{t("filters.location")}</label>
              <input
                className="filter-input"
                type="text"
                value={filters.location ?? ""}
                onChange={(e) =>
                  update({ location: e.target.value || undefined })
                }
                placeholder={t("filters.location")}
              />
            </div>

            {/* ---- Taille min / max ---- */}
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">{t("filters.min_size")}</label>
                <input
                  className="filter-input"
                  type="number"
                  min={0}
                  value={filters.minSize ?? ""}
                  onChange={(e) =>
                    update({
                      minSize: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">{t("filters.max_size")}</label>
                <input
                  className="filter-input"
                  type="number"
                  min={0}
                  value={filters.maxSize ?? ""}
                  onChange={(e) =>
                    update({
                      maxSize: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            {/* ---- Modifié avant / après ---- */}
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">
                  {t("filters.modified_before")}
                </label>
                <input
                  className="filter-input"
                  type="date"
                  value={timestampToDate(filters.modifiedBefore)}
                  onChange={(e) =>
                    update({ modifiedBefore: dateToTimestamp(e.target.value) })
                  }
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">
                  {t("filters.modified_after")}
                </label>
                <input
                  className="filter-input"
                  type="date"
                  value={timestampToDate(filters.modifiedAfter)}
                  onChange={(e) =>
                    update({ modifiedAfter: dateToTimestamp(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* ---- Créé avant / après ---- */}
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">
                  {t("filters.created_before")}
                </label>
                <input
                  className="filter-input"
                  type="date"
                  value={timestampToDate(filters.createdBefore)}
                  onChange={(e) =>
                    update({ createdBefore: dateToTimestamp(e.target.value) })
                  }
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">
                  {t("filters.created_after")}
                </label>
                <input
                  className="filter-input"
                  type="date"
                  value={timestampToDate(filters.createdAfter)}
                  onChange={(e) =>
                    update({ createdAfter: dateToTimestamp(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* ---- Checkboxes ---- */}
            <div className="filter-checkboxes">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={boolVal(filters.recentOnly)}
                  onChange={(e) =>
                    update({ recentOnly: e.target.checked || undefined })
                  }
                />
                {t("filters.recent_only")}
              </label>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={boolVal(filters.oldOnly)}
                  onChange={(e) =>
                    update({ oldOnly: e.target.checked || undefined })
                  }
                />
                {t("filters.old_only")}
              </label>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={boolVal(filters.largeOnly)}
                  onChange={(e) =>
                    update({ largeOnly: e.target.checked || undefined })
                  }
                />
                {t("filters.large_only")}
              </label>
            </div>

            {/* ---- Actions ---- */}
            <div className="filter-actions">
              <button
                className="ghost-btn"
                onClick={onClear}
                disabled={!hasAnyFilter}
              >
                {t("filters.clear")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
