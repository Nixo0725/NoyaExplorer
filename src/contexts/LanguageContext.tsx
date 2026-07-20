import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "../types";
import { createTranslate, type TranslateFn } from "../i18n";

const STORAGE_KEY = "noya:language";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") {
      return stored;
    }
  } catch {
    // localStorage peut être indisponible
  }
  return "fr";
}

function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage peut être indisponible
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(loadLanguage);

  const setLang = (next: Language) => {
    setLangState(next);
    saveLanguage(next);
  };

  const t = useMemo(() => createTranslate(lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return ctx;
}
