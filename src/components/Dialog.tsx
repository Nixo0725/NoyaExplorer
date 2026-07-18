import { useEffect, useRef, useState } from "react";

interface DialogProps {
  title: string;
  message?: string;
  inputLabel?: string;
  inputValue?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: (value?: string) => void;
  onClose: () => void;
}

export default function Dialog({
  title,
  message,
  inputLabel,
  inputValue = "",
  confirmLabel,
  cancelLabel = "Annuler",
  danger = false,
  onConfirm,
  onClose,
}: DialogProps) {
  const [value, setValue] = useState(inputValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInput = inputLabel !== undefined;

  useEffect(() => {
    if (hasInput && inputRef.current) {
      inputRef.current.focus();
      // Sélectionne le nom sans l'extension
      const dotIndex = inputValue.lastIndexOf(".");
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [hasInput, inputValue]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleConfirm = () => {
    if (hasInput) {
      const trimmed = value.trim();
      if (trimmed) onConfirm(trimmed);
    } else {
      onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="dialog-title">{title}</h2>
        {message && <p className="dialog-message">{message}</p>}
        {hasInput && (
          <div className="dialog-input-group">
            {inputLabel && (
              <label className="dialog-input-label">{inputLabel}</label>
            )}
            <input
              ref={inputRef}
              className="dialog-input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
        <div className="dialog-actions">
          <button className="dialog-btn dialog-cancel" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={`dialog-btn dialog-confirm ${danger ? "danger" : ""}`}
            onClick={handleConfirm}
            disabled={hasInput && !value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}