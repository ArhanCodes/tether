import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { t, tpl, type Language, SUPPORTED_LANGUAGES } from "./i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translation object for the current language */
  i: ReturnType<typeof t>;
  /** Template interpolation helper */
  tpl: typeof tpl;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage = "English",
  children,
}: {
  initialLanguage?: string;
  children: ReactNode;
}) {
  const [language, setLang] = useState<Language>(
    SUPPORTED_LANGUAGES.includes(initialLanguage as Language)
      ? (initialLanguage as Language)
      : "English",
  );

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
  }, []);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    i: t(language),
    tpl,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export { SUPPORTED_LANGUAGES, type Language };
