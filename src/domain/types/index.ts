import { z } from 'zod';

// ============== CLIENTE ==============
export const clienteSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpfCnpj: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  dataEntrada: z.string().optional(),
  origem: z.string().optional(),
  status: z.enum(['ativo', 'inativo', 'prospecto']).optional().default('ativo'),
  assessor: z.string().optional(),
  custodiaInicial: z.number().min(0).optional().default(0),
  custodiaAtual: z.number().min(0).optional().default(0),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Cliente = z.output<typeof clienteSchema>;
export type ClienteInput = z.input<typeof clienteSchema>;

// ============== PROSPECT ==============
export const prospectSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpfCnpj: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  origem: z.string().optional(),
  potencial: z.number().min(0).optional().default(0),
  probabilidade: z.number().min(0).max(100).optional().default(50),
  dataContato: z.string().optional(),
  proximoContato: z.string().optional(),
  status: z.enum(['novo', 'em_contato', 'qualificado', 'proposta', 'ganho', 'perdido']).optional().default('novo'),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Prospect = z.output<typeof prospectSchema>;
export type ProspectInput = z.input<typeof prospectSchema>;

// ============== CROSS SELLING ==============
export const crossSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  clienteNome: z.string().optional(),
  produto: z.string().min(1, 'Produto é obrigatório'),
  categoria: z.enum(['seguros', 'previdencia', 'cambio', 'credito', 'consorcio', 'outros']).optional().default('outros'),
  valor: z.number().min(0).optional().default(0),
  comissao: z.number().min(0).optional().default(0),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'cancelado']).optional().default('pendente'),
  dataVenda: z.string().optional(),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Cross = z.output<typeof crossSchema>;
export type CrossInput = z.input<typeof crossSchema>;

// ============== RESERVA ==============
export const reservaSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().optional(),
  clienteNome: z.string().optional(),
  tipo: z.enum(['aporte', 'resgate', 'transferencia_entrada', 'transferencia_saida']).optional().default('aporte'),
  valor: z.number().optional().default(0),
  dataAgendada: z.string().min(1, 'Data é obrigatória'),
  dataEfetivada: z.string().optional(),
  status: z.enum(['agendada', 'confirmada', 'efetivada', 'cancelada']).optional().default('agendada'),
  produto: z.string().optional(),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Reserva = z.output<typeof reservaSchema>;
export type ReservaInput = z.input<typeof reservaSchema>;

// ============== CUSTÓDIA X RECEITA ==============
export const custodiaReceitaSchema = z.object({
  id: z.string().optional(),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  clienteId: z.string().optional(),
  clienteNome: z.string().optional(),
  custodiaInicio: z.number().min(0).optional().default(0),
  custodiaFim: z.number().min(0).optional().default(0),
  captacaoBruta: z.number().optional().default(0),
  resgate: z.number().optional().default(0),
  receitaRV: z.number().min(0).optional().default(0),
  receitaRF: z.number().min(0).optional().default(0),
  receitaCOE: z.number().min(0).optional().default(0),
  receitaFundos: z.number().min(0).optional().default(0),
  receitaPrevidencia: z.number().min(0).optional().default(0),
  receitaOutros: z.number().min(0).optional().default(0),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CustodiaReceita = z.output<typeof custodiaReceitaSchema>;
export type CustodiaReceitaInput = z.input<typeof custodiaReceitaSchema>;

// ============== PLANO DE RECEITAS ==============
export const planoReceitasSchema = z.object({
  id: z.string().optional(),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  metaCustodia: z.number().min(0).optional().default(0),
  metaCaptacao: z.number().optional().default(0),
  metaReceitaRV: z.number().min(0).optional().default(0),
  metaReceitaRF: z.number().min(0).optional().default(0),
  metaReceitaCOE: z.number().min(0).optional().default(0),
  metaReceitaFundos: z.number().min(0).optional().default(0),
  metaReceitaPrevidencia: z.number().min(0).optional().default(0),
  metaReceitaOutros: z.number().min(0).optional().default(0),
  metaReceitaTotal: z.number().min(0).optional().default(0),
  metaCross: z.number().min(0).optional().default(0),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type PlanoReceitas = z.output<typeof planoReceitasSchema>;
export type PlanoReceitasInput = z.input<typeof planoReceitasSchema>;

// ============== SALÁRIO ==============
export const salarioSchema = z.object({
  id: z.string().optional(),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  
  // Receitas base para cálculo
  receitaTotal: z.number().min(0).optional().default(0),
  receitaCross: z.number().min(0).optional().default(0),
  
  // Percentuais de comissão
  percentualComissao: z.number().min(0).max(100).optional().default(30),
  percentualCross: z.number().min(0).max(100).optional().default(50),
  
  // Bônus e deduções
  bonusFixo: z.number().optional().default(0),
  bonusMeta: z.number().optional().default(0),
  adiantamentos: z.number().optional().default(0),
  descontos: z.number().optional().default(0),
  
  // IR retido na fonte (se aplicável)
  irrf: z.number().min(0).optional().default(0),
  
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Salario = z.output<typeof salarioSchema>;
export type SalarioInput = z.input<typeof salarioSchema>;

// ============== TIPOS AUXILIARES ==============
export interface MonthYear {
  mes: number;
  ano: number;
}

export interface FilterOptions {
  mes?: number;
  ano?: number;
  status?: string;
  origem?: string;
  clienteId?: string;
}

// ============== CAPTAÇÃO ==============
export const captacaoLancamentoSchema = z.object({
  id: z.string().optional(),
  data: z.string().min(1, 'Data é obrigatória'),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  direcao: z.enum(['entrada', 'saida']),
  tipo: z.enum(['captacao_liquida', 'transferencia_xp', 'troca_escritorio', 'resgate', 'outros']),
  origem: z.enum(['cliente', 'prospect', 'manual']),
  referenciaId: z.string().optional(),
  referenciaNome: z.string().optional(),
  valor: z.number().min(0, 'Valor deve ser positivo'),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CaptacaoLancamento = z.output<typeof captacaoLancamentoSchema>;
export type CaptacaoLancamentoInput = z.input<typeof captacaoLancamentoSchema>;
