export const OFFER_STATUS_VALUES = ['PENDENTE', 'RESERVADA', 'LIQUIDADA', 'CANCELADA'] as const;
export type OfferStatus = typeof OFFER_STATUS_VALUES[number];

export const OFFER_ASSET_CLASS_VALUES = [
  'RENDA_VARIAVEL',
  'RENDA_FIXA',
  'COE',
  'FUNDOS',
  'PREVIDENCIA',
  'INTERNACIONAL',
  'OUTROS',
] as const;
export type OfferAssetClass = typeof OFFER_ASSET_CLASS_VALUES[number];

export const OFFER_AUDIENCE_VALUES = ['GENERAL', 'QUALIFIED'] as const;
export type OfferAudience = typeof OFFER_AUDIENCE_VALUES[number];

const COMPETENCE_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';
const monthFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
});
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const BR_DATE_ONLY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const BR_DATE_TIME_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const ISO_LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

const statusMap: Record<string, OfferStatus> = {
  pendente: 'PENDENTE',
  pending: 'PENDENTE',
  reservada: 'RESERVADA',
  reservado: 'RESERVADA',
  reserved: 'RESERVADA',
  efetuada: 'RESERVADA',
  efetuado: 'RESERVADA',
  liquidada: 'LIQUIDADA',
  liquidado: 'LIQUIDADA',
  liquidated: 'LIQUIDADA',
  concluida: 'LIQUIDADA',
  concluido: 'LIQUIDADA',
  cancelada: 'CANCELADA',
  cancelado: 'CANCELADA',
  canceled: 'CANCELADA',
  cancelled: 'CANCELADA',
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type ParsedDateInput = {
  date: Date;
  isDateOnly: boolean;
};

function parseDateInput(value: unknown): ParsedDateInput | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? { date: value, isDateOnly: false } : null;
  }

  if (typeof value === 'object' && value !== null) {
    const timestampLike = value as {
      toDate?: () => Date;
      seconds?: unknown;
      nanoseconds?: unknown;
    };
    if (typeof timestampLike.toDate === 'function') {
      const date = timestampLike.toDate();
      if (Number.isFinite(date.getTime())) {
        return { date, isDateOnly: false };
      }
    }
    if (typeof timestampLike.seconds === 'number') {
      const seconds = timestampLike.seconds;
      const nanos = typeof timestampLike.nanoseconds === 'number' ? timestampLike.nanoseconds : 0;
      const date = new Date((seconds * 1000) + Math.floor(nanos / 1_000_000));
      if (Number.isFinite(date.getTime())) {
        return { date, isDateOnly: false };
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? { date, isDateOnly: false } : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00-03:00`);
    return Number.isFinite(date.getTime()) ? { date, isDateOnly: true } : null;
  }

  const brDateTimeMatch = trimmed.match(BR_DATE_TIME_REGEX);
  if (brDateTimeMatch) {
    const [, day, month, year, hour, minute, second = '00'] = brDateTimeMatch;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? { date, isDateOnly: false } : null;
  }

  const brDateOnlyMatch = trimmed.match(BR_DATE_ONLY_REGEX);
  if (brDateOnlyMatch) {
    const [, day, month, year] = brDateOnlyMatch;
    const iso = `${year}-${month}-${day}T12:00:00-03:00`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? { date, isDateOnly: true } : null;
  }

  const isoLocalMatch = trimmed.match(ISO_LOCAL_DATETIME_REGEX);
  const hasTimezoneToken = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (isoLocalMatch && !hasTimezoneToken) {
    const [, year, month, day, hour, minute, second = '00'] = isoLocalMatch;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? { date, isDateOnly: false } : null;
  }

  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? { date: parsed, isDateOnly: false } : null;
}

function toCompetenceMonthFromDate(date: Date): string {
  const parts = monthFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  if (!year || !month) return '1970-01';
  return `${year}-${month}`;
}

function toSaoPauloDateOnly(date: Date): string {
  return dayFormatter.format(date);
}

export function normalizeDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  return toSaoPauloDateOnly(parsed.date);
}

function toSaoPauloEndOfDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999-03:00`);
}

export function isValidCompetenceMonth(value: string | null | undefined): value is string {
  if (!value) return false;
  return COMPETENCE_MONTH_REGEX.test(value.trim());
}

export function getCurrentCompetenceMonth(): string {
  return toCompetenceMonthFromDate(new Date());
}

export function normalizeCompetenceMonth(
  value: string | null | undefined,
  fallbackDate?: unknown,
): string {
  if (isValidCompetenceMonth(value)) {
    return value.trim();
  }

  const fallbackParsed = parseDateInput(fallbackDate);
  if (fallbackParsed) {
    return toCompetenceMonthFromDate(fallbackParsed.date);
  }

  return getCurrentCompetenceMonth();
}

export function normalizeOfferAudience(value: unknown): OfferAudience {
  if (typeof value !== 'string') return 'GENERAL';
  const normalized = normalizeText(value);
  if (normalized === 'qualified' || normalized === 'qualificado' || normalized === 'qualificada') {
    return 'QUALIFIED';
  }
  return 'GENERAL';
}

export function normalizeOfferStatus(
  value: unknown,
  flags?: { reservaEfetuada?: boolean; reservaLiquidada?: boolean },
): OfferStatus {
  if (typeof value === 'string') {
    const normalized = normalizeText(value).replace(/[\s_-]+/g, '');
    const mappedStatus = statusMap[normalized];
    if (mappedStatus) {
      return mappedStatus;
    }
  }

  if (flags?.reservaLiquidada) return 'LIQUIDADA';
  if (flags?.reservaEfetuada) return 'RESERVADA';
  return 'PENDENTE';
}

type LiquidationLikeOffer = {
  status?: unknown;
  reservaEfetuada?: boolean;
  reservaLiquidada?: boolean;
  dataLiquidacao?: unknown;
  liquidationDate?: unknown;
};

type ReservationWindowLikeOffer = LiquidationLikeOffer & {
  reservationEndDate?: string | null;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isLiquidated(offer: LiquidationLikeOffer): boolean {
  const explicitStatus = normalizeOfferStatus(offer.status);
  if (explicitStatus === 'CANCELADA') return false;

  const status = normalizeOfferStatus(offer.status, {
    reservaEfetuada: offer.reservaEfetuada,
    reservaLiquidada: offer.reservaLiquidada,
  });
  if (status === 'LIQUIDADA') return true;
  if (status === 'CANCELADA') return false;
  const liquidationDateText = typeof offer.liquidationDate === 'string' ? offer.liquidationDate : undefined;
  const dataLiquidacaoText = typeof offer.dataLiquidacao === 'string' ? offer.dataLiquidacao : undefined;
  return hasText(liquidationDateText) || hasText(dataLiquidacaoText);
}

export function isReservationWindowExpired(
  reservationEndDate: unknown,
  now: Date = new Date(),
): boolean {
  const normalizedReservationEndDate = normalizeDateOnly(reservationEndDate);
  if (!normalizedReservationEndDate) return false;
  return now.getTime() > toSaoPauloEndOfDay(normalizedReservationEndDate).getTime();
}

export function isLiquidationMomentExpired(
  liquidationAt: unknown,
  now: Date = new Date(),
): boolean {
  const parsed = parseDateInput(liquidationAt);
  if (!parsed) return false;
  if (parsed.isDateOnly) {
    const dateOnly = toSaoPauloDateOnly(parsed.date);
    return now.getTime() > toSaoPauloEndOfDay(dateOnly).getTime();
  }
  return now.getTime() > parsed.date.getTime();
}

export function canAcceptNewReservations(
  offer: ReservationWindowLikeOffer,
  now: Date = new Date(),
): boolean {
  const status = normalizeOfferStatus(offer.status, {
    reservaEfetuada: offer.reservaEfetuada,
    reservaLiquidada: offer.reservaLiquidada,
  });
  if (status === 'CANCELADA' || status === 'LIQUIDADA') return false;
  if (isReservationWindowExpired(offer.reservationEndDate, now)) return false;
  const liquidationAt = offer.liquidationDate ?? offer.dataLiquidacao;
  if (isLiquidationMomentExpired(liquidationAt, now)) return false;
  return true;
}

export function deriveLegacyReservationFlags(status: OfferStatus): {
  reservaEfetuada: boolean;
  reservaLiquidada: boolean;
} {
  if (status === 'LIQUIDADA') {
    return { reservaEfetuada: true, reservaLiquidada: true };
  }
  if (status === 'RESERVADA') {
    return { reservaEfetuada: true, reservaLiquidada: false };
  }
  return { reservaEfetuada: false, reservaLiquidada: false };
}

export function normalizeOfferAssetClass(value: unknown): OfferAssetClass {
  if (typeof value !== 'string') return 'OUTROS';
  const enumCandidate = value.trim().toUpperCase();
  if ((OFFER_ASSET_CLASS_VALUES as readonly string[]).includes(enumCandidate)) {
    return enumCandidate as OfferAssetClass;
  }
  const normalized = normalizeText(value);
  const compact = normalized.replace(/\s+/g, ' ');
  const hasStandaloneCoe = /(^|[^a-z0-9])coe([^a-z0-9]|$)/.test(compact);

  if (hasStandaloneCoe) return 'COE';
  if (compact.includes('previd')) return 'PREVIDENCIA';
  if (compact.includes('intern')) return 'INTERNACIONAL';
  if (
    compact.includes('fundo')
    || compact.includes('fii')
    || compact.includes('oferta publica')
  ) {
    return 'FUNDOS';
  }
  if (
    compact.includes('rv')
    || compact.includes('renda variavel')
    || compact.includes('acao')
    || compact.includes('bdr')
  ) {
    return 'RENDA_VARIAVEL';
  }
  if (
    compact.includes('rf')
    || compact.includes('renda fixa')
    || compact.includes('credito')
    || compact.includes('emissao bancaria')
    || compact.includes('debenture')
  ) {
    return 'RENDA_FIXA';
  }
  return 'OUTROS';
}

export function getOfferStatusLabel(status: OfferStatus): string {
  if (status === 'PENDENTE') return 'Pendente';
  if (status === 'RESERVADA') return 'Reservada';
  if (status === 'LIQUIDADA') return 'Liquidada';
  return 'Cancelada';
}

export function getOfferAudienceLabel(audience: OfferAudience): string {
  return audience === 'QUALIFIED' ? 'Qualificado' : 'Geral';
}

export function competenceMonthToMonthYear(competenceMonth: string): { mes: number; ano: number } | null {
  if (!isValidCompetenceMonth(competenceMonth)) return null;
  const [year, month] = competenceMonth.split('-');
  return { mes: Number(month), ano: Number(year) };
}

export function monthYearToCompetenceMonth(mes: number, ano: number): string {
  const month = String(mes).padStart(2, '0');
  return `${ano}-${month}`;
}

export function formatCompetenceMonthPtBr(competenceMonth: string): string {
  const parsed = competenceMonthToMonthYear(competenceMonth);
  if (!parsed) return competenceMonth;
  return `${String(parsed.mes).padStart(2, '0')}/${parsed.ano}`;
}
