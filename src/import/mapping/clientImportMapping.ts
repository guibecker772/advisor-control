import { getStorageUid, readStorageJSON, writeStorageJSON } from '../../lib/userStorage';
import {
  IGNORE_IMPORT_COLUMN,
  type ClientImportColumnMapping,
  type ClientImportColumnMappingValue,
  type ClientImportFieldDefinition,
  type ClientImportFieldKey,
  type ClientImportMappingModel,
} from '../types';

const MODELS_STORAGE_BASE_KEY = 'ac_import_client_mapping_models_v1';
const MODELS_MAX_ITEMS = 5;

const LAST_MODEL_STORAGE_BASE_KEY = 'ac_import_client_mapping_last_model_v1';

const FIELD_HINTS: Record<ClientImportFieldKey, string[]> = {
  nome: ['nome', 'cliente', 'name'],
  codigoConta: ['conta', 'codigo conta', 'account', 'n conta', 'numero conta'],
  perfilInvestidor: ['perfil', 'investidor', 'perfil investidor', 'qualificacao'],
  email: ['email', 'e-mail'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp'],
  cpfCnpj: ['cpf', 'cnpj', 'documento'],
  status: ['status', 'situacao'],
  origem: ['origem', 'canal'],
  observacoes: ['observacao', 'observacoes', 'obs', 'nota', 'notas'],
  custodiaAtual: ['custodia', 'custodia atual', 'aum'],
  'metrics.totalBRL': ['total', 'patrimonio total', 'total brl', 'total r$'],
  'metrics.onshoreBRL': ['onshore', 'on shore'],
  'metrics.offshoreBRL': ['offshore', 'off shore', 'off shore brl'],
  'metrics.cdiYearPct': ['cdi', '% cdi', 'cdi ano', 'cdi no ano'],
  hasFixedFee: ['fee fixo', 'taxa fixa', 'has fixed fee'],
  nextMeetingAt: ['proxima reuniao', 'reuniao mensal', 'next meeting'],
  birthday: ['aniversario', 'nascimento', 'birth', 'birthday'],
};

export const CLIENT_IMPORT_FIELDS: ClientImportFieldDefinition[] = [
  { key: 'nome', label: 'Nome', help: 'Obrigatorio para criar/atualizar cliente.' },
  { key: 'codigoConta', label: 'Conta', help: 'Conta sera normalizada para apenas digitos.' },
  { key: 'perfilInvestidor', label: 'Perfil', help: 'Regular, Qualificado ou Profissional.' },
  { key: 'email', label: 'Email', help: 'Email do cliente.' },
  { key: 'telefone', label: 'Telefone', help: 'Telefone do cliente.' },
  { key: 'cpfCnpj', label: 'CPF/CNPJ', help: 'Documento do cliente.' },
  { key: 'status', label: 'Status', help: 'Ativo, Inativo ou Prospecto.' },
  { key: 'origem', label: 'Origem', help: 'Origem do cliente no funil.' },
  { key: 'observacoes', label: 'Observacoes', help: 'Notas livres para o cliente.' },
  { key: 'custodiaAtual', label: 'Custodia Atual', help: 'Valor numerico BRL.' },
  { key: 'metrics.totalBRL', label: 'Total BRL', help: 'Patrimonio total em BRL.' },
  { key: 'metrics.onshoreBRL', label: 'Onshore BRL', help: 'Patrimonio onshore em BRL.' },
  { key: 'metrics.offshoreBRL', label: 'Offshore BRL', help: 'Patrimonio offshore em BRL.' },
  { key: 'metrics.cdiYearPct', label: '% CDI no ano', help: 'Valor multiplicador x100 (1.674 => 167.4).' },
  { key: 'hasFixedFee', label: 'Fee Fixo', help: 'Campo booleano Sim/Nao.' },
  { key: 'nextMeetingAt', label: 'Proxima Reuniao', help: 'Data/hora da proxima reuniao.' },
  { key: 'birthday', label: 'Aniversario', help: 'Dia/mes ou data completa conforme regra.' },
];

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getModelsStorageKey(uid?: string | null): string {
  return `${MODELS_STORAGE_BASE_KEY}__${getStorageUid(uid)}`;
}

function getLastModelStorageKey(uid?: string | null): string {
  return `${LAST_MODEL_STORAGE_BASE_KEY}__${getStorageUid(uid)}`;
}

export function getFieldOptions(): Array<{ value: ClientImportColumnMappingValue; label: string }> {
  return [
    { value: IGNORE_IMPORT_COLUMN, label: 'Ignorar coluna' },
    ...CLIENT_IMPORT_FIELDS.map((field) => ({ value: field.key, label: field.label })),
  ];
}

export function createDefaultMapping(headers: string[]): ClientImportColumnMapping {
  const mapping: ClientImportColumnMapping = {};
  for (const header of headers) {
    mapping[header] = IGNORE_IMPORT_COLUMN;
  }
  return mapping;
}

function scoreHeaderForField(normalizedHeader: string, fieldKey: ClientImportFieldKey): number {
  const hints = FIELD_HINTS[fieldKey];
  let score = 0;

  for (const hint of hints) {
    const normalizedHint = normalizeHeader(hint);
    if (normalizedHeader === normalizedHint) {
      return 100;
    }
    if (normalizedHeader.includes(normalizedHint)) {
      score = Math.max(score, 60);
    }
    if (normalizedHint.includes(normalizedHeader)) {
      score = Math.max(score, 40);
    }
  }

  return score;
}

export function autoMapHeaders(headers: string[]): ClientImportColumnMapping {
  const mapping = createDefaultMapping(headers);
  const usedFields = new Set<ClientImportFieldKey>();

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    let bestField: ClientImportFieldKey | null = null;
    let bestScore = 0;

    for (const field of CLIENT_IMPORT_FIELDS) {
      if (usedFields.has(field.key)) continue;
      const score = scoreHeaderForField(normalizedHeader, field.key);
      if (score > bestScore) {
        bestScore = score;
        bestField = field.key;
      }
    }

    if (bestField && bestScore >= 60) {
      mapping[header] = bestField;
      usedFields.add(bestField);
    }
  }

  return mapping;
}

export function loadMappingModels(uid?: string | null): ClientImportMappingModel[] {
  const key = getModelsStorageKey(uid);
  const models = readStorageJSON<ClientImportMappingModel[]>(key, []);
  if (!Array.isArray(models)) return [];
  return models;
}

export function saveMappingModel(
  uid: string | null | undefined,
  name: string,
  mapping: ClientImportColumnMapping,
): ClientImportMappingModel[] {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('MODEL_NAME_REQUIRED');
  }

  const key = getModelsStorageKey(uid);
  const now = new Date().toISOString();
  const models = loadMappingModels(uid);

  const model: ClientImportMappingModel = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
    mapping,
  };

  const nextModels = [model, ...models].slice(0, MODELS_MAX_ITEMS);
  writeStorageJSON(key, nextModels);
  writeStorageJSON(getLastModelStorageKey(uid), model.id);
  return nextModels;
}

export function deleteMappingModel(uid: string | null | undefined, modelId: string): ClientImportMappingModel[] {
  const key = getModelsStorageKey(uid);
  const models = loadMappingModels(uid).filter((item) => item.id !== modelId);
  writeStorageJSON(key, models);

  const lastModelKey = getLastModelStorageKey(uid);
  const lastModel = readStorageJSON<string | null>(lastModelKey, null);
  if (lastModel === modelId) {
    writeStorageJSON(lastModelKey, null);
  }

  return models;
}

export function applyMappingModel(
  headers: string[],
  model: ClientImportMappingModel,
): ClientImportColumnMapping {
  const mapping = createDefaultMapping(headers);
  for (const header of headers) {
    const nextValue = model.mapping[header];
    if (nextValue) {
      mapping[header] = nextValue;
    }
  }
  return mapping;
}

export function getLastUsedModelId(uid?: string | null): string | null {
  return readStorageJSON<string | null>(getLastModelStorageKey(uid), null);
}

export function setLastUsedModelId(uid: string | null | undefined, modelId: string | null): void {
  writeStorageJSON(getLastModelStorageKey(uid), modelId);
}
