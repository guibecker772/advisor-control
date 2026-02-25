import { readStorageJSON, storageKeyForUser, writeStorageJSON } from './userStorage';

export type SavedViewScope = 'clients' | 'prospects';

export interface SavedViewSort {
  id: string;
  desc: boolean;
}

export interface SavedViewSnapshot {
  searchTerm: string;
  filters: Record<string, string | number | boolean | null | undefined>;
  sort: SavedViewSort | null;
}

export interface SavedView {
  id: string;
  name: string;
  scope: SavedViewScope;
  snapshot: SavedViewSnapshot;
  pinned: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

const SAVED_VIEWS_BASE_KEY = 'ac_saved_views_v1';
const PIN_LIMIT = 5;

export function getSavedViewsKey(uid: string | undefined, scope: SavedViewScope): string {
  return storageKeyForUser(SAVED_VIEWS_BASE_KEY, uid, scope);
}

export function readSavedViews(uid: string | undefined, scope: SavedViewScope): SavedView[] {
  const key = getSavedViewsKey(uid, scope);
  const raw = readStorageJSON<SavedView[]>(key, []);
  return normalizeSavedViews(raw, scope);
}

export function writeSavedViews(uid: string | undefined, scope: SavedViewScope, views: SavedView[]): void {
  const key = getSavedViewsKey(uid, scope);
  writeStorageJSON(key, normalizeSavedViews(views, scope));
}

export function createSavedView(scope: SavedViewScope, name: string, snapshot: SavedViewSnapshot): SavedView {
  const now = Date.now();
  return {
    id: `${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    scope,
    snapshot,
    pinned: false,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function sortSavedViews(views: SavedView[]): SavedView[] {
  return [...views].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function ensureSingleDefault(views: SavedView[], defaultId: string): SavedView[] {
  return views.map((view) => ({ ...view, isDefault: view.id === defaultId }));
}

export function enforcePinLimit(views: SavedView[]): SavedView[] {
  const pinned = views.filter((view) => view.pinned);
  if (pinned.length <= PIN_LIMIT) return views;

  const sortedPinned = [...pinned].sort((a, b) => b.updatedAt - a.updatedAt);
  const allowedPinned = new Set(sortedPinned.slice(0, PIN_LIMIT).map((view) => view.id));
  return views.map((view) => ({ ...view, pinned: allowedPinned.has(view.id) }));
}

function normalizeSavedViews(views: SavedView[], scope: SavedViewScope): SavedView[] {
  const normalized = views.map((view) => ({
    ...view,
    scope,
    snapshot: {
      searchTerm: view.snapshot?.searchTerm ?? '',
      filters: view.snapshot?.filters ?? {},
      sort: view.snapshot?.sort ?? null,
    },
    pinned: Boolean(view.pinned),
    isDefault: Boolean(view.isDefault),
    createdAt: typeof view.createdAt === 'number' ? view.createdAt : Date.now(),
    updatedAt: typeof view.updatedAt === 'number' ? view.updatedAt : Date.now(),
  }));

  const defaultView = normalized.find((view) => view.isDefault);
  const withSingleDefault = defaultView
    ? ensureSingleDefault(normalized, defaultView.id)
    : normalized;

  return sortSavedViews(enforcePinLimit(withSingleDefault));
}
