export type InvalidationScope =
  | 'clients'
  | 'prospects'
  | 'captacao'
  | 'metas'
  | 'dashboard'
  | 'offers'
  | 'salary'
  | 'cross'
  | 'agendas';

const EVENT_NAME = 'ac:data-invalidated';

interface InvalidationDetail {
  scopes: InvalidationScope[];
  timestamp: string;
}

export function emitDataInvalidation(scopes: InvalidationScope[]): void {
  if (typeof window === 'undefined') return;
  const uniqueScopes = Array.from(new Set(scopes));
  const detail: InvalidationDetail = {
    scopes: uniqueScopes,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<InvalidationDetail>(EVENT_NAME, { detail }));
}

export function subscribeDataInvalidation(
  scopes: InvalidationScope[],
  handler: () => void | Promise<void>,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const watchedScopes = new Set(scopes);

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<InvalidationDetail>;
    const incomingScopes = customEvent.detail?.scopes ?? [];
    if (incomingScopes.some((scope) => watchedScopes.has(scope))) {
      void handler();
    }
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener as EventListener);
  };
}
