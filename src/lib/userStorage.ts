const FALLBACK_UID = 'anon';

export function getStorageUid(uid?: string | null): string {
  const normalized = uid?.trim();
  return normalized && normalized.length > 0 ? normalized : FALLBACK_UID;
}

export function storageKeyForUser(baseKey: string, uid?: string | null, suffix?: string): string {
  const userSegment = getStorageUid(uid);
  return suffix ? `${baseKey}__${userSegment}__${suffix}` : `${baseKey}__${userSegment}`;
}

export function readStorageJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorageJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors in restricted contexts
  }
}
