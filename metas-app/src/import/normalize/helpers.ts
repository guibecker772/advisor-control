import type { Cliente } from '../../domain/types';
import type { ParsedCellValue } from '../types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

export function normalizeAccountNumber(value: ParsedCellValue): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/\D/g, '');
}

export function parseBRNumber(value: ParsedCellValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
  if (!normalized || normalized === '-' || normalized === ',' || normalized === '.') return null;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    const commaIdx = normalized.lastIndexOf(',');
    const dotIdx = normalized.lastIndexOf('.');

    if (commaIdx > dotIdx) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercentCDI(value: ParsedCellValue): number | null {
  const parsed = parseBRNumber(value);
  if (parsed === null) return null;
  return parsed * 100;
}

export function parseBooleanSimNao(value: ParsedCellValue): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = stripAccents(String(value).trim().toLowerCase());
  if (!normalized || normalized === 'na' || normalized === 'n/a') return null;

  if (['sim', 's', 'yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['nao', 'nao.', 'n', 'no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function parseDatePartsFromString(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ddMmYyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ddMmYyyy) {
    const day = Number(ddMmYyyy[1]);
    const month = Number(ddMmYyyy[2]);
    const yearRaw = Number(ddMmYyyy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const hour = Number(ddMmYyyy[4] || 0);
    const minute = Number(ddMmYyyy[5] || 0);
    const second = Number(ddMmYyyy[6] || 0);
    const date = new Date(year, month - 1, day, hour, minute, second);
    return isValidDate(date) ? date : null;
  }

  const isoCandidate = new Date(trimmed);
  if (isValidDate(isoCandidate)) return isoCandidate;
  return null;
}

export function parseSpreadsheetDate(value: ParsedCellValue): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(EXCEL_EPOCH_UTC + value * DAY_IN_MS);
    return isValidDate(date) ? date : null;
  }
  return parseDatePartsFromString(String(value));
}

export function toISODate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toISODateTime(value: Date): string {
  return value.toISOString();
}

export function normalizePerfilInvestidor(value: ParsedCellValue): Cliente['perfilInvestidor'] | null {
  if (value === null || value === undefined) return null;
  const normalized = stripAccents(String(value).trim().toLowerCase());
  if (!normalized) return null;

  if (normalized.includes('profissional')) return 'Profissional';
  if (normalized.includes('qualificado')) return 'Qualificado';
  if (normalized.includes('regular')) return 'Regular';

  return null;
}

export function normalizeStatus(value: ParsedCellValue): Cliente['status'] | null {
  if (value === null || value === undefined) return null;
  const normalized = stripAccents(String(value).trim().toLowerCase());
  if (!normalized) return null;
  if (normalized === 'ativo') return 'ativo';
  if (normalized === 'inativo') return 'inativo';
  if (normalized === 'prospecto' || normalized === 'prospect') return 'prospecto';
  return null;
}
