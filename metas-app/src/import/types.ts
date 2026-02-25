import type { Cliente } from '../domain/types';

export type ParsedCellValue = string | number | boolean | Date | null | undefined;
export type RawImportRow = Record<string, ParsedCellValue>;

export interface ParsedImportSheet {
  name: string;
  headers: string[];
  rows: RawImportRow[];
}

export interface ParsedImportFile {
  fileName: string;
  fileSize: number;
  fileType: 'xlsx' | 'csv';
  sheets: ParsedImportSheet[];
}

export const IGNORE_IMPORT_COLUMN = '__ignore__' as const;

export type ClientImportFieldKey =
  | 'nome'
  | 'codigoConta'
  | 'perfilInvestidor'
  | 'email'
  | 'telefone'
  | 'cpfCnpj'
  | 'status'
  | 'origem'
  | 'observacoes'
  | 'custodiaAtual'
  | 'metrics.totalBRL'
  | 'metrics.onshoreBRL'
  | 'metrics.offshoreBRL'
  | 'metrics.cdiYearPct'
  | 'hasFixedFee'
  | 'nextMeetingAt'
  | 'birthday';

export type ClientImportColumnMappingValue = ClientImportFieldKey | typeof IGNORE_IMPORT_COLUMN;
export type ClientImportColumnMapping = Record<string, ClientImportColumnMappingValue>;

export interface ClientImportFieldDefinition {
  key: ClientImportFieldKey;
  label: string;
  help: string;
}

export interface ClientImportMappingModel {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mapping: ClientImportColumnMapping;
}

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  code: string;
  message: string;
  severity: ImportIssueSeverity;
  field?: ClientImportFieldKey;
}

export interface ClientImportMetricsPayload {
  totalBRL?: number;
  onshoreBRL?: number;
  offshoreBRL?: number;
  cdiYearPct?: number;
}

export interface NormalizedClientPayload {
  nome?: string;
  codigoConta?: string;
  perfilInvestidor?: Cliente['perfilInvestidor'];
  email?: string;
  telefone?: string;
  cpfCnpj?: string;
  status?: Cliente['status'];
  origem?: string;
  observacoes?: string;
  custodiaAtual?: number;
  metrics?: ClientImportMetricsPayload;
  hasFixedFee?: boolean;
  nextMeetingAt?: string;
  birthDate?: string;
  birthDay?: number;
  birthMonth?: number;
  customFields?: Record<string, unknown>;
  tags?: string[];
}

export interface LookupMatchSummary {
  accountNumber: string;
  clientId: string;
  nome?: string;
  perfilInvestidor?: string;
  codigoConta?: string;
  custodiaAtual?: number;
  metrics?: ClientImportMetricsPayload;
}

export type PreviewBaseAction = 'create' | 'update';
export type PreviewEffectiveAction = PreviewBaseAction | 'ignore' | 'error' | 'conflict';
export type PreviewOverrideAction = 'create' | 'update' | 'ignore';

export interface ClientImportPreviewRow {
  rowId: string;
  rowNumber: number;
  raw: RawImportRow;
  payload: NormalizedClientPayload;
  accountNumber: string;
  issues: ImportIssue[];
  hasBlockingError: boolean;
  baseAction: PreviewBaseAction;
  existingMatch?: LookupMatchSummary;
  conflictGroupId?: string;
}

export interface ImportConflictResolution {
  winnerRowId?: string;
  ignoreAll?: boolean;
}

export interface RowDecisionSnapshot {
  rowId: string;
  rowNumber: number;
  accountNumber: string;
  effectiveAction: PreviewEffectiveAction;
  backendAction?: 'create' | 'update';
  clientId?: string;
  payload?: NormalizedClientPayload;
  issues: ImportIssue[];
  conflictGroupId?: string;
}

export interface ImportExecutionResult {
  rowId: string;
  rowNumber: number;
  accountNumber: string;
  action: PreviewEffectiveAction;
  result: 'created' | 'updated' | 'ignored' | 'error';
  message?: string;
  clientId?: string;
}
