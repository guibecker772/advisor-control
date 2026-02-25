import { type Prospect, type ProspectInteracao } from '../../../domain/types';

export const PROSPECT_STATUS_COLUMNS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
] as const;

export const PROSPECT_ORIGEM_OPTIONS = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'liberta', label: 'Liberta' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'evento', label: 'Evento' },
  { value: 'site', label: 'Site' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'outros', label: 'Outros' },
] as const;

export const PROSPECT_TIPO_OPTIONS = [
  { value: 'captacao_liquida', label: 'Captação Líquida' },
  { value: 'transferencia_xp', label: 'Transferência XP' },
] as const;

export type ProspectStatusValue = (typeof PROSPECT_STATUS_COLUMNS)[number]['value'];
export type ProspectOrigemValue = (typeof PROSPECT_ORIGEM_OPTIONS)[number]['value'];
export type ProspectViewMode = 'cards' | 'table';
export type ProspectStatusFilter = 'all' | 'active' | 'ganho' | 'perdido';
export type ProspectContactFilter = 'all' | 'overdue' | 'today' | 'no_next_step';
export type ProspectOrigemFilter = 'all' | ProspectOrigemValue;
export type ContactUrgency = 'overdue' | 'today' | 'upcoming' | 'none';
export type InteracoesByProspectMap = Map<string, ProspectInteracao[]>;

interface UrgencySortKey {
  urgency: ContactUrgency;
  priority: number;
  contactTimestamp: number;
  agingDays: number;
  fallbackTimestamp: number;
  nome: string;
}

const PROSPECT_STATUS_SET = new Set<ProspectStatusValue>(
  PROSPECT_STATUS_COLUMNS.map((status) => status.value),
);

const PROSPECT_ORIGEM_SET = new Set<ProspectOrigemValue>(
  PROSPECT_ORIGEM_OPTIONS.map((origem) => origem.value),
);

const dayMs = 1000 * 60 * 60 * 24;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toTimestamp(value: Date | undefined): number {
  if (!value) return 0;
  return value.getTime();
}

function getProspectFallbackTimestamp(prospect: Prospect): number {
  return (
    toTimestamp(normalizeDate(prospect.updatedAt))
    || toTimestamp(normalizeDate(prospect.createdAt))
    || 0
  );
}

function getContactPriority(urgency: ContactUrgency): number {
  switch (urgency) {
    case 'overdue':
      return 0;
    case 'today':
      return 1;
    case 'upcoming':
      return 2;
    default:
      return 3;
  }
}

function getInteractionTimestamp(interacao: ProspectInteracao): number {
  return (
    toTimestamp(normalizeDate(interacao.data))
    || toTimestamp(normalizeDate(interacao.updatedAt))
    || toTimestamp(normalizeDate(interacao.createdAt))
    || 0
  );
}

function getProspectMapKey(prospect: Prospect): string {
  return prospect.id ?? `${prospect.nome ?? ''}|${prospect.email ?? ''}|${prospect.telefone ?? ''}`;
}

function getInteracoesBucket(
  interacoesByProspect: InteracoesByProspectMap | Record<string, ProspectInteracao[]>,
  prospect: Prospect,
): ProspectInteracao[] {
  if (interacoesByProspect instanceof Map) {
    return interacoesByProspect.get(getProspectMapKey(prospect)) ?? [];
  }

  if (!prospect.id) return [];
  return interacoesByProspect[prospect.id] ?? [];
}

export function normalizeDate(value: string | number | Date | undefined | null): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalizedInput = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00`
    : trimmed;

  const parsed = new Date(normalizedInput);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function isSameDay(a: Date, b: Date): boolean {
  const dayA = startOfDay(a);
  const dayB = startOfDay(b);
  return dayA.getTime() === dayB.getTime();
}

export function isBeforeDay(a: Date, b: Date): boolean {
  const dayA = startOfDay(a);
  const dayB = startOfDay(b);
  return dayA.getTime() < dayB.getTime();
}

export function normalizeProspectStatus(status: string | undefined): ProspectStatusValue {
  if (status && PROSPECT_STATUS_SET.has(status as ProspectStatusValue)) {
    return status as ProspectStatusValue;
  }
  return 'novo';
}

export function getStatusLabel(status: string | undefined): string {
  const normalized = normalizeProspectStatus(status);
  return PROSPECT_STATUS_COLUMNS.find((option) => option.value === normalized)?.label ?? 'Novo';
}

export function getOrigemLabel(origem: string | undefined): string {
  if (!origem) return 'Outros';
  const known = PROSPECT_ORIGEM_OPTIONS.find((option) => option.value === origem);
  return known?.label ?? origem;
}

export function getTipoLabel(tipo: string | undefined): 'CL' | 'TXP' {
  return tipo === 'transferencia_xp' ? 'TXP' : 'CL';
}

export function getPipeAtualValue(prospect: Prospect): number {
  const potencial = Number(prospect.potencial ?? 0);
  const realizado = Number(prospect.realizadoValor ?? 0);
  return Math.max(0, potencial - realizado);
}

export function isProspectAtivo(status: string | undefined): boolean {
  const normalized = normalizeProspectStatus(status);
  return normalized !== 'ganho' && normalized !== 'perdido';
}

export function getContactUrgency(prospect: Prospect, today: Date): ContactUrgency {
  const contactDate = normalizeDate(prospect.proximoContato);
  if (!contactDate) return 'none';
  if (isBeforeDay(contactDate, today)) return 'overdue';
  if (isSameDay(contactDate, today)) return 'today';
  return 'upcoming';
}

export function getLastContactDate(
  prospect: Prospect,
  interacoes: ProspectInteracao[],
): Date | undefined {
  if (interacoes.length > 0) {
    const interactionDate = normalizeDate(interacoes[0]?.data);
    if (interactionDate) return interactionDate;
  }

  return (
    normalizeDate(prospect.dataContato)
    || normalizeDate(prospect.updatedAt)
    || normalizeDate(prospect.createdAt)
  );
}

export function getAgingDays(lastContactDate: Date | undefined, today: Date): number | undefined {
  if (!lastContactDate) return undefined;
  const diff = startOfDay(today).getTime() - startOfDay(lastContactDate).getTime();
  return Math.max(0, Math.floor(diff / dayMs));
}

export function matchesSearchTerm(prospect: Prospect, rawSearchTerm: string): boolean {
  const searchTerm = rawSearchTerm.trim().toLowerCase();
  if (!searchTerm) return true;

  const fields = [
    prospect.nome,
    prospect.email,
    prospect.telefone,
    prospect.cpfCnpj,
    prospect.observacoes,
    prospect.status,
    prospect.origem,
    getStatusLabel(prospect.status),
    getOrigemLabel(prospect.origem),
    String(prospect.potencial ?? ''),
    String(prospect.realizadoValor ?? ''),
    String(prospect.probabilidade ?? ''),
  ];

  return fields.some((field) => String(field ?? '').toLowerCase().includes(searchTerm));
}

export function buildInteracoesByProspectMap(interacoes: ProspectInteracao[]): InteracoesByProspectMap {
  const map: InteracoesByProspectMap = new Map();

  interacoes.forEach((interacao) => {
    const key = interacao.prospectId;
    if (!key) return;

    const bucket = map.get(key) ?? [];
    bucket.push(interacao);
    map.set(key, bucket);
  });

  map.forEach((bucket) => {
    bucket.sort((a, b) => getInteractionTimestamp(b) - getInteractionTimestamp(a));
  });

  return map;
}

export function buildUrgencySortKey(
  prospect: Prospect,
  today: Date,
  interacoes: ProspectInteracao[],
): UrgencySortKey {
  const urgency = getContactUrgency(prospect, today);
  const contactTimestamp = toTimestamp(normalizeDate(prospect.proximoContato));
  const lastContactDate = getLastContactDate(prospect, interacoes);

  return {
    urgency,
    priority: getContactPriority(urgency),
    contactTimestamp,
    agingDays: getAgingDays(lastContactDate, today) ?? -1,
    fallbackTimestamp: getProspectFallbackTimestamp(prospect),
    nome: prospect.nome || '',
  };
}

export function compareUrgencySortKeys(a: UrgencySortKey, b: UrgencySortKey): number {
  const priorityDiff = a.priority - b.priority;
  if (priorityDiff !== 0) return priorityDiff;

  if (a.urgency === 'overdue' || a.urgency === 'upcoming') {
    const contactDiff = a.contactTimestamp - b.contactTimestamp;
    if (contactDiff !== 0) return contactDiff;
  }

  if (a.urgency === 'none') {
    const agingDiff = b.agingDays - a.agingDays;
    if (agingDiff !== 0) return agingDiff;
  }

  const fallbackDiff = b.fallbackTimestamp - a.fallbackTimestamp;
  if (fallbackDiff !== 0) return fallbackDiff;

  return a.nome.localeCompare(b.nome, 'pt-BR');
}

export function sortByUrgency(
  a: Prospect,
  b: Prospect,
  today: Date,
  interacoesByProspect: InteracoesByProspectMap | Record<string, ProspectInteracao[]>,
): number {
  const keyA = buildUrgencySortKey(a, today, getInteracoesBucket(interacoesByProspect, a));
  const keyB = buildUrgencySortKey(b, today, getInteracoesBucket(interacoesByProspect, b));
  return compareUrgencySortKeys(keyA, keyB);
}

export function isProspectViewMode(value: unknown): value is ProspectViewMode {
  return value === 'cards' || value === 'table';
}

export function isProspectStatusFilter(value: unknown): value is ProspectStatusFilter {
  return value === 'all' || value === 'active' || value === 'ganho' || value === 'perdido';
}

export function isProspectContactFilter(value: unknown): value is ProspectContactFilter {
  return value === 'all' || value === 'overdue' || value === 'today' || value === 'no_next_step';
}

export function isProspectOrigemFilter(value: unknown): value is ProspectOrigemFilter {
  if (value === 'all') return true;
  return typeof value === 'string' && PROSPECT_ORIGEM_SET.has(value as ProspectOrigemValue);
}
