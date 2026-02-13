import {
  type PrivateWealthIntent,
  type PrivateWealthResolveResponse,
  resolvePrivateWealthLink,
} from './privateWealthIntegration';

interface IntegrationAuthLike {
  uid?: string;
  tenantId?: string | null;
  tenant?: { id?: string | null } | null;
}

interface OpenPrivateWealthOptions {
  acClientId: string;
  intent: PrivateWealthIntent;
  user: IntegrationAuthLike | null | undefined;
}

/**
 * Single helper used by the client detail CTAs.
 * It resolves the next URL (linked vs link flow) and opens in a new tab.
 */
export async function openPrivateWealthInNewTab({
  acClientId,
  intent,
  user,
}: OpenPrivateWealthOptions): Promise<PrivateWealthResolveResponse> {
  const response = await resolvePrivateWealthLink(acClientId, user, intent);
  const targetUrl = response.kind === 'linked' ? response.openUrl : response.linkUrl;

  const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(targetUrl);
  }

  return response;
}
