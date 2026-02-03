/**
 * Módulo de Cálculos Centralizados
 * Replica todas as fórmulas da planilha Excel "Metas Profissionais"
 */

import type { CustodiaReceita, Cliente, Cross, Reserva, Salario, PlanoReceitas } from '../types';

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
