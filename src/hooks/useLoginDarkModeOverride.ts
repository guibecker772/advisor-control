import { useLayoutEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export interface ThemeDomSnapshot {
  hadLightClass: boolean;
  hadDarkClass: boolean;
  dataTheme: string | null;
}

export type ThemeDomTarget = Pick<HTMLElement, 'classList' | 'getAttribute' | 'setAttribute' | 'removeAttribute'>;

export function captureThemeDomSnapshot(root: ThemeDomTarget): ThemeDomSnapshot {
  return {
    hadLightClass: root.classList.contains('light'),
    hadDarkClass: root.classList.contains('dark'),
    dataTheme: root.getAttribute('data-theme'),
  };
}

export function applyTemporaryDarkTheme(root: ThemeDomTarget): void {
  root.classList.remove('light');
  root.classList.add('dark');
  root.setAttribute('data-theme', 'dark');
}

export function restoreThemeDomSnapshot(root: ThemeDomTarget, snapshot: ThemeDomSnapshot): void {
  root.classList.toggle('light', snapshot.hadLightClass);
  root.classList.toggle('dark', snapshot.hadDarkClass);

  if (snapshot.dataTheme === null) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', snapshot.dataTheme);
  }
}

/**
 * Forces a temporary dark theme while login is mounted.
 * Restores the exact previous DOM state on unmount.
 */
export function useLoginDarkModeOverride(): void {
  const { setRouteThemeOverride } = useTheme();
  const snapshotRef = useRef<ThemeDomSnapshot | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;

    snapshotRef.current = captureThemeDomSnapshot(root);

    setRouteThemeOverride('dark');
    applyTemporaryDarkTheme(root);

    return () => {
      setRouteThemeOverride(null);

      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      restoreThemeDomSnapshot(root, snapshot);
    };
  }, [setRouteThemeOverride]);
}
