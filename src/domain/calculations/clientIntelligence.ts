/**
 * clientIntelligence.ts — Cálculos centralizados de inteligência comercial por cliente.
 *
 * Funções reutilizáveis consumidas por:
 *   - Client 360 Drawer (seções de resumo financeiro, indicadores)
 *   - Tabela de clientes (smart badges)
 *   - Dashboard (KPIs por cliente, se necessário no futuro)
 *
 * Princípios:
 *   1. Aceitar dados já carregados (evitar N+1 queries).
 *   2. Retornar objetos tipados e documentados.
 *   3. Usar as mesmas regras de receita do módulo calculations/index.ts.
 */

import type {
  Cliente,
  ClienteReuniao,
  Cross,
  CustodiaReceita,
  OfferReservation,
} from '../types';
import type { ClientProduct } from '../types/clientProduct';
import { calcOfferReservationTotals } from '../types';
import { normalizeOfferStatus, normalizeCompetenceMonth, isValidCompetenceMonth } from '../offers';
import { calcularReceitaRegistro, calcularROA, isCrossConcluido } from '../calculations';

// ============== TIPOS DE RETORNO ==============

export interface ClientFinancialSummary {
  /** Custódia total do cliente */
  custodiaTotal: number;
  /** Receita realizada (LIQUIDADA) no mês selecionado */
  receitaMes: number;
  /** Receita estimada (pipeline) no mês selecionado */
  receitaEstimadaMes: number;
  /** Receita realizada acumulada no ano */
  receitaAno: number;
  /** ROA médio (receita mês / custódia) */
  roaMedio: number;
  /** Possui fee fixo ativo? */
  hasFixedFee: boolean;
  /** Valor mensal do fee fixo (se aplicável) */
  feeFixoMensal: number;
}

export interface ClientRelationshipSummary {
  /** Última reunião realizada (data ISO, ou null) */
  ultimaReuniao: string | null;
  /** Tipo da última reunião */
  tipoUltimaReuniao: string | null;
  /** Próxima reunião agendada */
  proximaReuniao: string | null;
  /** Reunião do período atual foi realizada? */
  reuniaoPeriodoRealizada: boolean;
  /** Dias desde o último contato registrado */
  diasSemContato: number | null;
}

export interface ClientMovement {
  offerName: string;
  valor: number;
  receita: number;
  status: string;
  competenceMonth: string;
}

/** Score de 0 a 5 indicando potencial de ação comercial */
export interface OpportunityScore {
  score: number;
  maxScore: number;
  level: 'high' | 'medium' | 'low';
  label: string;
  reasons: string[];
}

// ============== RECEITA POR CLIENTE ==============

/**
 * Calcula receita realizada de ofertas para um cliente específico em um mês.
 *
 * REGRA: status === LIQUIDADA + competência === mês/ano
 *        + cliente aparece em offer.clientes[]
 */
export function calcularReceitaClienteMes(
  clienteId: string,
  ofertas: OfferReservation[],
  mes: number,
  ano: number,
): number {
  const targetCompetenceMonth = `${ano}-${String(mes).padStart(2, '0')}`;

  return ofertas
    .filter((offer) => {
      const status = normalizeOfferStatus(offer.status);
      if (status !== 'LIQUIDADA') return false;

      // Verifica se o cliente participa dessa oferta
      const hasClient = offer.clientes?.some((c) => c.clienteId === clienteId);
      if (!hasClient) return false;

      const fallbackDate = offer.dataReserva || offer.createdAt;
      const rawCm = offer.competenceMonth;
      if (!isValidCompetenceMonth(rawCm) && !fallbackDate) return false;

      return normalizeCompetenceMonth(rawCm, fallbackDate) === targetCompetenceMonth;
    })
    .reduce((sum, offer) => {
      // Receita proporcional à alocação do cliente
      const { revenueHouse, totalAllocated } = calcOfferReservationTotals(offer);
      if (totalAllocated <= 0) return sum;

      const clientAlloc = offer.clientes?.find((c) => c.clienteId === clienteId);
      const clientValue = clientAlloc?.allocatedValue ?? 0;
      const proportion = clientValue / totalAllocated;

      return sum + revenueHouse * proportion;
    }, 0);
}

/**
 * Calcula receita estimada (pipeline) de ofertas para um cliente em um mês.
 *
 * REGRA: status !== CANCELADA + competência === mês/ano
 *        + cliente aparece em offer.clientes[]
 */
export function calcularReceitaEstimadaClienteMes(
  clienteId: string,
  ofertas: OfferReservation[],
  mes: number,
  ano: number,
): number {
  const targetCompetenceMonth = `${ano}-${String(mes).padStart(2, '0')}`;
  const ESTIMATED_STATUSES = new Set(['PENDENTE', 'RESERVADA', 'LIQUIDADA']);

  return ofertas
    .filter((offer) => {
      const status = normalizeOfferStatus(offer.status);
      if (!ESTIMATED_STATUSES.has(status)) return false;

      const hasClient = offer.clientes?.some((c) => c.clienteId === clienteId);
      if (!hasClient) return false;

      const fallbackDate = offer.dataReserva || offer.createdAt;
      const rawCm = offer.competenceMonth;
      if (!isValidCompetenceMonth(rawCm) && !fallbackDate) return false;

      return normalizeCompetenceMonth(rawCm, fallbackDate) === targetCompetenceMonth;
    })
    .reduce((sum, offer) => {
      const { revenueHouse, totalAllocated } = calcOfferReservationTotals(offer);
      if (totalAllocated <= 0) return sum;

      const clientAlloc = offer.clientes?.find((c) => c.clienteId === clienteId);
      const clientValue = clientAlloc?.allocatedValue ?? 0;
      const proportion = clientValue / totalAllocated;

      return sum + revenueHouse * proportion;
    }, 0);
}

/**
 * Calcula receita acumulada no ano (somente LIQUIDADA).
 */
export function calcularReceitaClienteAno(
  clienteId: string,
  ofertas: OfferReservation[],
  ano: number,
): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    total += calcularReceitaClienteMes(clienteId, ofertas, m, ano);
  }
  return total;
}

/**
 * Calcula receita de Custódia x Receita para um cliente no mês.
 */
export function calcularReceitaCustodiaClienteMes(
  clienteId: string,
  custodiaReceita: CustodiaReceita[],
  mes: number,
  ano: number,
): number {
  return custodiaReceita
    .filter((c) => c.clienteId === clienteId && c.mes === mes && c.ano === ano)
    .reduce((sum, c) => sum + calcularReceitaRegistro(c), 0);
}

/**
 * Calcula receita de Cross Selling concluído para um cliente no mês.
 */
export function calcularReceitaCrossClienteMes(
  clienteId: string,
  crosses: Cross[],
  mes: number,
  ano: number,
): number {
  return crosses
    .filter((c) => {
      if (c.clienteId !== clienteId) return false;
      if (!isCrossConcluido(c.status)) return false;
      if (c.mes && c.ano) return c.mes === mes && c.ano === ano;
      if (!c.dataVenda) return false;
      const d = new Date(c.dataVenda + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    })
    .reduce((sum, c) => sum + (c.comissao ?? 0), 0);
}

// ============== RESUMO FINANCEIRO ==============

export function calcularResumoFinanceiro(
  cliente: Cliente,
  ofertas: OfferReservation[],
  custodiaReceita: CustodiaReceita[],
  crosses: Cross[],
  clientProducts: ClientProduct[],
  mes: number,
  ano: number,
): ClientFinancialSummary {
  const clienteId = cliente.id ?? '';
  const custodiaTotal = cliente.custodiaAtual ?? 0;

  // Receita ofertas (realizada + estimada)
  const receitaOfertasMes = calcularReceitaClienteMes(clienteId, ofertas, mes, ano);
  const receitaEstimadaOfertasMes = calcularReceitaEstimadaClienteMes(clienteId, ofertas, mes, ano);

  // Receita custódia
  const receitaCustodia = calcularReceitaCustodiaClienteMes(clienteId, custodiaReceita, mes, ano);

  // Receita cross
  const receitaCross = calcularReceitaCrossClienteMes(clienteId, crosses, mes, ano);

  const receitaMes = receitaOfertasMes + receitaCustodia + receitaCross;
  const receitaEstimadaMes = receitaEstimadaOfertasMes + receitaCustodia + receitaCross;

  // Receita ano (somente ofertas liquidadas, simplificado)
  const receitaAno = calcularReceitaClienteAno(clienteId, ofertas, ano);

  // ROA
  const roaMedio = calcularROA(receitaMes, custodiaTotal > 0 ? custodiaTotal : 1);

  // Fee fixo ativo
  const feeFixo = clientProducts.find(
    (p) => p.type === 'FEE_FIXO' && p.status === 'ATIVO' && p.clienteId === clienteId,
  );
  const hasFixedFee = Boolean(feeFixo) || Boolean(cliente.hasFixedFee);
  const feeFixoMensal = feeFixo?.valorMensal ?? 0;

  return {
    custodiaTotal,
    receitaMes,
    receitaEstimadaMes,
    receitaAno,
    roaMedio,
    hasFixedFee,
    feeFixoMensal,
  };
}

// ============== RELACIONAMENTO ==============

export function calcularResumoRelacionamento(
  clienteId: string,
  reunioes: ClienteReuniao[],
  mes: number,
  ano: number,
  nextMeetingAt?: string,
): ClientRelationshipSummary {
  // Reunião do período atual
  const reuniaoPeriodo = reunioes.find(
    (r) => r.clienteId === clienteId && r.mes === mes && r.ano === ano,
  );

  // Última reunião realizada (qualquer período)
  const reunioesRealizadas = reunioes
    .filter((r) => r.clienteId === clienteId && r.realizada)
    .sort((a, b) => {
      const dateA = new Date(a.ano, a.mes - 1);
      const dateB = new Date(b.ano, b.mes - 1);
      return dateB.getTime() - dateA.getTime();
    });

  const ultimaReuniaoObj = reunioesRealizadas[0];
  const ultimaReuniao = ultimaReuniaoObj
    ? new Date(ultimaReuniaoObj.ano, ultimaReuniaoObj.mes - 1, 1).toISOString()
    : null;

  // Dias sem contato
  let diasSemContato: number | null = null;
  if (ultimaReuniao) {
    const lastContact = new Date(ultimaReuniao);
    const now = new Date();
    diasSemContato = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    ultimaReuniao,
    tipoUltimaReuniao: ultimaReuniaoObj ? 'Reunião mensal' : null,
    proximaReuniao: nextMeetingAt ?? null,
    reuniaoPeriodoRealizada: reuniaoPeriodo?.realizada ?? false,
    diasSemContato,
  };
}

// ============== MOVIMENTAÇÕES RECENTES ==============

export function calcularMovimentacoesRecentes(
  clienteId: string,
  ofertas: OfferReservation[],
  mes: number,
  ano: number,
): ClientMovement[] {
  const targetCompetenceMonth = `${ano}-${String(mes).padStart(2, '0')}`;

  return ofertas
    .filter((offer) => {
      const status = normalizeOfferStatus(offer.status);
      if (status === 'CANCELADA') return false;

      const hasClient = offer.clientes?.some((c) => c.clienteId === clienteId);
      if (!hasClient) return false;

      const fallbackDate = offer.dataReserva || offer.createdAt;
      const rawCm = offer.competenceMonth;
      if (!isValidCompetenceMonth(rawCm) && !fallbackDate) return false;

      return normalizeCompetenceMonth(rawCm, fallbackDate) === targetCompetenceMonth;
    })
    .map((offer) => {
      const { revenueHouse, totalAllocated } = calcOfferReservationTotals(offer);
      const clientAlloc = offer.clientes?.find((c) => c.clienteId === clienteId);
      const clientValue = clientAlloc?.allocatedValue ?? 0;
      const proportion = totalAllocated > 0 ? clientValue / totalAllocated : 0;

      return {
        offerName: offer.nomeAtivo,
        valor: clientValue,
        receita: revenueHouse * proportion,
        status: normalizeOfferStatus(offer.status),
        competenceMonth: normalizeCompetenceMonth(offer.competenceMonth, offer.dataReserva || offer.createdAt),
      };
    });
}

// ============== OPPORTUNITY SCORE ==============

const DAYS_WITHOUT_CONTACT_THRESHOLD = 90;
const LOW_REVENUE_ROA_THRESHOLD = 0.005; // 0.5% — receita mensal muito baixa vs custódia

/**
 * Calcula o Opportunity Score (0-5) do cliente.
 *
 * Cada critério concede +1:
 *   +1 Não possui seguro de vida ativo
 *   +1 Não possui consórcio ativo
 *   +1 Não tem fee fixo ativo
 *   +1 Sem reunião nos últimos 90 dias
 *   +1 ROA mensal abaixo de 0.5% (receita baixa vs custódia)
 */
export function calcularOpportunityScore(
  cliente: Cliente,
  clientProducts: ClientProduct[],
  relacionamento: ClientRelationshipSummary,
  financeiro: ClientFinancialSummary,
): OpportunityScore {
  const reasons: string[] = [];
  let score = 0;

  const clienteId = cliente.id ?? '';
  const activeProducts = clientProducts.filter(
    (p) => p.clienteId === clienteId && p.status === 'ATIVO',
  );

  // 1. Sem seguro de vida
  const hasSeguro = activeProducts.some((p) => p.type === 'SEGURO_VIDA');
  if (!hasSeguro) {
    score += 1;
    reasons.push('Sem seguro de vida');
  }

  // 2. Sem consórcio
  const hasConsorcio = activeProducts.some((p) => p.type === 'CONSORCIO');
  if (!hasConsorcio) {
    score += 1;
    reasons.push('Sem consórcio');
  }

  // 3. Sem fee fixo
  if (!financeiro.hasFixedFee) {
    score += 1;
    reasons.push('Sem fee fixo');
  }

  // 4. Sem reunião há 90+ dias
  if (
    relacionamento.diasSemContato === null ||
    relacionamento.diasSemContato >= DAYS_WITHOUT_CONTACT_THRESHOLD
  ) {
    score += 1;
    reasons.push(`Sem reunião há ${relacionamento.diasSemContato ?? '?'} dias`);
  }

  // 5. ROA mensal baixo (receita < threshold % da custódia)
  const custodiaTotal = financeiro.custodiaTotal;
  if (custodiaTotal > 0) {
    const roaDecimal = financeiro.receitaMes / custodiaTotal;
    if (roaDecimal < LOW_REVENUE_ROA_THRESHOLD) {
      score += 1;
      reasons.push('Receita baixa vs custódia');
    }
  }

  const maxScore = 5;
  let level: OpportunityScore['level'];
  let label: string;

  if (score >= 4) {
    level = 'high';
    label = 'Alta Oportunidade';
  } else if (score >= 2) {
    level = 'medium';
    label = 'Média Oportunidade';
  } else {
    level = 'low';
    label = 'Baixa Oportunidade';
  }

  return { score, maxScore, level, label, reasons };
}

// ============== BADGES INTELIGENTES ==============

export interface SmartBadge {
  id: string;
  label: string;
  emoji: string;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'gold';
}

/**
 * Gera badges inteligentes para exibição na tabela de clientes.
 * Derivados do Opportunity Score e dados reais.
 */
export function gerarSmartBadges(
  cliente: Cliente,
  clientProducts: ClientProduct[],
  relacionamento: ClientRelationshipSummary,
  financeiro: ClientFinancialSummary,
  opportunityScore: OpportunityScore,
): SmartBadge[] {
  const badges: SmartBadge[] = [];

  // Alta oportunidade
  if (opportunityScore.level === 'high') {
    badges.push({
      id: 'high-opportunity',
      label: 'Alta oportunidade',
      emoji: '🔥',
      variant: 'danger',
    });
  }

  // Alto potencial (custódia alta, receita baixa)
  const custodiaTotal = financeiro.custodiaTotal;
  if (custodiaTotal > 500_000 && financeiro.receitaMes < custodiaTotal * 0.005) {
    badges.push({
      id: 'high-potential',
      label: 'Alto potencial',
      emoji: '💰',
      variant: 'gold',
    });
  }

  // Sem reunião há 90 dias
  if (
    relacionamento.diasSemContato !== null &&
    relacionamento.diasSemContato >= DAYS_WITHOUT_CONTACT_THRESHOLD
  ) {
    badges.push({
      id: 'no-contact',
      label: `Sem reunião há ${relacionamento.diasSemContato}d`,
      emoji: '💤',
      variant: 'warning',
    });
  }

  // Sem produtos complementares
  const clienteId = cliente.id ?? '';
  const activeProducts = clientProducts.filter(
    (p) => p.clienteId === clienteId && p.status === 'ATIVO',
  );
  if (activeProducts.length === 0) {
    badges.push({
      id: 'no-products',
      label: 'Sem produtos',
      emoji: '🛑',
      variant: 'neutral',
    });
  }

  return badges;
}
