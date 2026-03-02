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
  setRouteThemeOverride: (theme: EffectiveTheme | null) => void;
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
  const [effectiveBase, setEffectiveBase] = useState<EffectiveTheme>(() =>
    getEffective(getStoredPref()),
  );
  const [routeThemeOverride, setRouteThemeOverrideState] = useState<EffectiveTheme | null>(null);
  const effective = routeThemeOverride ?? effectiveBase;

  const setPref = useCallback((newPref: ThemePref) => {
    localStorage.setItem(STORAGE_KEY, newPref);
    setPrefState(newPref);
    setEffectiveBase(getEffective(newPref));
  }, []);

  const setRouteThemeOverride = useCallback((theme: EffectiveTheme | null) => {
    setRouteThemeOverrideState(theme);
  }, []);

  // Keep DOM in sync with active theme (preference + temporary route override)
  useEffect(() => {
    applyToDOM(effective);
  }, [effective]);

  // System media-query listener — active ONLY when pref === 'system'
  useEffect(() => {
    if (pref !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      const eff: EffectiveTheme = e.matches ? 'light' : 'dark';
      setEffectiveBase(eff);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [pref]);

  return (
    <ThemeContext.Provider value={{ pref, effective, setPref, setRouteThemeOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}
