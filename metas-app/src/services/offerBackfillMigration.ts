import { offerReservationSchema, type OfferReservation, type OfferReservationInput } from '../domain/types';
import { isLocalDataDriver, offerReservationRepository } from './repositories';
import { normalizeOfferForPersistence, rebuildOfferIndex } from './offerReservationService';

const MIGRATION_KEY = 'ac_offer_backfill_v1';
const BATCH_SIZE = 500;

function getMigrationTokenKey(ownerUid: string): string {
  return `${MIGRATION_KEY}__${ownerUid}`;
}

function getOfferStorageKey(ownerUid: string): string {
  return `metas_offer_reservations_${ownerUid}`;
}

function isSameOfferShape(before: OfferReservation, after: OfferReservation): boolean {
  const beforeAttachments = before.attachments || [];
  const afterAttachments = after.attachments || [];
  return (
    (before.offerType || 'PRIVATE') === (after.offerType || 'PRIVATE')
    && Number(before.minimumInvestment || 0) === Number(after.minimumInvestment || 0)
    && (before.reservationEndDate || '') === (after.reservationEndDate || '')
    && before.competenceMonth === after.competenceMonth
    && before.status === after.status
    && before.assetClass === after.assetClass
    && before.audience === after.audience
    && (before.summary || '') === (after.summary || '')
    && beforeAttachments.length === afterAttachments.length
    && (before.liquidationDate ?? before.dataLiquidacao ?? '') === (after.liquidationDate ?? after.dataLiquidacao ?? '')
    && Boolean(before.reservaEfetuada) === Boolean(after.reservaEfetuada)
    && Boolean(before.reservaLiquidada) === Boolean(after.reservaLiquidada)
  );
}

export async function runOfferBackfillMigration(ownerUid: string): Promise<void> {
  if (!isLocalDataDriver) return;
  if (!ownerUid) return;

  const tokenKey = getMigrationTokenKey(ownerUid);
  if (localStorage.getItem(tokenKey) === '1') return;

  const offers = await offerReservationRepository.getAll(ownerUid);
  if (offers.length === 0) {
    rebuildOfferIndex(ownerUid, []);
    localStorage.setItem(tokenKey, '1');
    return;
  }

  let changed = false;
  const normalizedOffers: OfferReservation[] = [];

  for (let start = 0; start < offers.length; start += BATCH_SIZE) {
    const batch = offers.slice(start, start + BATCH_SIZE);
    for (const offer of batch) {
      try {
        const normalizedInput = normalizeOfferForPersistence(offer as OfferReservationInput);
        const normalized = offerReservationSchema.parse({
          ...normalizedInput,
          id: offer.id,
          ownerUid: offer.ownerUid,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
        });
        if (!isSameOfferShape(offer, normalized)) {
          changed = true;
        }
        normalizedOffers.push(normalized);
      } catch {
        normalizedOffers.push(offer);
      }
    }
    await Promise.resolve();
  }

  if (changed) {
    localStorage.setItem(getOfferStorageKey(ownerUid), JSON.stringify(normalizedOffers));
  }

  rebuildOfferIndex(ownerUid, normalizedOffers);
  localStorage.setItem(tokenKey, '1');
}
