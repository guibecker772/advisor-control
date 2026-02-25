import { describe, expect, it } from 'vitest';
import {
  applyTemporaryDarkTheme,
  captureThemeDomSnapshot,
  restoreThemeDomSnapshot,
  type ThemeDomTarget,
} from './useLoginDarkModeOverride';

function createMockThemeRoot(initialClasses: string[] = [], initialDataTheme: string | null = null): ThemeDomTarget {
  const classSet = new Set(initialClasses);
  const attrs = new Map<string, string>();

  if (initialDataTheme !== null) {
    attrs.set('data-theme', initialDataTheme);
  }

  return {
    classList: {
      add: (...tokens: string[]) => tokens.forEach((token) => classSet.add(token)),
      remove: (...tokens: string[]) => tokens.forEach((token) => classSet.delete(token)),
      contains: (token: string) => classSet.has(token),
      toggle: (token: string, force?: boolean) => {
        if (force === undefined) {
          if (classSet.has(token)) {
            classSet.delete(token);
            return false;
          }
          classSet.add(token);
          return true;
        }
        if (force) {
          classSet.add(token);
          return true;
        }
        classSet.delete(token);
        return false;
      },
      replace: (...args: string[]) => {
        void args;
        return false;
      },
      item: (...args: number[]) => {
        void args;
        return null;
      },
      forEach: (...args: unknown[]) => {
        void args;
      },
      [Symbol.iterator]: function* () { yield* classSet; },
      get length() { return classSet.size; },
      value: Array.from(classSet).join(' '),
      supports: (...args: string[]) => {
        void args;
        return true;
      },
      entries: function* () {
        let i = 0;
        for (const token of classSet) {
          yield [i++, token] as [number, string];
        }
      },
      keys: function* () {
        let i = 0;
        for (const token of classSet) {
          void token;
          yield i++;
        }
      },
      values: function* () { yield* classSet; },
    } as unknown as DOMTokenList,
    getAttribute: (qualifiedName: string) => attrs.get(qualifiedName) ?? null,
    setAttribute: (qualifiedName: string, value: string) => {
      attrs.set(qualifiedName, value);
    },
    removeAttribute: (qualifiedName: string) => {
      attrs.delete(qualifiedName);
    },
  };
}

describe('useLoginDarkModeOverride helpers', () => {
  it('applies temporary dark and restores previous dom snapshot', () => {
    const root = createMockThemeRoot(['light'], null);

    const snapshot = captureThemeDomSnapshot(root);
    applyTemporaryDarkTheme(root);

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
    expect(root.getAttribute('data-theme')).toBe('dark');

    restoreThemeDomSnapshot(root, snapshot);

    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('restores explicit data-theme and classes', () => {
    const root = createMockThemeRoot(['dark'], 'system');

    const snapshot = captureThemeDomSnapshot(root);
    applyTemporaryDarkTheme(root);
    restoreThemeDomSnapshot(root, snapshot);

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
    expect(root.getAttribute('data-theme')).toBe('system');
  });
});
