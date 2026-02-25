import { prospectSchema, type CaptacaoLancamento, type Cliente, type Prospect, type ProspectInput } from '../domain/types';
import { captacaoLancamentoRepository, clienteRepository, prospectRepository } from './repositories';

interface ProspectConversionContext {
  ownerUid: string;
}

interface SaveProspectInput {
  prospectId?: string;
  data: ProspectInput;
}

export interface SaveProspectResult {
  prospect: Prospect;
  createdClientId?: string;
  updatedClientId?: string;
}

const CONVERSION_TAG = 'Convertido';

function isWonStatus(status: string | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return normalized === 'ganho' || normalized === 'won' || normalized === 'closedwon' || normalized === 'closed_won';
}

function hasValidRealizedData(prospect: Prospect): boolean {
  return Number(prospect.realizadoValor || 0) > 0 && Boolean(prospect.realizadoData);
}

function normalizeDigits(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeEmail(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizePhone(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function getMonthYear(dateString: string): { mes: number; ano: number } {
  const date = new Date(`${dateString}T00:00:00`);
  return {
    mes: date.getMonth() + 1,
    ano: date.getFullYear(),
  };
}

function buildConversionRef(prospectId: string): string {
  return `prospect_conversion:${prospectId}`;
}

function buildReversalRef(prospectId: string): string {
  return `prospect_conversion_reversal:${prospectId}`;
}

function resolveTipo(tipo: Prospect['realizadoTipo'] | Prospect['potencialTipo'] | undefined): 'captacao_liquida' | 'transferencia_xp' {
  return tipo === 'transferencia_xp' ? 'transferencia_xp' : 'captacao_liquida';
}

function getNewestEntity<T extends { updatedAt?: string }>(items: T[]): T | null {
  if (!items.length) return null;
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || '');
    const rightTime = Date.parse(right.updatedAt || '');
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  })[0] ?? null;
}

async function findClientForProspect(prospect: Prospect, ownerUid: string): Promise<Cliente | null> {
  const clients = await clienteRepository.getAll(ownerUid);

  const cpfCnpj = normalizeDigits(prospect.cpfCnpj);
  if (cpfCnpj) {
    const matches = clients.filter((client) => normalizeDigits(client.cpfCnpj) === cpfCnpj);
    if (matches.length > 1) {
      console.warn('[prospect-conversion] múltiplos clientes com mesmo CPF/CNPJ; usando o mais recente.');
    }
    const candidate = getNewestEntity(matches);
    if (candidate) return candidate;
  }

  const email = normalizeEmail(prospect.email);
  if (email) {
    const matches = clients.filter((client) => normalizeEmail(client.email) === email);
    if (matches.length > 1) {
      console.warn('[prospect-conversion] múltiplos clientes com mesmo email; usando o mais recente.');
    }
    const candidate = getNewestEntity(matches);
    if (candidate) return candidate;
  }

  const phone = normalizePhone(prospect.telefone);
  if (phone) {
    const matches = clients.filter((client) => normalizePhone(client.telefone) === phone);
    if (matches.length > 1) {
      console.warn('[prospect-conversion] múltiplos clientes com mesmo telefone; usando o mais recente.');
    }
    const candidate = getNewestEntity(matches);
    if (candidate) return candidate;
  }

  return null;
}

function mergeClientTags(existing: string[] | undefined, includeConverted: boolean): string[] {
  const tags = new Set((existing ?? []).map((tag) => tag.trim()).filter(Boolean));
  if (includeConverted) {
    tags.add(CONVERSION_TAG);
  } else {
    tags.delete(CONVERSION_TAG);
  }
  return Array.from(tags);
}

async function resolveClientForConversion(
  prospect: Prospect,
  ownerUid: string,
): Promise<{ client: Cliente; created: boolean }> {
  if (prospect.convertedClientId) {
    const existingById = await clienteRepository.getById(prospect.convertedClientId, ownerUid);
    if (existingById) return { client: existingById, created: false };
  }

  const dedupedClient = await findClientForProspect(prospect, ownerUid);
  if (dedupedClient) return { client: dedupedClient, created: false };

  const created = await clienteRepository.create({
    nome: prospect.nome,
    cpfCnpj: prospect.cpfCnpj ?? '',
    email: prospect.email ?? '',
    telefone: prospect.telefone ?? '',
    dataEntrada: prospect.realizadoData || '',
    origem: prospect.origem || 'prospect',
    status: 'ativo',
    assessor: '',
    custodiaInicial: 0,
    custodiaAtual: 0,
    custodiaOnShore: 0,
    custodiaOffShore: 0,
    codigoConta: '',
    perfilInvestidor: 'Regular',
    observacoes: prospect.observacoes || '',
    convertedValue: prospect.realizadoValor || 0,
    convertedAt: toIsoNow(),
    tags: [CONVERSION_TAG],
    customFields: {
      convertedFromProspectId: prospect.id,
    },
  }, ownerUid);

  return { client: created, created: true };
}

async function upsertCaptacaoBySourceRef(
  sourceRef: string,
  payload: Omit<CaptacaoLancamento, 'id' | 'sourceRef'>,
  ownerUid: string,
): Promise<CaptacaoLancamento> {
  const all = await captacaoLancamentoRepository.getAll(ownerUid);
  const existing = all.find((item) => item.sourceRef === sourceRef);

  if (existing?.id) {
    const updated = await captacaoLancamentoRepository.update(existing.id, {
      ...payload,
      sourceRef,
    }, ownerUid);

    if (updated) return updated;
  }

  return captacaoLancamentoRepository.create({
    ...payload,
    sourceRef,
  }, ownerUid);
}

async function getCaptacaoBySourceRef(sourceRef: string, ownerUid: string): Promise<CaptacaoLancamento | null> {
  const all = await captacaoLancamentoRepository.getAll(ownerUid);
  return all.find((item) => item.sourceRef === sourceRef) ?? null;
}

async function removeCaptacaoBySourceRef(sourceRef: string, ownerUid: string): Promise<void> {
  const existing = await getCaptacaoBySourceRef(sourceRef, ownerUid);
  if (!existing?.id) return;
  await captacaoLancamentoRepository.delete(existing.id, ownerUid);
}

function buildBaseCaptacaoFromProspect(prospect: Prospect): Omit<CaptacaoLancamento, 'id' | 'sourceRef'> {
  const realizedDate = prospect.realizadoData || new Date().toISOString().slice(0, 10);
  const { mes, ano } = getMonthYear(realizedDate);
  const tipo = resolveTipo(prospect.realizadoTipo || prospect.potencialTipo);

  return {
    data: realizedDate,
    mes,
    ano,
    direcao: 'entrada',
    tipo,
    origem: 'prospect',
    referenciaId: prospect.id,
    referenciaNome: prospect.nome,
    valor: Number(prospect.realizadoValor || 0),
    observacoes: 'Conversao de prospect',
    bucket: undefined,
  };
}

async function applyConvertedClientState(
  client: Cliente,
  prospect: Prospect,
  ownerUid: string,
): Promise<Cliente> {
  const tags = mergeClientTags(client.tags, true);
  const metrics = {
    ...(client.metrics ?? {}),
    convertedValue: prospect.realizadoValor || 0,
    convertedAt: toIsoNow(),
  };

  const updated = await clienteRepository.update(client.id!, {
    convertedValue: prospect.realizadoValor || 0,
    convertedAt: toIsoNow(),
    tags,
    metrics,
    customFields: {
      ...(client.customFields ?? {}),
      convertedFromProspectId: prospect.id,
    },
  }, ownerUid);

  return updated ?? client;
}

async function shouldKeepConvertedTag(clientId: string, exceptProspectId: string, ownerUid: string): Promise<boolean> {
  const prospects = await prospectRepository.getAll(ownerUid);
  return prospects.some((prospect) =>
    prospect.id !== exceptProspectId &&
    prospect.converted === true &&
    prospect.convertedClientId === clientId,
  );
}

async function removeConvertedClientState(
  clientId: string,
  prospectId: string,
  ownerUid: string,
): Promise<void> {
  const client = await clienteRepository.getById(clientId, ownerUid);
  if (!client?.id) return;

  const keepTag = await shouldKeepConvertedTag(clientId, prospectId, ownerUid);
  const tags = mergeClientTags(client.tags, keepTag);
  const nextMetrics = {
    ...(client.metrics ?? {}),
  } as Record<string, unknown>;

  if (keepTag) {
    nextMetrics.convertedValue = client.convertedValue;
    nextMetrics.convertedAt = client.convertedAt;
  } else {
    delete nextMetrics.convertedValue;
    delete nextMetrics.convertedAt;
  }

  await clienteRepository.update(client.id, {
    tags,
    convertedValue: keepTag ? client.convertedValue : undefined,
    convertedAt: keepTag ? client.convertedAt : undefined,
    metrics: Object.keys(nextMetrics).length > 0 ? (nextMetrics as Cliente['metrics']) : undefined,
  }, ownerUid);
}

async function convertProspect(
  prospect: Prospect,
  ownerUid: string,
): Promise<{ prospect: Prospect; createdClientId?: string; updatedClientId?: string }> {
  if (!prospect.id) {
    return { prospect };
  }

  const clientResolution = await resolveClientForConversion(prospect, ownerUid);
  const updatedClient = await applyConvertedClientState(clientResolution.client, prospect, ownerUid);

  const conversionRef = buildConversionRef(prospect.id);
  const conversionPayload = buildBaseCaptacaoFromProspect(prospect);
  await upsertCaptacaoBySourceRef(conversionRef, conversionPayload, ownerUid);
  await removeCaptacaoBySourceRef(buildReversalRef(prospect.id), ownerUid);

  const updatedProspect = await prospectRepository.update(prospect.id, {
    converted: true,
    convertedAt: toIsoNow(),
    convertedClientId: updatedClient.id,
  }, ownerUid);

  return {
    prospect: updatedProspect ?? prospect,
    createdClientId: clientResolution.created ? updatedClient.id : undefined,
    updatedClientId: updatedClient.id,
  };
}

async function deconvertProspect(
  prospect: Prospect,
  before: Prospect | null,
  ownerUid: string,
): Promise<Prospect> {
  if (!prospect.id) return prospect;

  const conversionRef = buildConversionRef(prospect.id);
  const reversalRef = buildReversalRef(prospect.id);
  const existingConversion = await getCaptacaoBySourceRef(conversionRef, ownerUid);

  const baseAmount = Number(
    prospect.realizadoValor && prospect.realizadoValor > 0
      ? prospect.realizadoValor
      : existingConversion?.valor || before?.realizadoValor || 0,
  );

  const referenceDate = prospect.realizadoData || existingConversion?.data || before?.realizadoData;
  if (baseAmount > 0 && referenceDate) {
    const { mes, ano } = getMonthYear(referenceDate);
    await upsertCaptacaoBySourceRef(reversalRef, {
      data: referenceDate,
      mes,
      ano,
      direcao: 'saida',
      tipo: resolveTipo(prospect.realizadoTipo || before?.realizadoTipo || before?.potencialTipo),
      origem: 'prospect',
      referenciaId: prospect.id,
      referenciaNome: prospect.nome,
      valor: baseAmount,
      observacoes: 'Estorno de desconversao de prospect',
      bucket: undefined,
    }, ownerUid);
  }

  const clientId = prospect.convertedClientId || before?.convertedClientId;
  if (clientId) {
    await removeConvertedClientState(clientId, prospect.id, ownerUid);
  }

  const updated = await prospectRepository.update(prospect.id, {
    converted: false,
    convertedAt: undefined,
  }, ownerUid);

  return updated ?? prospect;
}

export async function saveProspectWithConversion(
  input: SaveProspectInput,
  context: ProspectConversionContext,
): Promise<SaveProspectResult> {
  const { ownerUid } = context;
  const { prospectId, data } = input;

  const before = prospectId ? await prospectRepository.getById(prospectId, ownerUid) : null;
  const candidateStatus = (data.status ?? before?.status ?? 'novo') as Prospect['status'];
  const candidateRealizadoValor = Number(data.realizadoValor ?? before?.realizadoValor ?? 0);
  const candidateRealizadoData = data.realizadoData ?? before?.realizadoData;

  if (isWonStatus(candidateStatus) && !(candidateRealizadoValor > 0 && Boolean(candidateRealizadoData))) {
    throw new Error('PROSPECT_CONVERSION_REQUIREMENTS');
  }

  const upserted = prospectId
    ? await prospectRepository.update(prospectId, data, ownerUid)
    : await (async () => {
        const parsed = prospectSchema.parse(data);
        const createPayload: Omit<Prospect, 'id'> = {
          ...parsed,
        };
        delete (createPayload as Partial<Prospect>).id;
        return prospectRepository.create(createPayload, ownerUid);
      })();

  if (!upserted) {
    throw new Error('PROSPECT_NOT_FOUND');
  }

  const after = upserted;
  const afterIsWon = isWonStatus(after.status);
  const beforeIsWon = isWonStatus(before?.status);

  if (afterIsWon && !hasValidRealizedData(after)) {
    throw new Error('PROSPECT_CONVERSION_REQUIREMENTS');
  }

  if (afterIsWon) {
    return convertProspect(after, ownerUid);
  }

  if (beforeIsWon || before?.converted) {
    const deconverted = await deconvertProspect(after, before, ownerUid);
    return { prospect: deconverted };
  }

  return { prospect: after };
}
