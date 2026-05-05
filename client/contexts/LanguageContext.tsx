import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type FC,
  type ReactNode,
} from 'react';
import { translate, type Lang } from '@/lib/i18n';

interface LanguageContextType {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Language-aware currency formatter: "EGP 1,234.56" in EN, "1,234.56 ج.م" in AR */
  fc: (amount: number | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'iconic_lang';

const detectBrowserLang = (): Lang => {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved === 'en' || saved === 'ar') return saved;
  const browser = navigator.language.toLowerCase();
  return browser.startsWith('ar') ? 'ar' : 'en';
};

const applyDir = (lang: Lang) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir  = dir;
  document.documentElement.lang = lang;
};

export const LanguageProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const detected = detectBrowserLang();
    applyDir(detected);
    return detected;
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    applyDir(l);
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  const fc = useCallback((amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '—';
    const formatted = Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return lang === 'ar' ? `${formatted} ج.م` : `EGP ${formatted}`;
  }, [lang]);

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, t, fc }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
