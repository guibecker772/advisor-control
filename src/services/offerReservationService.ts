import {
  deriveLegacyReservationFlags,
  isLiquidated,
  normalizeCompetenceMonth,
  normalizeOfferAssetClass,
  normalizeOfferAudience,
  normalizeOfferStatus,
  type OfferStatus,
} from '../domain/offers';
import {
  offerReservationSchema,
  type OfferAllocation,
  type OfferAttachmentLink,
  type OfferReservation,
  type OfferReservationInput,
} from '../domain/types';
import { offerReservationRepository } from './repositories';

const INDEX_KEY_PREFIX = 'ac_offer_index_v1';

interface OfferIndexPayload {
  ownerUid: string;
  updatedAt: string;
  byCompetenceMonth: Record<string, string[]>;
  byCompetenceMonthStatus: Record<string, string[]>;
}

function getIndexKey(ownerUid: string): string {
  return `${INDEX_KEY_PREFIX}__${ownerUid}`;
}

function normalizeLiquidationDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOfferType(value: unknown): 'PUBLIC' | 'PRIVATE' {
  if (typeof value !== 'string') return 'PRIVATE';
  const normalized = value.trim().toUpperCase();
  return normalized === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

function normalizeAttachments(value: unknown): OfferAttachmentLink[] {
  if (!Array.isArray(value)) return [];
  const attachments: OfferAttachmentLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = normalizeText(row.name);
    const url = normalizeText(row.url);
    if (!name || !url) continue;
    attachments.push({
      id: normalizeText(row.id) || Math.random().toString(36).slice(2),
      name,
      url,
      type: normalizeText(row.type),
      createdAt: normalizeText(row.createdAt) || new Date().toISOString(),
    });
  }
  return attachments.slice(0, 10);
}

function normalizeAllocations(value: unknown): OfferAllocation[] {
  if (!Array.isArray(value)) return [];
  const allocations: OfferAllocation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const clientId = normalizeText(row.clienteId);
    if (!clientId) continue;
    const allocatedValueRaw = typeof row.allocatedValue === 'number'
      ? row.allocatedValue
      : Number(row.allocatedValue || 0);
    const allocatedValue = Number.isFinite(allocatedValueRaw) && allocatedValueRaw >= 0 ? allocatedValueRaw : 0;
    const status = typeof row.status === 'string' ? row.status.toUpperCase() : 'RESERVADA';
    allocations.push({
      clienteId: clientId,
      clienteNome: normalizeText(row.clienteNome),
      allocatedValue,
      saldoOk: row.saldoOk === true,
      reserveDate: normalizeDateOnly(row.reserveDate),
      notes: normalizeText(row.notes),
      status: status === 'LIQUIDADA' || status === 'CANCELADA' ? status : 'RESERVADA',
    });
  }
  return allocations;
}

export function normalizeOfferForPersistence(input: OfferReservationInput): OfferReservationInput {
  const explicitStatus = normalizeOfferStatus(input.status);
  const normalizedStatus = explicitStatus === 'CANCELADA'
    ? explicitStatus
    : normalizeOfferStatus(input.status, {
      reservaEfetuada: input.reservaEfetuada,
      reservaLiquidada: input.reservaLiquidada,
    });
  const liquidationDate = normalizeLiquidationDate(input.liquidationDate ?? input.dataLiquidacao);
  const status = explicitStatus === 'CANCELADA'
    ? normalizedStatus
    : isLiquidated({
      status: normalizedStatus,
      liquidationDate,
      dataLiquidacao: liquidationDate,
    })
      ? 'LIQUIDADA'
      : normalizedStatus;
  const legacyFlags = deriveLegacyReservationFlags(status);
  const reserveDate = normalizeDateOnly(input.dataReserva);
  const reservationEndDate = normalizeDateOnly(input.reservationEndDate);
  const fallbackDate = input.dataReserva || input.createdAt || new Date().toISOString();

  const assetSource = input.assetClass && input.assetClass !== 'OUTROS'
    ? input.assetClass
    : input.classeAtivo || input.assetClass;
  const normalizedAllocations = normalizeAllocations(input.clientes || []);
  const summary = normalizeText(input.summary);
  const attachments = normalizeAttachments(input.attachments);
  const minimumInvestmentRaw = typeof input.minimumInvestment === 'number'
    ? input.minimumInvestment
    : Number(input.minimumInvestment);
  const minimumInvestment = Number.isFinite(minimumInvestmentRaw) && minimumInvestmentRaw >= 0
    ? minimumInvestmentRaw
    : undefined;

  return {
    ...input,
    offerType: normalizeOfferType(input.offerType),
    minimumInvestment,
    reservationEndDate,
    classeAtivo: input.classeAtivo || 'Outros',
    competenceMonth: normalizeCompetenceMonth(input.competenceMonth, fallbackDate),
    status,
    audience: normalizeOfferAudience(input.audience),
    assetClass: normalizeOfferAssetClass(assetSource),
    dataReserva: reserveDate,
    liquidationDate,
    dataLiquidacao: liquidationDate,
    reservaEfetuada: legacyFlags.reservaEfetuada,
    reservaLiquidada: legacyFlags.reservaLiquidada,
    clientes: normalizedAllocations,
    summary,
    attachments,
  };
}

function buildOfferIndex(ownerUid: string, offers: OfferReservation[]): OfferIndexPayload {
  const byCompetenceMonth: Record<string, string[]> = {};
  const byCompetenceMonthStatus: Record<string, string[]> = {};

  for (const offer of offers) {
    if (!offer.id) continue;
    const month = normalizeCompetenceMonth(offer.competenceMonth, offer.dataReserva || offer.createdAt);
    const status = normalizeOfferStatus(offer.status, {
      reservaEfetuada: offer.reservaEfetuada,
      reservaLiquidada: offer.reservaLiquidada,
    });
    const monthStatusKey = `${month}::${status}`;

    if (!byCompetenceMonth[month]) byCompetenceMonth[month] = [];
    if (!byCompetenceMonthStatus[monthStatusKey]) byCompetenceMonthStatus[monthStatusKey] = [];

    byCompetenceMonth[month].push(offer.id);
    byCompetenceMonthStatus[monthStatusKey].push(offer.id);
  }

  return {
    ownerUid,
    updatedAt: new Date().toISOString(),
    byCompetenceMonth,
    byCompetenceMonthStatus,
  };
}

export function rebuildOfferIndex(ownerUid: string, offers: OfferReservation[]): void {
  if (!ownerUid) return;
  const payload = buildOfferIndex(ownerUid, offers);
  localStorage.setItem(getIndexKey(ownerUid), JSON.stringify(payload));
}

function readOfferIndex(ownerUid: string): OfferIndexPayload | null {
  const raw = localStorage.getItem(getIndexKey(ownerUid));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OfferIndexPayload;
    if (!parsed || parsed.ownerUid !== ownerUid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function listOffers(ownerUid: string): Promise<OfferReservation[]> {
  const offers = await offerReservationRepository.getAll(ownerUid);
  return offers;
}

export async function listOffersByCompetenceMonth(
  ownerUid: string,
  competenceMonth: string,
  statuses?: OfferStatus[],
): Promise<OfferReservation[]> {
  const offers = await listOffers(ownerUid);
  const index = readOfferIndex(ownerUid);
  const mapById = new Map<string, OfferReservation>();
  for (const offer of offers) {
    if (offer.id) {
      mapById.set(offer.id, offer);
    }
  }
  const result: OfferReservation[] = [];
  const dedupe = new Set<string>();

  if (index) {
    const statusFilter = statuses && statuses.length > 0 ? statuses : null;
    const sourceIds = statusFilter
      ? statusFilter.flatMap((status) => index.byCompetenceMonthStatus[`${competenceMonth}::${status}`] ?? [])
      : index.byCompetenceMonth[competenceMonth] ?? [];

    for (const id of sourceIds) {
      const offer = mapById.get(id);
      if (!offer || dedupe.has(id)) continue;
      dedupe.add(id);
      const offerCompetence = normalizeCompetenceMonth(offer.competenceMonth, offer.dataReserva || offer.createdAt);
      const offerStatus = normalizeOfferStatus(offer.status, {
        reservaEfetuada: offer.reservaEfetuada,
        reservaLiquidada: offer.reservaLiquidada,
      });
      if (offerCompetence !== competenceMonth) continue;
      if (statusFilter && !statusFilter.includes(offerStatus)) continue;
      result.push(offer);
    }
  }

  if (result.length > 0) {
    return result;
  }

  return offers.filter((offer) => {
    const offerCompetence = normalizeCompetenceMonth(offer.competenceMonth, offer.dataReserva || offer.createdAt);
    const offerStatus = normalizeOfferStatus(offer.status, {
      reservaEfetuada: offer.reservaEfetuada,
      reservaLiquidada: offer.reservaLiquidada,
    });
    if (offerCompetence !== competenceMonth) return false;
    if (!statuses || statuses.length === 0) return true;
    return statuses.includes(offerStatus);
  });
}

export type AddOfferReservationErrorCode =
  | 'OFFER_NOT_FOUND'
  | 'OFFER_LOCKED'
  | 'DUPLICATE_CLIENT'
  | 'INVALID_INPUT';

export interface AddOfferReservationInput {
  clientId: string;
  clientName?: string;
  reservedAmount: number;
  reserveDate?: string;
  notes?: string;
}

export interface AddOfferReservationResult {
  ok: boolean;
  offer?: OfferReservation;
  reason?: AddOfferReservationErrorCode;
  duplicateClientId?: string;
}

function isOfferLocked(offer: OfferReservation): boolean {
  const normalized = normalizeOfferStatus(offer.status, {
    reservaEfetuada: offer.reservaEfetuada,
    reservaLiquidada: offer.reservaLiquidada,
  });
  if (normalized === 'CANCELADA') return true;
  return isLiquidated({
    status: normalized,
    liquidationDate: offer.liquidationDate,
    dataLiquidacao: offer.dataLiquidacao,
  });
}

export function applyReservationToOfferSnapshot(
  offer: OfferReservation,
  input: AddOfferReservationInput,
): AddOfferReservationResult {
  if (!offer) {
    return { ok: false, reason: 'OFFER_NOT_FOUND' };
  }

  if (isOfferLocked(offer)) {
    return { ok: false, reason: 'OFFER_LOCKED' };
  }

  const clientId = normalizeText(input.clientId);
  const reservedAmountRaw = Number(input.reservedAmount);
  const reservedAmount = Number.isFinite(reservedAmountRaw) ? reservedAmountRaw : NaN;

  if (!clientId || !Number.isFinite(reservedAmount) || reservedAmount <= 0) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }

  const alreadyReserved = (offer.clientes || []).some((entry) => entry.clienteId === clientId);
  if (alreadyReserved) {
    return { ok: false, reason: 'DUPLICATE_CLIENT', duplicateClientId: clientId };
  }

  const nextClients: OfferAllocation[] = [
    ...(offer.clientes || []),
    {
      clienteId: clientId,
      clienteNome: normalizeText(input.clientName) || undefined,
      allocatedValue: reservedAmount,
      saldoOk: false,
      reserveDate: normalizeDateOnly(input.reserveDate),
      notes: normalizeText(input.notes),
      status: 'RESERVADA',
    },
  ];

  const currentStatus = normalizeOfferStatus(offer.status, {
    reservaEfetuada: offer.reservaEfetuada,
    reservaLiquidada: offer.reservaLiquidada,
  });
  const hasExistingReservations = (offer.clientes || []).length > 0;
  const nextStatus = currentStatus === 'PENDENTE' && !hasExistingReservations ? 'RESERVADA' : currentStatus;

  const nextOffer = normalizeOfferForPersistence({
    ...offer,
    status: nextStatus,
    clientes: nextClients,
  } as OfferReservationInput) as OfferReservation;

  return { ok: true, offer: nextOffer };
}

export async function addReservationToOffer(
  ownerUid: string,
  offerId: string,
  input: AddOfferReservationInput,
): Promise<AddOfferReservationResult> {
  const currentOffer = await offerReservationRepository.getById(offerId, ownerUid);
  if (!currentOffer) {
    return { ok: false, reason: 'OFFER_NOT_FOUND' };
  }

  const snapshot = applyReservationToOfferSnapshot(currentOffer, input);
  if (!snapshot.ok || !snapshot.offer) {
    return snapshot;
  }

  const updated = await updateOfferReservation(offerId, snapshot.offer, ownerUid);
  if (!updated) {
    return { ok: false, reason: 'OFFER_NOT_FOUND' };
  }

  return { ok: true, offer: updated };
}

export async function createOfferReservation(input: OfferReservationInput, ownerUid: string): Promise<OfferReservation> {
  const normalized = normalizeOfferForPersistence(input);
  const parsed = offerReservationSchema.parse(normalized);
  const created = await offerReservationRepository.create(parsed, ownerUid);
  const all = await offerReservationRepository.getAll(ownerUid);
  rebuildOfferIndex(ownerUid, all);
  return created;
}

export async function updateOfferReservation(
  id: string,
  input: OfferReservationInput,
  ownerUid: string,
): Promise<OfferReservation | null> {
  const normalized = normalizeOfferForPersistence(input);
  const parsed = offerReservationSchema.parse(normalized);
  const updated = await offerReservationRepository.update(id, parsed, ownerUid);
  const all = await offerReservationRepository.getAll(ownerUid);
  rebuildOfferIndex(ownerUid, all);
  return updated;
}

export async function deleteOfferReservation(id: string, ownerUid: string): Promise<boolean> {
  const deleted = await offerReservationRepository.delete(id, ownerUid);
  if (deleted) {
    const all = await offerReservationRepository.getAll(ownerUid);
    rebuildOfferIndex(ownerUid, all);
  }
  return deleted;
}
