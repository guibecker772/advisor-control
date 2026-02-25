import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────
export type ThemePref = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

// ── Pure helpers (also used by the anti-FOUC script in index.html) ─
function getStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch { /* SSR / incognito fallback */ }
  return 'system';
}

function getEffective(pref: ThemePref): EffectiveTheme {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

function applyToDOM(eff: EffectiveTheme) {
  const html = document.documentElement;
  if (eff === 'light') {
    html.classList.add('light');
  } else {
    html.classList.remove('light');
  }
}

// ── Context ────────────────────────────────────────────
interface ThemeContextData {
  pref: ThemePref;
  effective: EffectiveTheme;
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(getStoredPref);
  const [effective, setEffective] = useState<EffectiveTheme>(() =>
    getEffective(getStoredPref()),
  );

  const setPref = useCallback((newPref: ThemePref) => {
    localStorage.setItem(STORAGE_KEY, newPref);
    setPrefState(newPref);
    const eff = getEffective(newPref);
    setEffective(eff);
    applyToDOM(eff);
  }, []);

  // Apply on mount (sync with anti-FOUC script)
  useEffect(() => {
    applyToDOM(effective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // System media-query listener — active ONLY when pref === 'system'
  useEffect(() => {
    if (pref !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      const eff: EffectiveTheme = e.matches ? 'light' : 'dark';
      setEffective(eff);
      applyToDOM(eff);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [pref]);

  return (
    <ThemeContext.Provider value={{ pref, effective, setPref }}>
      {children}
    </ThemeContext.Provider>
  );
}
