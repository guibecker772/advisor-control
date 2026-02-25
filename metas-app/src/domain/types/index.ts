import { z } from 'zod';
import {
  OFFER_ASSET_CLASS_VALUES,
  OFFER_AUDIENCE_VALUES,
  OFFER_STATUS_VALUES,
} from '../offers';

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
  custodiaAtual: z.number().optional().default(0),
  custodiaOnShore: z.number().optional().default(0),
  custodiaOffShore: z.number().optional().default(0),
  codigoConta: z.string().optional().default(''),
  perfilInvestidor: z.enum(['Regular', 'Qualificado', 'Profissional']).optional().default('Regular'),
  observacoes: z.string().optional(),
  convertedValue: z.number().optional(),
  convertedAt: z.string().optional(),
  hasFixedFee: z.boolean().optional(),
  nextMeetingAt: z.string().optional(),
  birthDate: z.string().optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  metrics: z.object({
    totalBRL: z.number().optional(),
    onshoreBRL: z.number().optional(),
    offshoreBRL: z.number().optional(),
    cdiYearPct: z.number().optional(),
  }).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Cliente = z.output<typeof clienteSchema>;
export type ClienteInput = z.input<typeof clienteSchema>;

// ============== CLIENTE REUNIÃO (por mês/ano) ==============
export const clienteReuniaoSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  realizada: z.boolean().default(false),
  observacoes: z.string().optional().default(''),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ClienteReuniao = z.output<typeof clienteReuniaoSchema>;
export type ClienteReuniaoInput = z.input<typeof clienteReuniaoSchema>;

// ============== PROSPECT ==============
export const prospectSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpfCnpj: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  origem: z.string().optional(),
  potencial: z.number().min(0).optional().default(0),
  potencialTipo: z.enum(['captacao_liquida', 'transferencia_xp']).optional().default('captacao_liquida'),
  probabilidade: z.number().min(0).max(100).optional().default(50),
  dataContato: z.string().optional(),
  proximoContato: z.string().optional(),
  proximoContatoHora: z.string().optional(),
  realizadoValor: z.number().min(0).optional().default(0),
  realizadoTipo: z.enum(['captacao_liquida', 'transferencia_xp']).optional().default('captacao_liquida'),
  realizadoData: z.string().optional(),
  status: z.enum(['novo', 'em_contato', 'qualificado', 'proposta', 'ganho', 'perdido']).optional().default('novo'),
  converted: z.boolean().optional().default(false),
  convertedAt: z.string().optional(),
  convertedClientId: z.string().optional(),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Prospect = z.output<typeof prospectSchema>;
export type ProspectInput = z.input<typeof prospectSchema>;

// ============== PROSPECT INTERAÇÃO (histórico de contatos) ==============
export const prospectInteracaoSchema = z.object({
  id: z.string().optional(),
  prospectId: z.string().min(1, 'Prospect é obrigatório'),
  tipo: z.enum(['ligacao', 'reuniao', 'email', 'whatsapp', 'visita', 'outro']).default('ligacao'),
  data: z.string().min(1, 'Data é obrigatória'),
  resumo: z.string().optional().default(''),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ProspectInteracao = z.output<typeof prospectInteracaoSchema>;
export type ProspectInteracaoInput = z.input<typeof prospectInteracaoSchema>;

// ============== CROSS SELLING ==============
export const crossSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  clienteNome: z.string().optional(),
  produto: z.string().min(1, 'Produto é obrigatório'),
  categoria: z.enum(['seguros', 'previdencia', 'cambio', 'credito', 'consorcio', 'outros']).optional().default('outros'),
  valor: z.number().min(0).optional().default(0),
  comissao: z.number().min(0).optional().default(0),
  pipeValue: z.number().min(0).optional().default(0),
  realizedValue: z.number().min(0).optional().default(0),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'cancelado']).optional().default('pendente'),
  dataVenda: z.string().optional(),
  mes: z.number().optional(),
  ano: z.number().optional(),
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

// ============== OFERTA/RESERVA DE ATIVOS ==============
export const offerAllocationSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  clienteNome: z.string().optional(),
  allocatedValue: z.number().min(0).default(0),
  saldoOk: z.boolean().default(false),
  reserveDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['RESERVADA', 'LIQUIDADA', 'CANCELADA']).optional().default('RESERVADA'),
});

export type OfferAllocation = z.output<typeof offerAllocationSchema>;

export const offerAttachmentLinkSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  url: z.string().url('Link inválido'),
  type: z.string().optional(),
  createdAt: z.string().optional(),
});

export type OfferAttachmentLink = z.output<typeof offerAttachmentLinkSchema>;

export const classeAtivoOptions = [
  'Emissão Bancária',
  'Crédito Privado',
  'COE',
  'Fundos Secundários',
  'Fundos Oferta Pública',
  'Oferta Pública RF',
  'FIIs',
  'Ações / RV',
  'Previdência',
  'Internacional',
  'Outros',
] as const;

export const offerReservationSchema = z.object({
  id: z.string().optional(),
  nomeAtivo: z.string().min(1, 'Nome do ativo é obrigatório'),
  offerType: z.enum(['PRIVATE', 'PUBLIC']).optional().default('PRIVATE'),
  minimumInvestment: z.number().min(0).optional(),
  reservationEndDate: z.string().optional(),
  classeAtivo: z.string().optional().default('Outros'),
  assetClass: z.enum(OFFER_ASSET_CLASS_VALUES).optional(),
  audience: z.enum(OFFER_AUDIENCE_VALUES).optional(),
  status: z.enum(OFFER_STATUS_VALUES).optional(),
  competenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência inválida').optional(),
  commissionMode: z.enum(['ROA_PERCENT', 'FIXED_REVENUE']).default('ROA_PERCENT'),
  roaPercent: z.number().min(0).max(1).optional().default(0.02),
  revenueFixed: z.number().min(0).optional().default(0),
  repassePercent: z.number().min(0).max(1).optional().default(0.25),
  irPercent: z.number().min(0).max(1).optional().default(0.19),
  dataReserva: z.string().optional(),
  dataLiquidacao: z.string().optional(),
  liquidationDate: z.string().optional(),
  reservaEfetuada: z.boolean().default(false),
  reservaLiquidada: z.boolean().default(false),
  clientes: z.array(offerAllocationSchema).min(1, 'Adicione ao menos 1 cliente'),
  summary: z.string().optional(),
  attachments: z.array(offerAttachmentLinkSchema).optional().default([]),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type OfferReservation = z.output<typeof offerReservationSchema>;
export type OfferReservationInput = z.input<typeof offerReservationSchema>;

// Schema para FORMULÁRIO (aceita percentuais 0-100 na UI)
// Usado pelo react-hook-form com zodResolver
export const offerReservationFormSchema = z.object({
  id: z.string().optional(),
  nomeAtivo: z.string().min(1, 'Nome do ativo é obrigatório'),
  offerType: z.enum(['PRIVATE', 'PUBLIC']).optional().default('PRIVATE'),
  minimumInvestment: z.number().min(0).optional(),
  reservationEndDate: z.string().optional(),
  classeAtivo: z.string().optional().default('Outros'),
  assetClass: z.enum(OFFER_ASSET_CLASS_VALUES).optional().default('OUTROS'),
  audience: z.enum(OFFER_AUDIENCE_VALUES).optional().default('GENERAL'),
  status: z.enum(OFFER_STATUS_VALUES).optional().default('PENDENTE'),
  competenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência inválida').optional(),
  commissionMode: z.enum(['ROA_PERCENT', 'FIXED_REVENUE']).default('ROA_PERCENT'),
  roaPercent: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').optional().default(2),
  revenueFixed: z.number().min(0).optional().default(0),
  repassePercent: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').optional().default(25),
  irPercent: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').optional().default(19),
  dataReserva: z.string().optional(),
  dataLiquidacao: z.string().optional(),
  liquidationDate: z.string().optional(),
  reservaEfetuada: z.boolean().default(false),
  reservaLiquidada: z.boolean().default(false),
  clientes: z.array(offerAllocationSchema).min(1, 'Adicione ao menos 1 cliente'),
  summary: z.string().optional(),
  attachments: z.array(offerAttachmentLinkSchema).optional().default([]),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type OfferReservationFormInput = z.input<typeof offerReservationFormSchema>;

// Funções de cálculo para ofertas
export function calcOfferReservationTotals(reservation: OfferReservation) {
  const totalAllocated = reservation.clientes.reduce((sum, c) => sum + (c.allocatedValue || 0), 0);
  const revenueHouse = reservation.commissionMode === 'ROA_PERCENT'
    ? totalAllocated * (reservation.roaPercent || 0)
    : reservation.revenueFixed || 0;
  const advisorGross = revenueHouse * (reservation.repassePercent || 0.25);
  const advisorTax = advisorGross * (reservation.irPercent || 0.19);
  const advisorNet = advisorGross - advisorTax;
  const clientesSemSaldo = reservation.clientes.filter((c) => !c.saldoOk).length;
  return { totalAllocated, revenueHouse, advisorGross, advisorTax, advisorNet, clientesSemSaldo };
}

export function calcOffersRevenueForMonth(reservations: OfferReservation[], mes: number, ano: number) {
  const competenceMonth = `${ano}-${String(mes).padStart(2, '0')}`;
  return reservations
    .filter((r) => {
      return r.competenceMonth === competenceMonth && r.status === 'LIQUIDADA';
    })
    .reduce((sum, r) => sum + calcOfferReservationTotals(r).revenueHouse, 0);
}

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
  // Metas (Planejado)
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
  // Realizado (preenchido via Custódia x Receita e Captações)
  realizadoCustodia: z.number().min(0).optional().default(0),
  realizadoCaptacao: z.number().optional().default(0), // Pode ser negativo (saídas > entradas)
  realizadoReceitaRV: z.number().min(0).optional().default(0),
  realizadoReceitaRF: z.number().min(0).optional().default(0),
  realizadoReceitaCOE: z.number().min(0).optional().default(0),
  realizadoReceitaFundos: z.number().min(0).optional().default(0),
  realizadoReceitaPrevidencia: z.number().min(0).optional().default(0),
  realizadoReceitaOutros: z.number().min(0).optional().default(0),
  realizadoReceitaTotal: z.number().min(0).optional().default(0),
  realizadoCross: z.number().min(0).optional().default(0),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type PlanoReceitas = z.output<typeof planoReceitasSchema>;
export type PlanoReceitasInput = z.input<typeof planoReceitasSchema>;

// ============== SALÁRIO ==============

// Schema para linha de receita por classe
export const salarioClasseSchema = z.object({
  classe: z.string(),
  receita: z.number().min(0).default(0),
  repassePercent: z.number().min(0).max(1).default(0.25), // 0-1 (25% = 0.25)
  majoracaoPercent: z.number().min(0).max(1).default(0), // 0-1
});

export type SalarioClasse = z.output<typeof salarioClasseSchema>;

export const salarioSchema = z.object({
  id: z.string().optional(),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  
  // Receitas detalhadas por classe (snapshot do mês)
  classes: z.array(salarioClasseSchema).optional().default([]),
  
  // Receitas legado (mantido para compatibilidade)
  receitaTotal: z.number().min(0).optional().default(0),
  receitaCross: z.number().min(0).optional().default(0),
  
  // Percentuais de comissão (legado)
  percentualComissao: z.number().min(0).max(100).optional().default(30),
  percentualCross: z.number().min(0).max(100).optional().default(50),
  
  // IR sobre bruto total (0-1, ex: 0.19 = 19%)
  irPercent: z.number().min(0).max(1).optional().default(0),
  
  // Premiação/Campanha (manual, pode ser negativo para ajustes)
  premiacao: z.number().optional().default(0),
  ajuste: z.number().optional().default(0),
  
  // Bônus e deduções (legado)
  bonusFixo: z.number().optional().default(0),
  bonusMeta: z.number().optional().default(0),
  adiantamentos: z.number().optional().default(0),
  descontos: z.number().optional().default(0),
  
  // IR retido na fonte (legado - valor absoluto)
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
  bucket: z.enum(['onshore', 'offshore']).optional(),
  referenciaId: z.string().optional(),
  referenciaNome: z.string().optional(),
  sourceRef: z.string().optional(), // Para dedupe: ex "prospect:abc123"
  valor: z.number().min(0, 'Valor deve ser positivo'),
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CaptacaoLancamento = z.output<typeof captacaoLancamentoSchema>;
export type CaptacaoLancamentoInput = z.input<typeof captacaoLancamentoSchema>;

// ============== METAS MENSAIS ==============
export const monthlyGoalsSchema = z.object({
  id: z.string().optional(),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2100),
  
  // Metas (valores definidos pelo usuário)
  metaReceita: z.number().min(0).optional().default(0),
  metaCaptacaoLiquida: z.number().optional().default(0), // Pode ser negativa
  metaTransferenciaXp: z.number().optional().default(0), // Pode ser negativa
  
  observacoes: z.string().optional(),
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type MonthlyGoals = z.output<typeof monthlyGoalsSchema>;
export type MonthlyGoalsInput = z.input<typeof monthlyGoalsSchema>;



