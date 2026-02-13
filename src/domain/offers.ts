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

function parseDateInput(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00-03:00`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toCompetenceMonthFromDate(date: Date): string {
  const parts = monthFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  if (!year || !month) return '1970-01';
  return `${year}-${month}`;
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
  fallbackDate?: string | Date | null,
): string {
  if (isValidCompetenceMonth(value)) {
    return value.trim();
  }

  const fallbackParsed = parseDateInput(fallbackDate);
  if (fallbackParsed) {
    return toCompetenceMonthFromDate(fallbackParsed);
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
  if (flags?.reservaLiquidada) return 'LIQUIDADA';
  if (flags?.reservaEfetuada) return 'RESERVADA';

  if (typeof value !== 'string') return 'PENDENTE';
  const normalized = normalizeText(value).replace(/[\s_-]+/g, '');
  return statusMap[normalized] ?? 'PENDENTE';
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
