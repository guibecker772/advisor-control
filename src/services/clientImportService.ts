import type { Cliente } from '../domain/types';
import { resolveAccessCapabilities } from '../lib/access';
import { readStorageJSON, writeStorageJSON } from '../lib/userStorage';
import { normalizeAccountNumber } from '../import/normalize/helpers';
import type { LookupMatchSummary, NormalizedClientPayload } from '../import/types';
import { clienteRepository } from './repositories';

interface ImportAuthLike {
  uid?: string;
  tenantId?: string | null;
}

export interface LookupByAccountInput {
  accounts: string[];
}

export interface LookupByAccountResponse {
  matches: LookupMatchSummary[];
}

export interface BulkUpsertItem {
  action: 'create' | 'update';
  clientId?: string;
  data: NormalizedClientPayload;
  source?: {
    importId?: string;
    rowNumber?: number;
  };
}

export interface BulkUpsertInput {
  items: BulkUpsertItem[];
}

export interface BulkUpsertItemResult {
  status: 'created' | 'updated' | 'error';
  clientId?: string;
  error?: string;
}

export interface BulkUpsertResponse {
  results: BulkUpsertItemResult[];
}

export interface ImportAuditInput {
  fileName: string;
  createdAt: string;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
  errorCount: number;
  topErrors: Array<{ code: string; count: number }>;
}

interface ImportAuditRecord extends ImportAuditInput {
  id: string;
  ownerUid: string;
}

const IMPORT_AUDIT_STORAGE_KEY = 'ac_client_import_audit_v1';

function requireImportPermission(user: ImportAuthLike | null | undefined): string {
  const uid = typeof user?.uid === 'string' ? user.uid : '';
  if (!uid) throw new Error('AUTH_REQUIRED');

  const access = resolveAccessCapabilities(user);
  if (!access.canImportClients) {
    throw new Error('IMPORT_FORBIDDEN');
  }

  return uid;
}

function extractLookupSummary(client: Cliente, accountNumber: string): LookupMatchSummary {
  return {
    accountNumber,
    clientId: client.id ?? '',
    nome: client.nome,
    perfilInvestidor: client.perfilInvestidor,
    codigoConta: client.codigoConta,
    custodiaAtual: client.custodiaAtual,
    metrics: client.metrics,
  };
}

function mergeTags(current: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  const values = new Set<string>([...(current ?? []), ...(incoming ?? [])].filter((value) => value.trim().length > 0));
  if (values.size === 0) return undefined;
  return Array.from(values);
}

function sanitizeUpdatePayload(existing: Cliente, payload: NormalizedClientPayload): Partial<Cliente> {
  const nextPayload: Partial<Cliente> = {};

  if (payload.nome && payload.nome.trim()) nextPayload.nome = payload.nome.trim();
  if (payload.email && payload.email.trim()) nextPayload.email = payload.email.trim();
  if (payload.telefone && payload.telefone.trim()) nextPayload.telefone = payload.telefone.trim();
  if (payload.cpfCnpj && payload.cpfCnpj.trim()) nextPayload.cpfCnpj = payload.cpfCnpj.trim();
  if (payload.status) nextPayload.status = payload.status;
  if (payload.origem && payload.origem.trim()) nextPayload.origem = payload.origem.trim();
  if (payload.observacoes && payload.observacoes.trim()) nextPayload.observacoes = payload.observacoes.trim();
  if (payload.perfilInvestidor) nextPayload.perfilInvestidor = payload.perfilInvestidor;
  if (typeof payload.custodiaAtual === 'number') nextPayload.custodiaAtual = payload.custodiaAtual;
  if (typeof payload.hasFixedFee === 'boolean') nextPayload.hasFixedFee = payload.hasFixedFee;
  if (payload.nextMeetingAt) nextPayload.nextMeetingAt = payload.nextMeetingAt;
  if (payload.birthDate) nextPayload.birthDate = payload.birthDate;
  if (typeof payload.birthDay === 'number') nextPayload.birthDay = payload.birthDay;
  if (typeof payload.birthMonth === 'number') nextPayload.birthMonth = payload.birthMonth;

  const normalizedAccount = normalizeAccountNumber(payload.codigoConta);
  if (normalizedAccount) {
    nextPayload.codigoConta = normalizedAccount;
  }

  if (payload.metrics) {
    nextPayload.metrics = {
      ...(existing.metrics ?? {}),
      ...payload.metrics,
    };
  }

  if (payload.customFields) {
    nextPayload.customFields = {
      ...(existing.customFields ?? {}),
      ...payload.customFields,
    };
  }

  const mergedTags = mergeTags(existing.tags, payload.tags);
  if (mergedTags) {
    nextPayload.tags = mergedTags;
  }

  return nextPayload;
}

function sanitizeCreatePayload(payload: NormalizedClientPayload): Omit<Cliente, 'id'> {
  const normalizedAccount = normalizeAccountNumber(payload.codigoConta);
  const nextCustomFields = {
    ...(payload.customFields ?? {}),
  };

  if (!normalizedAccount) {
    nextCustomFields.reviewPending = true;
  }

  const tags = mergeTags(undefined, payload.tags);

  return {
    nome: payload.nome?.trim() || 'Cliente sem nome',
    email: payload.email?.trim() ?? '',
    telefone: payload.telefone?.trim() ?? '',
    cpfCnpj: payload.cpfCnpj?.trim() ?? '',
    dataEntrada: '',
    origem: payload.origem?.trim() ?? '',
    status: payload.status ?? 'ativo',
    assessor: '',
    custodiaInicial: 0,
    custodiaAtual: payload.custodiaAtual ?? 0,
    custodiaOnShore: payload.metrics?.onshoreBRL ?? 0,
    custodiaOffShore: payload.metrics?.offshoreBRL ?? 0,
    codigoConta: normalizedAccount,
    perfilInvestidor: payload.perfilInvestidor ?? 'Regular',
    observacoes: payload.observacoes?.trim() ?? '',
    hasFixedFee: payload.hasFixedFee,
    nextMeetingAt: payload.nextMeetingAt,
    birthDate: payload.birthDate,
    birthDay: payload.birthDay,
    birthMonth: payload.birthMonth,
    metrics: payload.metrics,
    customFields: nextCustomFields,
    tags,
  };
}

export async function lookupClientsByAccount(
  input: LookupByAccountInput,
  user: ImportAuthLike | null | undefined,
): Promise<LookupByAccountResponse> {
  const uid = requireImportPermission(user);
  const normalizedAccounts = Array.from(
    new Set((input.accounts ?? []).map((account) => normalizeAccountNumber(account)).filter(Boolean)),
  );

  if (!normalizedAccounts.length) {
    return { matches: [] };
  }

  const clients = await clienteRepository.getAll(uid);
  const indexed = new Map<string, Cliente>();

  for (const client of clients) {
    const account = normalizeAccountNumber(client.codigoConta);
    if (!account || indexed.has(account)) continue;
    indexed.set(account, client);
  }

  const matches = normalizedAccounts
    .map((account) => {
      const client = indexed.get(account);
      if (!client || !client.id) return null;
      return extractLookupSummary(client, account);
    })
    .filter((item): item is LookupMatchSummary => Boolean(item));

  return { matches };
}

export async function bulkUpsertClients(
  input: BulkUpsertInput,
  user: ImportAuthLike | null | undefined,
): Promise<BulkUpsertResponse> {
  const uid = requireImportPermission(user);
  const results: BulkUpsertItemResult[] = [];

  for (const item of input.items ?? []) {
    try {
      if (item.action === 'update') {
        if (!item.clientId) {
          results.push({ status: 'error', error: 'clientId obrigatório para update.' });
          continue;
        }

        const current = await clienteRepository.getById(item.clientId, uid);
        if (!current) {
          results.push({ status: 'error', error: 'Cliente não encontrado para update.' });
          continue;
        }

        const patch = sanitizeUpdatePayload(current, item.data);
        const updated = await clienteRepository.update(item.clientId, patch, uid);
        if (!updated?.id) {
          results.push({ status: 'error', error: 'Falha ao atualizar cliente.' });
          continue;
        }

        results.push({ status: 'updated', clientId: updated.id });
        continue;
      }

      const createPayload = sanitizeCreatePayload(item.data);
      const created = await clienteRepository.create(createPayload, uid);
      if (!created.id) {
        results.push({ status: 'error', error: 'Falha ao criar cliente.' });
        continue;
      }
      results.push({ status: 'created', clientId: created.id });
    } catch {
      results.push({ status: 'error', error: 'Erro inesperado no processamento da linha.' });
    }
  }

  return { results };
}

function readAuditRecords(): ImportAuditRecord[] {
  const records = readStorageJSON<ImportAuditRecord[]>(IMPORT_AUDIT_STORAGE_KEY, []);
  return Array.isArray(records) ? records : [];
}

function writeAuditRecords(records: ImportAuditRecord[]): void {
  writeStorageJSON(IMPORT_AUDIT_STORAGE_KEY, records);
}

export async function createClientImportAudit(
  input: ImportAuditInput,
  user: ImportAuthLike | null | undefined,
): Promise<void> {
  const uid = requireImportPermission(user);
  const records = readAuditRecords();

  const record: ImportAuditRecord = {
    ...input,
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    ownerUid: uid,
  };

  writeAuditRecords([record, ...records].slice(0, 50));
}
