/**
 * Módulo de Cálculos Centralizados
 * Replica todas as fórmulas da planilha Excel "Metas Profissionais"
 */

import type { CustodiaReceita, Cliente, Cross, Reserva, Salario, PlanoReceitas, CaptacaoLancamento, SalarioClasse, OfferReservation } from '../types';
import { calcOfferReservationTotals } from '../types';

// ============== FORMATAÇÃO ==============

/**
 * Formata valor em BRL (pt-BR)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata percentual
 */
export function formatPercent(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Formata número com separadores pt-BR
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ============== CÁLCULOS DE CUSTÓDIA ==============

/**
 * Calcula a custódia total de todos os clientes
 */
export function calcularCustodiaTotal(clientes: Cliente[]): number {
  return clientes.reduce((sum, c) => sum + (c.custodiaAtual || 0), 0);
}

/**
 * Calcula a variação de custódia (fim - início)
 */
export function calcularVariacaoCustodia(custodiaInicio: number, custodiaFim: number): number {
  return custodiaFim - custodiaInicio;
}

/**
 * Calcula a variação percentual de custódia
 */
export function calcularVariacaoCustodiaPercent(custodiaInicio: number, custodiaFim: number): number {
  if (custodiaInicio === 0) return custodiaFim > 0 ? 100 : 0;
  return ((custodiaFim - custodiaInicio) / custodiaInicio) * 100;
}

// ============== CÁLCULOS DE CAPTAÇÃO ==============

/**
 * Calcula a captação líquida (bruta - resgates)
 */
export function calcularCaptacaoLiquida(captacaoBruta: number, resgates: number): number {
  return captacaoBruta - resgates;
}

/**
 * Calcula a captação total de múltiplos registros
 */
export function calcularCaptacaoTotal(registros: CustodiaReceita[]): number {
  return registros.reduce((sum, r) => sum + calcularCaptacaoLiquida(r.captacaoBruta, r.resgate), 0);
}

/**
 * Calcula captação total a partir de reservas
 */
export function calcularCaptacaoReservas(reservas: Reserva[]): number {
  return reservas.reduce((sum, r) => {
    if (r.status === 'cancelada') return sum;
    if (r.tipo === 'aporte' || r.tipo === 'transferencia_entrada') {
      return sum + r.valor;
    }
    if (r.tipo === 'resgate' || r.tipo === 'transferencia_saida') {
      return sum - r.valor;
    }
    return sum;
  }, 0);
}

// ============== CÁLCULOS DE RECEITA ==============

/**
 * Calcula a receita total de um registro de custódia x receita
 */
export function calcularReceitaRegistro(registro: CustodiaReceita): number {
  return (
    (registro.receitaRV || 0) +
    (registro.receitaRF || 0) +
    (registro.receitaCOE || 0) +
    (registro.receitaFundos || 0) +
    (registro.receitaPrevidencia || 0) +
    (registro.receitaOutros || 0)
  );
}

/**
 * Calcula a receita total de múltiplos registros
 */
export function calcularReceitaTotal(registros: CustodiaReceita[]): number {
  return registros.reduce((sum, r) => sum + calcularReceitaRegistro(r), 0);
}

/**
 * Calcula receita por categoria
 */
export function calcularReceitaPorCategoria(registros: CustodiaReceita[]): Record<string, number> {
  return {
    rv: registros.reduce((s, r) => s + (r.receitaRV || 0), 0),
    rf: registros.reduce((s, r) => s + (r.receitaRF || 0), 0),
    coe: registros.reduce((s, r) => s + (r.receitaCOE || 0), 0),
    fundos: registros.reduce((s, r) => s + (r.receitaFundos || 0), 0),
    previdencia: registros.reduce((s, r) => s + (r.receitaPrevidencia || 0), 0),
    outros: registros.reduce((s, r) => s + (r.receitaOutros || 0), 0),
  };
}

// ============== CÁLCULOS DE ROA ==============

/**
 * Calcula o ROA (Return on Assets) - Receita / Custódia Média
 * ROA = (Receita Total / Custódia Média) * 100
 * Se custódia for 0, retorna 0 para evitar divisão por zero
 */
export function calcularROA(receita: number, custodiaMedia: number): number {
  if (custodiaMedia === 0) return 0;
  return (receita / custodiaMedia) * 100;
}

/**
 * Calcula ROA anualizado
 * ROA Anual = ROA Mensal * 12
 */
export function calcularROAAnualizado(roaMensal: number): number {
  return roaMensal * 12;
}

/**
 * Calcula a custódia média (início + fim) / 2
 */
export function calcularCustodiaMedia(custodiaInicio: number, custodiaFim: number): number {
  return (custodiaInicio + custodiaFim) / 2;
}

/**
 * Calcula ROA de um registro completo
 */
export function calcularROARegistro(registro: CustodiaReceita): number {
  const receita = calcularReceitaRegistro(registro);
  const custodiaMedia = calcularCustodiaMedia(registro.custodiaInicio, registro.custodiaFim);
  return calcularROA(receita, custodiaMedia);
}

// ============== CÁLCULOS DE GAP ==============

/**
 * Calcula o GAP entre meta e realizado
 * GAP = Realizado - Meta
 * Positivo = acima da meta, Negativo = abaixo da meta
 */
export function calcularGAP(meta: number, realizado: number): number {
  return realizado - meta;
}

/**
 * Calcula o GAP percentual
 * GAP % = ((Realizado - Meta) / Meta) * 100
 */
export function calcularGAPPercent(meta: number, realizado: number): number {
  if (meta === 0) return realizado > 0 ? 100 : 0;
  return ((realizado - meta) / meta) * 100;
}

/**
 * Calcula atingimento da meta em percentual
 * Atingimento = (Realizado / Meta) * 100
 */
export function calcularAtingimento(meta: number, realizado: number): number {
  if (meta === 0) return realizado > 0 ? 100 : 0;
  return (realizado / meta) * 100;
}

// ============== CÁLCULOS DE CROSS SELLING ==============

/**
 * Calcula total de vendas cross
 */
export function calcularTotalCross(crosses: Cross[]): number {
  return crosses
    .filter(c => c.status === 'concluido')
    .reduce((sum, c) => sum + (c.valor || 0), 0);
}

/**
 * Calcula total de comissões cross
 */
export function calcularComissaoCross(crosses: Cross[]): number {
  return crosses
    .filter(c => c.status === 'concluido')
    .reduce((sum, c) => sum + (c.comissao || 0), 0);
}

/**
 * Verifica se o status é "concluído" (normalizado)
 */
export function isCrossConcluido(status: string | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return ['concluido', 'concluído', 'completed', 'done'].includes(normalized);
}

/**
 * Extrai mês e ano de um registro Cross, usando dataVenda como fallback
 */
function getCrossMonthYear(cross: Cross): { mes: number; ano: number } | null {
  // Primeiro tenta usar campos mes/ano se existirem
  if (cross.mes && cross.ano) {
    return { mes: cross.mes, ano: cross.ano };
  }
  // Fallback: extrair de dataVenda
  if (cross.dataVenda) {
    const d = new Date(cross.dataVenda + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return { mes: d.getMonth() + 1, ano: d.getFullYear() };
    }
  }
  return null;
}

/**
 * Calcula receita realizada de Cross Selling para um mês específico
 * Considera apenas a COMISSÃO das vendas concluídas no mês/ano
 * Usa dataVenda como fallback quando campos mes/ano não estão preenchidos
 */
export function calcularCrossRealizadoMensal(crosses: Cross[], mes: number, ano: number): number {
  return crosses
    .filter(c => {
      if (!isCrossConcluido(c.status)) return false;
      const period = getCrossMonthYear(c);
      if (!period) return false;
      return period.mes === mes && period.ano === ano;
    })
    .reduce((sum, c) => {
      const comissao = c.comissao ?? 0;
      return sum + (Number.isFinite(comissao) ? comissao : 0);
    }, 0);
}

/**
 * Calcula receita de Ofertas/Ativos para um mês específico
 * Considera data de liquidação no mês/ano
 */
export function calcularOfertasReceitaMensal(ofertas: OfferReservation[], mes: number, ano: number): number {
  return ofertas
    .filter(o => {
      if (!o.dataLiquidacao) return false;
      const d = new Date(o.dataLiquidacao + 'T00:00:00');
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    })
    .reduce((sum, o) => sum + calcOfferReservationTotals(o).revenueHouse, 0);
}

/**
 * Agrupa cross por categoria
 */
export function agruparCrossPorCategoria(crosses: Cross[]): Record<string, { valor: number; comissao: number; quantidade: number }> {
  const result: Record<string, { valor: number; comissao: number; quantidade: number }> = {};
  
  crosses.forEach(c => {
    if (!result[c.categoria]) {
      result[c.categoria] = { valor: 0, comissao: 0, quantidade: 0 };
    }
    result[c.categoria].valor += c.valor || 0;
    result[c.categoria].comissao += c.comissao || 0;
    result[c.categoria].quantidade += 1;
  });
  
  return result;
}

// ============== CÁLCULOS DE SALÁRIO ==============

/**
 * Calcula a comissão sobre receita base
 * Comissão = Receita Total * (Percentual / 100)
 */
export function calcularComissaoReceita(receitaTotal: number, percentual: number): number {
  return receitaTotal * (percentual / 100);
}

/**
 * Calcula a comissão sobre cross selling
 */
export function calcularComissaoCrossSelling(receitaCross: number, percentual: number): number {
  return receitaCross * (percentual / 100);
}

/**
 * Calcula o salário bruto
 * Bruto = Comissão Receita + Comissão Cross + Bônus Fixo + Bônus Meta
 */
export function calcularSalarioBruto(salario: Salario): number {
  const comissaoReceita = calcularComissaoReceita(salario.receitaTotal, salario.percentualComissao);
  const comissaoCross = calcularComissaoCrossSelling(salario.receitaCross, salario.percentualCross);
  
  return comissaoReceita + comissaoCross + (salario.bonusFixo || 0) + (salario.bonusMeta || 0);
}

/**
 * Calcula o salário líquido
 * Líquido = Bruto - IRRF - Adiantamentos - Descontos
 */
export function calcularSalarioLiquido(salario: Salario): number {
  const bruto = calcularSalarioBruto(salario);
  return bruto - (salario.irrf || 0) - (salario.adiantamentos || 0) - (salario.descontos || 0);
}

/**
 * Calcula todos os componentes do salário
 */
export function calcularSalarioCompleto(salario: Salario): {
  comissaoReceita: number;
  comissaoCross: number;
  bonusTotal: number;
  bruto: number;
  deducoes: number;
  liquido: number;
} {
  const comissaoReceita = calcularComissaoReceita(salario.receitaTotal, salario.percentualComissao);
  const comissaoCross = calcularComissaoCrossSelling(salario.receitaCross, salario.percentualCross);
  const bonusTotal = (salario.bonusFixo || 0) + (salario.bonusMeta || 0);
  const bruto = comissaoReceita + comissaoCross + bonusTotal;
  const deducoes = (salario.irrf || 0) + (salario.adiantamentos || 0) + (salario.descontos || 0);
  const liquido = bruto - deducoes;
  
  return {
    comissaoReceita,
    comissaoCross,
    bonusTotal,
    bruto,
    deducoes,
    liquido,
  };
}

// ============== CÁLCULOS SALÁRIO POR CLASSES ==============

export interface ClasseCalculo {
  classe: string;
  receita: number;
  repassePercent: number;
  majoracaoPercent: number;
  repasseValue: number;
  majoracaoValue: number;
  brutoClasse: number;
}

/**
 * Calcula valores de uma classe de salário
 */
export function calcularClasseSalario(classe: SalarioClasse): ClasseCalculo {
  const repasseValue = classe.receita * classe.repassePercent;
  const majoracaoValue = classe.receita * classe.majoracaoPercent;
  const brutoClasse = repasseValue + majoracaoValue;
  
  return {
    classe: classe.classe,
    receita: classe.receita,
    repassePercent: classe.repassePercent,
    majoracaoPercent: classe.majoracaoPercent,
    repasseValue,
    majoracaoValue,
    brutoClasse,
  };
}

export interface SalarioCompletoV2 {
  classesCalc: ClasseCalculo[];
  receitaTotalClasses: number;
  repasseTotalClasses: number;
  majoracaoTotalClasses: number;
  brutoClasses: number;
  premiacao: number;
  ajuste: number;
  salarioBruto: number;
  irPercent: number;
  irValue: number;
  salarioLiquido: number;
  // Legado (Cross)
  comissaoCross: number;
}

/**
 * Calcula salário completo usando o modelo por classes
 * IR aplica sobre bruto total (repasse + majoração + cross + premiação + ajuste)
 */
export function calcularSalarioCompletoV2(salario: Salario): SalarioCompletoV2 {
  const classes = salario.classes || [];
  const classesCalc = classes.map(calcularClasseSalario);
  
  const receitaTotalClasses = classesCalc.reduce((s, c) => s + c.receita, 0);
  const repasseTotalClasses = classesCalc.reduce((s, c) => s + c.repasseValue, 0);
  const majoracaoTotalClasses = classesCalc.reduce((s, c) => s + c.majoracaoValue, 0);
  const brutoClasses = repasseTotalClasses + majoracaoTotalClasses;
  
  // Cross (legado)
  const comissaoCross = calcularComissaoCrossSelling(salario.receitaCross, salario.percentualCross);
  
  const premiacao = salario.premiacao || 0;
  const ajuste = salario.ajuste || 0;
  
  const salarioBruto = brutoClasses + comissaoCross + premiacao + ajuste;
  const irPercent = salario.irPercent || 0;
  const irValue = salarioBruto * irPercent;
  const salarioLiquido = salarioBruto - irValue;
  
  return {
    classesCalc,
    receitaTotalClasses,
    repasseTotalClasses,
    majoracaoTotalClasses,
    brutoClasses,
    premiacao,
    ajuste,
    salarioBruto,
    irPercent,
    irValue,
    salarioLiquido,
    comissaoCross,
  };
}

/**
 * Classes padrão para mapeamento de Custódia x Receita e Ofertas/Ativos
 */
export const CLASSES_SALARIO = [
  { id: 'rv', label: 'Renda Variável', campoFonte: 'receitaRV' },
  { id: 'rf', label: 'Renda Fixa', campoFonte: 'receitaRF' },
  { id: 'coe', label: 'COE', campoFonte: 'receitaCOE' },
  { id: 'fundos', label: 'Fundos', campoFonte: 'receitaFundos' },
  { id: 'previdencia', label: 'Previdência', campoFonte: 'receitaPrevidencia' },
  { id: 'internacional', label: 'Internacional', campoFonte: 'receitaInternacional' },
  { id: 'outros', label: 'Outros', campoFonte: 'receitaOutros' },
] as const;

/**
 * Mapeia receitas de Custódia x Receita para classes de salário
 * Agrega todos os registros do mês
 */
export function mapearCustodiaParaClasses(
  registros: CustodiaReceita[],
  classesExistentes?: SalarioClasse[]
): SalarioClasse[] {
  // Agregar receitas por campo
  const agregado: Record<string, number> = {};
  
  for (const reg of registros) {
    agregado.receitaRV = (agregado.receitaRV || 0) + (reg.receitaRV || 0);
    agregado.receitaRF = (agregado.receitaRF || 0) + (reg.receitaRF || 0);
    agregado.receitaCOE = (agregado.receitaCOE || 0) + (reg.receitaCOE || 0);
    agregado.receitaFundos = (agregado.receitaFundos || 0) + (reg.receitaFundos || 0);
    agregado.receitaPrevidencia = (agregado.receitaPrevidencia || 0) + (reg.receitaPrevidencia || 0);
    agregado.receitaOutros = (agregado.receitaOutros || 0) + (reg.receitaOutros || 0);
  }
  
  // Criar classes preservando percentuais existentes
  return CLASSES_SALARIO.map(def => {
    const existente = classesExistentes?.find(c => c.classe === def.id);
    return {
      classe: def.id,
      receita: agregado[def.campoFonte] || 0,
      repassePercent: existente?.repassePercent ?? 0.25, // Default 25%
      majoracaoPercent: existente?.majoracaoPercent ?? 0,
    };
  });
}

/**
 * Normaliza percentual: se > 1, assume que foi digitado como inteiro (ex: 25 -> 0.25)
 */
export function normalizarPercentual(valor: number): number {
  if (valor > 1) {
    return valor / 100;
  }
  return valor;
}

// ============== CÁLCULOS DE PLANO/METAS ==============

/**
 * Calcula meta de receita total do plano
 */
export function calcularMetaReceitaTotal(plano: PlanoReceitas): number {
  return (
    (plano.metaReceitaRV || 0) +
    (plano.metaReceitaRF || 0) +
    (plano.metaReceitaCOE || 0) +
    (plano.metaReceitaFundos || 0) +
    (plano.metaReceitaPrevidencia || 0) +
    (plano.metaReceitaOutros || 0)
  );
}

/**
 * Compara plano com realizado
 */
export function compararPlanoRealizado(
  plano: PlanoReceitas,
  custodia: number,
  captacao: number,
  receita: number,
  cross: number
): {
  custodia: { meta: number; realizado: number; gap: number; atingimento: number };
  captacao: { meta: number; realizado: number; gap: number; atingimento: number };
  receita: { meta: number; realizado: number; gap: number; atingimento: number };
  cross: { meta: number; realizado: number; gap: number; atingimento: number };
} {
  return {
    custodia: {
      meta: plano.metaCustodia,
      realizado: custodia,
      gap: calcularGAP(plano.metaCustodia, custodia),
      atingimento: calcularAtingimento(plano.metaCustodia, custodia),
    },
    captacao: {
      meta: plano.metaCaptacao,
      realizado: captacao,
      gap: calcularGAP(plano.metaCaptacao, captacao),
      atingimento: calcularAtingimento(plano.metaCaptacao, captacao),
    },
    receita: {
      meta: calcularMetaReceitaTotal(plano),
      realizado: receita,
      gap: calcularGAP(calcularMetaReceitaTotal(plano), receita),
      atingimento: calcularAtingimento(calcularMetaReceitaTotal(plano), receita),
    },
    cross: {
      meta: plano.metaCross,
      realizado: cross,
      gap: calcularGAP(plano.metaCross, cross),
      atingimento: calcularAtingimento(plano.metaCross, cross),
    },
  };
}

// ============== AGREGAÇÕES POR PERÍODO ==============

/**
 * Filtra registros por mês/ano
 */
export function filtrarPorPeriodo<T extends { mes: number; ano: number }>(
  registros: T[],
  mes?: number,
  ano?: number
): T[] {
  return registros.filter(r => {
    if (mes !== undefined && r.mes !== mes) return false;
    if (ano !== undefined && r.ano !== ano) return false;
    return true;
  });
}

/**
 * Agrupa registros por mês/ano
 */
export function agruparPorPeriodo<T extends { mes: number; ano: number }>(
  registros: T[]
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  
  registros.forEach(r => {
    const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(r);
  });
  
  return result;
}

/**
 * Gera lista de meses/anos disponíveis
 */
export function gerarPeriodosDisponiveis(
  anoInicio: number = new Date().getFullYear(),
  anoFim: number = new Date().getFullYear()
): { mes: number; ano: number; label: string }[] {
  const periodos: { mes: number; ano: number; label: string }[] = [];
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      periodos.push({
        mes,
        ano,
        label: `${meses[mes - 1]}/${ano}`,
      });
    }
  }
  
  return periodos;
}

/**
 * Retorna o nome do mês
 */
export function getNomeMes(mes: number): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return meses[mes - 1] || '';
}

// ============== PLANO DE RECEITAS - AUTO-PREENCHIMENTO ==============

export interface RealizadoData {
  realizadoCustodia: number;
  realizadoCaptacao: number;
  realizadoReceitaRV: number;
  realizadoReceitaRF: number;
  realizadoReceitaCOE: number;
  realizadoReceitaFundos: number;
  realizadoReceitaPrevidencia: number;
  realizadoReceitaOutros: number;
  realizadoReceitaTotal: number;
  realizadoCross: number;
}

/**
 * Agrega dados de Custódia x Receita para um mês/ano específico
 * Retorna os valores realizados de custódia e receitas por categoria
 */
export function agregarCustodiaReceitaMensal(
  registros: CustodiaReceita[],
  mes: number,
  ano: number
): Omit<RealizadoData, 'realizadoCaptacao' | 'realizadoCross'> {
  const registrosMes = registros.filter(r => r.mes === mes && r.ano === ano);
  
  const receitaRV = registrosMes.reduce((s, r) => s + (r.receitaRV || 0), 0);
  const receitaRF = registrosMes.reduce((s, r) => s + (r.receitaRF || 0), 0);
  const receitaCOE = registrosMes.reduce((s, r) => s + (r.receitaCOE || 0), 0);
  const receitaFundos = registrosMes.reduce((s, r) => s + (r.receitaFundos || 0), 0);
  const receitaPrevidencia = registrosMes.reduce((s, r) => s + (r.receitaPrevidencia || 0), 0);
  const receitaOutros = registrosMes.reduce((s, r) => s + (r.receitaOutros || 0), 0);
  
  // Custódia final: soma de custodiaFim de todos os registros (= custódia total)
  const custodiaFim = registrosMes.reduce((s, r) => s + (r.custodiaFim || 0), 0);
  
  const receitaTotal = receitaRV + receitaRF + receitaCOE + receitaFundos + receitaPrevidencia + receitaOutros;
  
  return {
    realizadoCustodia: custodiaFim,
    realizadoReceitaRV: receitaRV,
    realizadoReceitaRF: receitaRF,
    realizadoReceitaCOE: receitaCOE,
    realizadoReceitaFundos: receitaFundos,
    realizadoReceitaPrevidencia: receitaPrevidencia,
    realizadoReceitaOutros: receitaOutros,
    realizadoReceitaTotal: receitaTotal,
  };
}

/**
 * Agrega captação líquida para um mês/ano específico
 * Entradas - Saídas = Captação Líquida (pode ser negativo)
 */
export function agregarCaptacaoMensal(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number
): number {
  const lancamentosMes = lancamentos.filter(l => l.mes === mes && l.ano === ano);
  
  return lancamentosMes.reduce((total, l) => {
    if (l.direcao === 'entrada') {
      return total + l.valor;
    } else {
      return total - l.valor;
    }
  }, 0);
}

/**
 * Agrega Cross Selling realizado para um mês/ano específico
 */
export function agregarCrossMensal(
  crosses: Cross[],
  mes: number,
  ano: number
): number {
  const crossesMes = crosses.filter(c => {
    // Primeiro tentar usar mes/ano diretamente se disponível
    if (c.mes && c.ano) {
      return c.mes === mes && c.ano === ano;
    }
    // Fallback: usar dataVenda
    if (!c.dataVenda) return false;
    const data = new Date(c.dataVenda);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
  });
  
  return crossesMes.reduce((s, c) => s + (c.realizedValue || 0), 0);
}

/**
 * Gera todos os dados realizados para um mês/ano
 * Agrega Custódia x Receita, Captações e Cross Selling
 */
export function gerarRealizadoMensal(
  custodiaReceita: CustodiaReceita[],
  captacoes: CaptacaoLancamento[],
  crosses: Cross[],
  mes: number,
  ano: number
): RealizadoData {
  const custodiaData = agregarCustodiaReceitaMensal(custodiaReceita, mes, ano);
  const captacaoLiquida = agregarCaptacaoMensal(captacoes, mes, ano);
  const crossRealizado = agregarCrossMensal(crosses, mes, ano);
  
  return {
    ...custodiaData,
    realizadoCaptacao: captacaoLiquida,
    realizadoCross: crossRealizado,
  };
}

/**
 * Calcula a receita realizada total de um plano
 */
export function calcularReceitaRealizadaTotal(plano: PlanoReceitas): number {
  return (
    (plano.realizadoReceitaRV || 0) +
    (plano.realizadoReceitaRF || 0) +
    (plano.realizadoReceitaCOE || 0) +
    (plano.realizadoReceitaFundos || 0) +
    (plano.realizadoReceitaPrevidencia || 0) +
    (plano.realizadoReceitaOutros || 0)
  );
}

// ============== CÁLCULOS PARA METAS MENSAIS ==============

export interface MonthlyActuals {
  receita: number;
  captacaoLiquida: number;
  transferenciaXp: number;
}

type CaptacaoKpiCategory = 'CAPTACAO_LIQUIDA' | 'TRANSFERENCIA_XP';

interface CaptacaoLancamentoRuntimeShape {
  category?: string;
  type?: string;
  amount?: number | null;
  status?: string;
  cancelled?: boolean;
  voided?: boolean;
  deletedAt?: string | null;
}

function normalizeCaptacaoCategory(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function resolveCaptacaoCategory(lancamento: CaptacaoLancamento): string {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  return normalizeCaptacaoCategory(runtime.category ?? runtime.type ?? lancamento.tipo);
}

function isValidCaptacaoLancamento(lancamento: CaptacaoLancamento): boolean {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  if (runtime.cancelled || runtime.voided || Boolean(runtime.deletedAt)) return false;
  const status = normalizeCaptacaoCategory(runtime.status);
  if (status === 'CANCELADA' || status === 'CANCELADO' || status === 'CANCELLED' || status === 'VOIDED' || status === 'DELETED') {
    return false;
  }
  return true;
}

function getCaptacaoBaseMensal(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number,
): CaptacaoLancamento[] {
  return lancamentos.filter((lancamento) => {
    return lancamento.mes === mes && lancamento.ano === ano && isValidCaptacaoLancamento(lancamento);
  });
}

function getSignedCaptacaoAmount(lancamento: CaptacaoLancamento): number {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  const amount = typeof runtime.amount === 'number' ? runtime.amount : lancamento.valor;
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  return lancamento.direcao === 'entrada' ? normalizedAmount : -normalizedAmount;
}

function sumCaptacaoByCategory(
  lancamentos: CaptacaoLancamento[],
  category: CaptacaoKpiCategory,
): number {
  return lancamentos
    .filter((lancamento) => resolveCaptacaoCategory(lancamento) === category)
    .reduce((sum, lancamento) => sum + getSignedCaptacaoAmount(lancamento), 0);
}

/**
 * Calcula o realizado de captação líquida (entradas - saídas) para o mês
 * Suporta valores negativos (resgates maiores que entradas)
 */
export function calcularCaptacaoLiquidaMensal(lancamentos: CaptacaoLancamento[], mes: number, ano: number): number {
  const base = getCaptacaoBaseMensal(lancamentos, mes, ano);
  return sumCaptacaoByCategory(base, 'CAPTACAO_LIQUIDA');
}

/**
 * Calcula o realizado de transferência XP (saldo líquido) para o mês
 */
export function calcularTransferenciaXpMensal(lancamentos: CaptacaoLancamento[], mes: number, ano: number): number {
  const base = getCaptacaoBaseMensal(lancamentos, mes, ano);
  return sumCaptacaoByCategory(base, 'TRANSFERENCIA_XP');
}

/**
 * Calcula todos os realizados do mês para comparar com metas
 * Receita inclui: Custódia x Receita + Ofertas/Ativos + Cross Selling
 */
export function calcularRealizadosMensal(
  custodiaReceita: CustodiaReceita[],
  captacoes: CaptacaoLancamento[],
  mes: number,
  ano: number,
  ofertas: OfferReservation[] = [],
  crosses: Cross[] = []
): MonthlyActuals {
  // Receita Custódia: soma de todas as receitas do mês (Custódia x Receita)
  const receitaCustodia = custodiaReceita
    .filter(c => c.mes === mes && c.ano === ano)
    .reduce((sum, c) => sum + calcularReceitaRegistro(c), 0);

  // Receita Ofertas: soma de revenueHouse das ofertas liquidadas no mês
  const receitaOfertas = calcularOfertasReceitaMensal(ofertas, mes, ano);

  // Receita Cross: soma de realizedValue ou comissão das vendas concluídas no mês
  const receitaCross = calcularCrossRealizadoMensal(crosses, mes, ano);

  // Receita total = Custódia + Ofertas + Cross
  const receita = receitaCustodia + receitaOfertas + receitaCross;

  // Captação líquida: entradas - saídas (pode ser negativa)
  const captacaoLiquida = calcularCaptacaoLiquidaMensal(captacoes, mes, ano);

  // Transferência XP: subtipo específico
  const transferenciaXp = calcularTransferenciaXpMensal(captacoes, mes, ano);

  return {
    receita,
    captacaoLiquida,
    transferenciaXp,
  };
}

/**
 * Calcula o percentual atingido (protegido contra divisão por zero)
 * Retorna null se meta = 0 para indicar "não aplicável"
 */
export function calcularPercentAtingido(meta: number, realizado: number): number | null {
  if (meta === 0) return null;
  return (realizado / meta) * 100;
}

/**
 * Formata percentual de atingimento para exibição
 * Retorna "—" se não aplicável, caso contrário mostra o percentual
 */
export function formatPercentAtingido(percent: number | null): string {
  if (percent === null) return '—';
  return formatPercent(percent, 1);
}

// ============== MAPEAMENTO OFERTAS -> CLASSES SALÁRIO ==============

/**
 * Mapeamento de Classe do Ativo (Ofertas) para Classe de Salário
 * Agrupa as diferentes classes de ativos nas 7 classes do salário
 * CHAVES JÁ NORMALIZADAS (sem acentos, lowercase)
 */
const CLASSE_ATIVO_TO_SALARIO: Record<string, string> = {
  // Renda Variável
  'acoes / rv': 'rv',
  'acoes/rv': 'rv',
  // Renda Fixa
  'emissao bancaria': 'rf',
  'credito privado': 'rf',
  'oferta publica rf': 'rf',
  // COE
  'coe': 'coe',
  // Fundos
  'fundos secundarios': 'fundos',
  'fundos oferta publica': 'fundos',
  'fiis': 'fundos',
  // Previdência
  'previdencia': 'previdencia',
  // Internacional (classe separada)
  'internacional': 'internacional',
  // Outros (fallback)
  'outros': 'outros',
};

/**
 * Normaliza string para comparação (lowercase, sem acentos)
 */
function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapeia Classe do Ativo de uma Oferta para a Classe de Salário correspondente
 */
export function mapOfferAssetClassToSalaryClass(classeAtivo: string | undefined): string {
  const normalized = normalizeString(classeAtivo);
  return CLASSE_ATIVO_TO_SALARIO[normalized] || 'outros';
}

/**
 * Verifica se uma oferta está "efetuada" (considerada para receita do salário)
 */
export function isOfertaEfetuada(oferta: OfferReservation): boolean {
  return oferta.reservaEfetuada === true || oferta.reservaLiquidada === true;
}

/**
 * Filtra ofertas do mês/ano pela Data de Reserva e status Efetuada
 */
export function filtrarOfertasPorMesAno(
  ofertas: OfferReservation[],
  mes: number,
  ano: number
): OfferReservation[] {
  return ofertas.filter((o) => {
    // Verificar se está efetuada
    if (!isOfertaEfetuada(o)) return false;
    
    // Usar dataReserva como competência
    const dataRef = o.dataReserva;
    if (!dataRef) return false;
    
    const d = new Date(dataRef + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });
}

/**
 * Agrega receitas de Ofertas por Classe de Salário
 * Retorna um objeto com a receita total por classe (rv, rf, coe, fundos, previdencia, internacional, outros)
 */
export function agregarOfertasPorClasseSalario(
  ofertas: OfferReservation[]
): Record<string, number> {
  const resultado: Record<string, number> = {
    rv: 0,
    rf: 0,
    coe: 0,
    fundos: 0,
    previdencia: 0,
    internacional: 0,
    outros: 0,
  };

  for (const oferta of ofertas) {
    const classeId = mapOfferAssetClassToSalaryClass(oferta.classeAtivo);
    const { revenueHouse } = calcOfferReservationTotals(oferta);
    const receita = Number.isFinite(revenueHouse) ? revenueHouse : 0;
    resultado[classeId] += receita;
  }

  return resultado;
}

/**
 * Mapeia Ofertas para array de SalarioClasse, preservando percentuais existentes
 */
export function mapearOfertasParaClasses(
  ofertas: OfferReservation[],
  classesExistentes?: SalarioClasse[]
): SalarioClasse[] {
  const agregado = agregarOfertasPorClasseSalario(ofertas);
  
  return CLASSES_SALARIO.map((def) => {
    const existente = classesExistentes?.find((c) => c.classe === def.id);
    return {
      classe: def.id,
      receita: agregado[def.id] || 0,
      repassePercent: existente?.repassePercent ?? 0.25, // Default 25%
      majoracaoPercent: existente?.majoracaoPercent ?? 0,
    };
  });
}

/**
 * Calcula receita total de Cross Concluídos do mês/ano
 * Usa dataVenda para determinar competência
 */
export function calcularReceitaCrossMensal(
  crosses: Cross[],
  mes: number,
  ano: number
): number {
  return crosses
    .filter((c) => {
      if (!isCrossConcluido(c.status)) return false;
      
      // Determinar mês/ano do cross
      if (c.mes && c.ano) {
        return c.mes === mes && c.ano === ano;
      }
      if (!c.dataVenda) return false;
      
      const d = new Date(c.dataVenda + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    })
    .reduce((sum, c) => {
      const comissao = c.comissao ?? 0;
      return sum + (Number.isFinite(comissao) ? comissao : 0);
    }, 0);
}
