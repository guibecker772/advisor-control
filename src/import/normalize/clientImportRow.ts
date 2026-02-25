import type { ClientImportColumnMapping, ClientImportPreviewRow, ImportIssue, NormalizedClientPayload, RawImportRow } from '../types';
import {
  normalizeAccountNumber,
  normalizePerfilInvestidor,
  normalizeStatus,
  parseBooleanSimNao,
  parseBRNumber,
  parsePercentCDI,
  parseSpreadsheetDate,
  toISODate,
  toISODateTime,
} from './helpers';

interface NormalizeRowDraft {
  rowId: string;
  rowNumber: number;
  raw: RawImportRow;
  payload: NormalizedClientPayload;
  accountNumber: string;
  issues: ImportIssue[];
  hasBlockingError: boolean;
}

function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

function addIssue(
  issues: ImportIssue[],
  issue: ImportIssue,
): void {
  issues.push(issue);
}

function ensureMetrics(payload: NormalizedClientPayload): NonNullable<NormalizedClientPayload['metrics']> {
  if (!payload.metrics) {
    payload.metrics = {};
  }
  return payload.metrics;
}

function ensureCustomFields(payload: NormalizedClientPayload): NonNullable<NormalizedClientPayload['customFields']> {
  if (!payload.customFields) {
    payload.customFields = {};
  }
  return payload.customFields;
}

function pushReviewPendingTag(payload: NormalizedClientPayload): void {
  if (!payload.tags) {
    payload.tags = [];
  }
  if (!payload.tags.includes('Revisão pendente')) {
    payload.tags.push('Revisão pendente');
  }
}

function buildRowId(rowNumber: number): string {
  return `import-row-${rowNumber}`;
}

function parseNumberField(
  issues: ImportIssue[],
  value: unknown,
  applyValue: (num: number) => void,
  issueCode: string,
  issueMessage: string,
): void {
  if (isBlankCell(value)) return;
  const parsed = parseBRNumber(value as string | number);
  if (parsed === null) {
    addIssue(issues, {
      code: issueCode,
      severity: 'warning',
      message: issueMessage,
    });
    return;
  }
  applyValue(parsed);
}

function parseDateField(
  value: unknown,
  issues: ImportIssue[],
  issueCode: string,
  issueMessage: string,
): Date | null {
  if (isBlankCell(value)) return null;
  const parsed = parseSpreadsheetDate(value as string | number | Date);
  if (!parsed) {
    addIssue(issues, {
      code: issueCode,
      severity: 'warning',
      message: issueMessage,
    });
    return null;
  }
  return parsed;
}

export function normalizeImportedClientRow(
  row: RawImportRow,
  rowNumber: number,
  mapping: ClientImportColumnMapping,
): NormalizeRowDraft {
  const payload: NormalizedClientPayload = {};
  const issues: ImportIssue[] = [];

  for (const [header, mapField] of Object.entries(mapping)) {
    if (mapField === '__ignore__') continue;
    const rawValue = row[header];

    switch (mapField) {
      case 'nome': {
        const value = String(rawValue ?? '').trim();
        if (!value) {
          addIssue(issues, {
            code: 'name_missing',
            field: 'nome',
            severity: 'error',
            message: 'Nome é obrigatório.',
          });
        } else {
          payload.nome = value;
        }
        break;
      }
      case 'codigoConta': {
        payload.codigoConta = normalizeAccountNumber(rawValue);
        break;
      }
      case 'perfilInvestidor': {
        if (isBlankCell(rawValue)) break;
        const parsed = normalizePerfilInvestidor(rawValue);
        if (!parsed) {
          addIssue(issues, {
            code: 'perfil_invalid',
            field: 'perfilInvestidor',
            severity: 'warning',
            message: 'Perfil inválido. Valor ignorado.',
          });
        } else {
          payload.perfilInvestidor = parsed;
        }
        break;
      }
      case 'email': {
        const value = String(rawValue ?? '').trim();
        if (value) payload.email = value;
        break;
      }
      case 'telefone': {
        const value = String(rawValue ?? '').trim();
        if (value) payload.telefone = value;
        break;
      }
      case 'cpfCnpj': {
        const value = String(rawValue ?? '').trim();
        if (value) payload.cpfCnpj = value;
        break;
      }
      case 'status': {
        if (isBlankCell(rawValue)) break;
        const parsed = normalizeStatus(rawValue);
        if (!parsed) {
          addIssue(issues, {
            code: 'status_invalid',
            field: 'status',
            severity: 'warning',
            message: 'Status inválido. Valor ignorado.',
          });
        } else {
          payload.status = parsed;
        }
        break;
      }
      case 'origem': {
        const value = String(rawValue ?? '').trim();
        if (value) payload.origem = value;
        break;
      }
      case 'observacoes': {
        const value = String(rawValue ?? '').trim();
        if (value) payload.observacoes = value;
        break;
      }
      case 'custodiaAtual': {
        parseNumberField(
          issues,
          rawValue,
          (num) => {
            payload.custodiaAtual = num;
          },
          'custodia_invalid',
          'Custódia atual inválida. Campo ignorado.',
        );
        break;
      }
      case 'metrics.totalBRL': {
        parseNumberField(
          issues,
          rawValue,
          (num) => {
            ensureMetrics(payload).totalBRL = num;
          },
          'total_invalid',
          'Total BRL inválido. Campo ignorado.',
        );
        break;
      }
      case 'metrics.onshoreBRL': {
        parseNumberField(
          issues,
          rawValue,
          (num) => {
            ensureMetrics(payload).onshoreBRL = num;
          },
          'onshore_invalid',
          'Onshore BRL inválido. Campo ignorado.',
        );
        break;
      }
      case 'metrics.offshoreBRL': {
        parseNumberField(
          issues,
          rawValue,
          (num) => {
            ensureMetrics(payload).offshoreBRL = num;
          },
          'offshore_invalid',
          'Offshore BRL inválido. Campo ignorado.',
        );
        break;
      }
      case 'metrics.cdiYearPct': {
        if (isBlankCell(rawValue)) break;
        const parsed = parsePercentCDI(rawValue as string | number);
        if (parsed === null) {
          addIssue(issues, {
            code: 'cdi_invalid',
            field: 'metrics.cdiYearPct',
            severity: 'warning',
            message: '% CDI inválido. Campo ignorado.',
          });
        } else {
          ensureMetrics(payload).cdiYearPct = parsed;
        }
        break;
      }
      case 'hasFixedFee': {
        if (isBlankCell(rawValue)) break;
        const parsed = parseBooleanSimNao(rawValue as string | number | boolean);
        if (parsed === null) {
          addIssue(issues, {
            code: 'fixed_fee_invalid',
            field: 'hasFixedFee',
            severity: 'warning',
            message: 'Fee fixo inválido. Campo ignorado.',
          });
        } else {
          payload.hasFixedFee = parsed;
        }
        break;
      }
      case 'nextMeetingAt': {
        const date = parseDateField(
          rawValue,
          issues,
          'next_meeting_invalid',
          'Próxima reunião inválida. Campo ignorado.',
        );
        if (date) {
          payload.nextMeetingAt = toISODateTime(date);
        }
        break;
      }
      case 'birthday': {
        const birthday = parseDateField(
          rawValue,
          issues,
          'birthday_invalid',
          'Aniversário inválido. Campo ignorado.',
        );

        if (!birthday) break;
        const year = birthday.getFullYear();
        if (year >= 2000) {
          payload.birthDay = birthday.getDate();
          payload.birthMonth = birthday.getMonth() + 1;
        } else {
          payload.birthDate = toISODate(birthday);
        }
        break;
      }
      default:
        break;
    }
  }

  const accountNumber = normalizeAccountNumber(payload.codigoConta);
  if (accountNumber) {
    payload.codigoConta = accountNumber;
  } else {
    payload.codigoConta = '';
    ensureCustomFields(payload).reviewPending = true;
    pushReviewPendingTag(payload);
  }

  if (!payload.nome && !issues.some((issue) => issue.code === 'name_missing')) {
    addIssue(issues, {
      code: 'name_missing',
      field: 'nome',
      severity: 'error',
      message: 'Nome é obrigatório.',
    });
  }

  const hasBlockingError = issues.some((issue) => issue.severity === 'error');

  return {
    rowId: buildRowId(rowNumber),
    rowNumber,
    raw: row,
    payload,
    accountNumber,
    issues,
    hasBlockingError,
  };
}

export function mergePreviewRows(
  drafts: NormalizeRowDraft[],
  lookupByAccount: Map<string, ClientImportPreviewRow['existingMatch']>,
): ClientImportPreviewRow[] {
  const accountCounts = new Map<string, number>();
  for (const draft of drafts) {
    if (!draft.accountNumber) continue;
    accountCounts.set(draft.accountNumber, (accountCounts.get(draft.accountNumber) ?? 0) + 1);
  }

  return drafts.map((draft) => {
    const existingMatch = draft.accountNumber ? lookupByAccount.get(draft.accountNumber) : undefined;
    const baseAction = existingMatch ? 'update' : 'create';
    const isConflict = draft.accountNumber ? (accountCounts.get(draft.accountNumber) ?? 0) > 1 : false;

    return {
      rowId: draft.rowId,
      rowNumber: draft.rowNumber,
      raw: draft.raw,
      payload: draft.payload,
      accountNumber: draft.accountNumber,
      issues: draft.issues,
      hasBlockingError: draft.hasBlockingError,
      baseAction,
      existingMatch,
      conflictGroupId: isConflict ? `account:${draft.accountNumber}` : undefined,
    };
  });
}
