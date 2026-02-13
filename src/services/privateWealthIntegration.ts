import { resolveAccessCapabilities } from '../lib/access';
import { readStorageJSON, writeStorageJSON } from '../lib/userStorage';

type NullableTenantId = string | null;

export type PrivateWealthIntent = 'open_planning' | 'export_premium';

export interface LinkSession {
  linkKey: string;
  tenantId: NullableTenantId;
  createdByUid: string;
  acClientId: string;
  intent: PrivateWealthIntent;
  redirectAfterLinkTemplate: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface AdvisorClientLink {
  tenantId: NullableTenantId;
  advisorUserId: string;
  acClientId: string;
  pwClientId: string;
  createdAt: string;
  updatedAt: string;
}

export type PrivateWealthResolveResponse =
  | { kind: 'linked'; pwClientId: string; openUrl: string }
  | { kind: 'link'; linkKey: string; linkUrl: string };

export type PrivateWealthCallbackResult =
  | { ok: true; openUrl: string; link: AdvisorClientLink }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' | 'forbidden' };

interface IntegrationAuthLike {
  uid?: string;
  tenantId?: string | null;
  tenant?: { id?: string | null } | null;
}

const LINK_SESSIONS_STORAGE_KEY = 'ac_integration_pw_link_sessions_v1';
const CLIENT_LINKS_STORAGE_KEY = 'ac_integration_pw_client_links_v1';
const LINK_SESSION_TTL_MINUTES = 10;
const DEFAULT_PRIVATE_WEALTH_BASE_URL = 'http://localhost:5174';

const DEFAULT_INTENT: PrivateWealthIntent = 'open_planning';
const PLANNING_REDIRECT_TEMPLATE = '/dashboard/overview?clientId={{pwClientId}}';
const EXPORT_REDIRECT_TEMPLATE = '/integrations/export?clientId={{pwClientId}}&template=premium';
const REDIRECT_ALLOWLIST_PREFIXES = ['/integrations/export', '/dashboard/overview'] as const;

function normalizeBaseUrl(rawUrl: string | undefined): string {
  const safeRaw = rawUrl?.trim() || DEFAULT_PRIVATE_WEALTH_BASE_URL;
  return safeRaw.endsWith('/') ? safeRaw.slice(0, -1) : safeRaw;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getPrivateWealthBaseUrl(): string {
  return normalizeBaseUrl(import.meta.env.VITE_PRIVATE_WEALTH_BASE_URL);
}

function parseSessionDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readLinkSessions(): LinkSession[] {
  const sessions = readStorageJSON<LinkSession[]>(LINK_SESSIONS_STORAGE_KEY, []);
  return Array.isArray(sessions) ? sessions : [];
}

function writeLinkSessions(sessions: LinkSession[]): void {
  writeStorageJSON(LINK_SESSIONS_STORAGE_KEY, sessions);
}

function readAdvisorClientLinks(): AdvisorClientLink[] {
  const links = readStorageJSON<AdvisorClientLink[]>(CLIENT_LINKS_STORAGE_KEY, []);
  return Array.isArray(links) ? links : [];
}

function writeAdvisorClientLinks(links: AdvisorClientLink[]): void {
  writeStorageJSON(CLIENT_LINKS_STORAGE_KEY, links);
}

function normalizeIntent(intent: string | null | undefined): PrivateWealthIntent {
  return intent === 'export_premium' ? 'export_premium' : DEFAULT_INTENT;
}

function getRedirectTemplateByIntent(intent: PrivateWealthIntent): string {
  return intent === 'export_premium' ? EXPORT_REDIRECT_TEMPLATE : PLANNING_REDIRECT_TEMPLATE;
}

function buildLinkUrl(linkKey: string): string {
  const baseUrl = getPrivateWealthBaseUrl();
  return `${baseUrl}/integrations/link?linkKey=${encodeURIComponent(linkKey)}`;
}

function getFallbackRedirectPath(pwClientId: string): string {
  return `/dashboard/overview?clientId=${encodeURIComponent(pwClientId)}`;
}

function hasUnsafeRedirectPattern(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    value.startsWith('//') ||
    lowered.startsWith('http://') ||
    lowered.startsWith('https://') ||
    lowered.startsWith('javascript:') ||
    lowered.includes('\\') ||
    value.includes('\r') ||
    value.includes('\n')
  );
}

function isAllowedRedirectPath(path: string): boolean {
  return REDIRECT_ALLOWLIST_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function buildSafeRedirectPath(template: string, pwClientId: string): string {
  const replaced = template
    .trim()
    .split('{{pwClientId}}')
    .join(encodeURIComponent(pwClientId));

  if (!replaced.startsWith('/')) {
    return getFallbackRedirectPath(pwClientId);
  }

  if (hasUnsafeRedirectPattern(replaced)) {
    return getFallbackRedirectPath(pwClientId);
  }

  if (!isAllowedRedirectPath(replaced)) {
    return getFallbackRedirectPath(pwClientId);
  }

  return replaced;
}

function buildPrivateWealthUrl(path: string): string {
  const baseUrl = getPrivateWealthBaseUrl();
  return `${baseUrl}${path}`;
}

function buildOpenUrlByIntent(intent: PrivateWealthIntent, pwClientId: string): string {
  const template = getRedirectTemplateByIntent(intent);
  const redirectPath = buildSafeRedirectPath(template, pwClientId);
  return buildPrivateWealthUrl(redirectPath);
}

function getTenantId(user: IntegrationAuthLike | null | undefined): NullableTenantId {
  if (!user) return null;
  if (typeof user.tenantId === 'string' && user.tenantId.trim().length > 0) return user.tenantId;
  if (user.tenant && typeof user.tenant.id === 'string' && user.tenant.id.trim().length > 0) return user.tenant.id;
  return null;
}

function requireAuth(user: IntegrationAuthLike | null | undefined): { uid: string; tenantId: NullableTenantId } {
  const uid = typeof user?.uid === 'string' ? user.uid : '';
  if (!uid) throw new Error('AUTH_REQUIRED');
  return { uid, tenantId: getTenantId(user) };
}

function isExpired(session: LinkSession): boolean {
  return parseSessionDate(session.expiresAt) <= Date.now();
}

function cleanupLinkSessions(sessions: LinkSession[]): LinkSession[] {
  return sessions.filter((session) => {
    if (!session.linkKey || !session.createdByUid || !session.acClientId) return false;
    return !isExpired(session);
  });
}

function generateOpaqueLinkKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function generateUniqueLinkKey(sessions: LinkSession[]): string {
  let attempts = 0;
  let linkKey = generateOpaqueLinkKey();

  while (sessions.some((session) => session.linkKey === linkKey) && attempts < 5) {
    linkKey = generateOpaqueLinkKey();
    attempts += 1;
  }

  return linkKey;
}

function hasSameOwner(
  left: { tenantId: NullableTenantId; advisorUserId: string; acClientId: string },
  right: { tenantId: NullableTenantId; advisorUserId: string; acClientId: string },
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.advisorUserId === right.advisorUserId &&
    left.acClientId === right.acClientId
  );
}

function upsertAdvisorClientLink(
  links: AdvisorClientLink[],
  nextLink: AdvisorClientLink,
): AdvisorClientLink[] {
  const existingIndex = links.findIndex((link) =>
    hasSameOwner(
      { tenantId: link.tenantId, advisorUserId: link.advisorUserId, acClientId: link.acClientId },
      { tenantId: nextLink.tenantId, advisorUserId: nextLink.advisorUserId, acClientId: nextLink.acClientId },
    ),
  );

  if (existingIndex < 0) return [nextLink, ...links];

  const merged: AdvisorClientLink = {
    ...links[existingIndex],
    pwClientId: nextLink.pwClientId,
    updatedAt: nextLink.updatedAt,
  };

  return links.map((link, index) => (index === existingIndex ? merged : link));
}

export function getAdvisorClientLink(
  acClientId: string,
  user: IntegrationAuthLike | null | undefined,
): AdvisorClientLink | null {
  if (!acClientId) return null;

  const { uid, tenantId } = requireAuth(user);
  const links = readAdvisorClientLinks();

  return (
    links.find((link) =>
      hasSameOwner(
        { tenantId: link.tenantId, advisorUserId: link.advisorUserId, acClientId: link.acClientId },
        { tenantId, advisorUserId: uid, acClientId },
      ),
    ) || null
  );
}

export async function resolvePrivateWealthLink(
  acClientId: string,
  user: IntegrationAuthLike | null | undefined,
  intent: PrivateWealthIntent = DEFAULT_INTENT,
): Promise<PrivateWealthResolveResponse> {
  if (!acClientId?.trim()) throw new Error('INVALID_CLIENT');

  const normalizedIntent = normalizeIntent(intent);
  const { uid, tenantId } = requireAuth(user);
  const access = resolveAccessCapabilities(user);

  if (normalizedIntent === 'export_premium' && !access.canExportPrivateWealthReport) {
    throw new Error('EXPORT_FORBIDDEN');
  }

  const existingLink = getAdvisorClientLink(acClientId, user);

  if (existingLink) {
    return {
      kind: 'linked',
      pwClientId: existingLink.pwClientId,
      openUrl: buildOpenUrlByIntent(normalizedIntent, existingLink.pwClientId),
    };
  }

  if (access.readOnly) {
    throw new Error('LINK_FORBIDDEN');
  }

  const sessions = cleanupLinkSessions(readLinkSessions());
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MINUTES * 60_000).toISOString();
  const linkKey = generateUniqueLinkKey(sessions);

  const nextSession: LinkSession = {
    linkKey,
    tenantId,
    createdByUid: uid,
    acClientId,
    intent: normalizedIntent,
    redirectAfterLinkTemplate: getRedirectTemplateByIntent(normalizedIntent),
    expiresAt,
    usedAt: null,
    createdAt,
  };

  writeLinkSessions([nextSession, ...sessions]);

  return {
    kind: 'link',
    linkKey,
    linkUrl: buildLinkUrl(linkKey),
  };
}

export async function consumePrivateWealthCallback(
  linkKey: string,
  pwClientId: string,
  user: IntegrationAuthLike | null | undefined,
): Promise<PrivateWealthCallbackResult> {
  if (!linkKey?.trim() || !pwClientId?.trim()) return { ok: false, reason: 'invalid' };

  const { uid, tenantId } = requireAuth(user);
  const sessions = readLinkSessions();
  const sessionIndex = sessions.findIndex((session) => session.linkKey === linkKey);

  if (sessionIndex < 0) return { ok: false, reason: 'invalid' };

  const session = sessions[sessionIndex];
  if (session.usedAt) return { ok: false, reason: 'used' };
  if (isExpired(session)) return { ok: false, reason: 'expired' };

  const ownerMatches =
    session.createdByUid === uid &&
    session.tenantId === tenantId;

  if (!ownerMatches) return { ok: false, reason: 'forbidden' };

  const createdAt = nowIso();
  const nextLink: AdvisorClientLink = {
    tenantId,
    advisorUserId: uid,
    acClientId: session.acClientId,
    pwClientId,
    createdAt,
    updatedAt: createdAt,
  };

  const links = readAdvisorClientLinks();
  const nextLinks = upsertAdvisorClientLink(links, nextLink);
  writeAdvisorClientLinks(nextLinks);

  const nextSessions = sessions.map((current, index) =>
    index === sessionIndex ? { ...current, usedAt: createdAt } : current,
  );
  writeLinkSessions(nextSessions);

  const persistedLink = nextLinks.find((link) =>
    hasSameOwner(
      { tenantId: link.tenantId, advisorUserId: link.advisorUserId, acClientId: link.acClientId },
      { tenantId, advisorUserId: uid, acClientId: session.acClientId },
    ),
  );

  if (!persistedLink) return { ok: false, reason: 'invalid' };

  const sessionIntent = normalizeIntent((session as Partial<LinkSession>).intent);
  const templateFromSession =
    typeof (session as Partial<LinkSession>).redirectAfterLinkTemplate === 'string' &&
    (session as Partial<LinkSession>).redirectAfterLinkTemplate?.trim()
      ? (session as Partial<LinkSession>).redirectAfterLinkTemplate!.trim()
      : getRedirectTemplateByIntent(sessionIntent);

  const safeRedirectPath = buildSafeRedirectPath(templateFromSession, persistedLink.pwClientId);

  return {
    ok: true,
    openUrl: buildPrivateWealthUrl(safeRedirectPath),
    link: persistedLink,
  };
}
