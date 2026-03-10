/**
 * ClientProduct — modelo relacional para produtos contratados por cliente.
 *
 * Decisão arquitetural:
 * Em vez de campos booleanos soltos no Cliente (temConsorcio, temSeguro, etc.),
 * usamos uma coleção separada `clientProducts` com campo `type` discriminante.
 * Isso permite:
 *   - Adicionar novos tipos de produto sem alterar o schema do Cliente.
 *   - Associar metadados arbitrários via `metadata`.
 *   - Histórico por produto (status, datas, valores).
 *   - Queries eficientes por clienteId + type.
 */

import { z } from 'zod';

// ============== CLIENT PRODUCT ==============

export const CLIENT_PRODUCT_TYPES = [
  'CONSORCIO',
  'SEGURO_VIDA',
  'FEE_FIXO',
  'PREVIDENCIA_PRIVADA',
  'CAMBIO',
  'CREDITO',
  'OUTRO',
] as const;

export type ClientProductType = typeof CLIENT_PRODUCT_TYPES[number];

export const CLIENT_PRODUCT_STATUS = ['ATIVO', 'INATIVO', 'PENDENTE', 'CANCELADO'] as const;
export type ClientProductStatus = typeof CLIENT_PRODUCT_STATUS[number];

export const clientProductSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),

  /** Tipo do produto: CONSORCIO, SEGURO_VIDA, FEE_FIXO, etc. */
  type: z.enum(CLIENT_PRODUCT_TYPES),

  /** Nome/descrição do produto (ex: "Consórcio Imóvel Porto Seguro") */
  name: z.string().min(1, 'Nome é obrigatório'),

  /** Status do produto junto ao cliente */
  status: z.enum(CLIENT_PRODUCT_STATUS).default('ATIVO'),

  /** Valor principal (carta de consórcio, PA do seguro, valor do fee, etc.) */
  valor: z.number().min(0).default(0),

  /** Receita/comissão estimada do produto */
  receitaEstimada: z.number().min(0).default(0),

  /** Valor mensal do fee fixo (quando type === FEE_FIXO) */
  valorMensal: z.number().min(0).optional().default(0),

  /** Data de contratação */
  dataContratacao: z.string().optional(),

  /** Data de vencimento / término */
  dataVencimento: z.string().optional(),

  /** Metadados flexíveis para campos específicos do tipo de produto */
  metadata: z.record(z.string(), z.unknown()).optional().default({}),

  /** Observações livres */
  observacoes: z.string().optional(),

  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ClientProduct = z.output<typeof clientProductSchema>;
export type ClientProductInput = z.input<typeof clientProductSchema>;

// ============== HELPERS ==============

/** Labels legíveis para cada tipo de produto */
export const CLIENT_PRODUCT_TYPE_LABELS: Record<ClientProductType, string> = {
  CONSORCIO: 'Consórcio',
  SEGURO_VIDA: 'Seguro de Vida',
  FEE_FIXO: 'Fee Fixo',
  PREVIDENCIA_PRIVADA: 'Previdência Privada',
  CAMBIO: 'Câmbio',
  CREDITO: 'Crédito',
  OUTRO: 'Outro',
};

/** Labels legíveis para status do produto */
export const CLIENT_PRODUCT_STATUS_LABELS: Record<ClientProductStatus, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  PENDENTE: 'Pendente',
  CANCELADO: 'Cancelado',
};
