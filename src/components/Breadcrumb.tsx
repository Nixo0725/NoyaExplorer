import { useEffect, useRef, useState } from "react";
import { toBreadcrumbs } from "../lib/path";

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(path);
  }, [path]);

  const segments = toBreadcrumbs(path);

  const commitEdit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== path) {
      onNavigate(trimmed);
    } else {
      setEditValue(path);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="breadcrumb-input"
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit();
          if (e.key === "Escape") {
            setEditing(false);
            setEditValue(path);
          }
        }}
      />
    );
  }

  return (
    <div
      className="breadcrumb"
      onClick={() => setEditing(true)}
      title="Cliquez pour saisir un chemin"
    >
      {segments.map((seg, i) => (
        <span key={seg.path} className="breadcrumb-segment">
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          <button
            className="breadcrumb-button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(seg.path);
            }}
            title={seg.path}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export default Breadcrumb;
