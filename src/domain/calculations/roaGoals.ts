/**
 * roaGoals.ts — Métricas estratégicas de ROA e Ritmo de Meta.
 *
 * Separação conceitual:
 *   - Métrica TÉCNICA: ROA mensal / ROA anual acumulado (receita ÷ custódia)
 *   - Métrica ESTRATÉGICA: Ritmo de Meta (receita ÷ meta mensal esperada)
 *
 * Todas as funções são puras (sem side-effects, sem queries).
 * Consumidas por Dashboard, Metas, Client360 e qualquer futuro módulo.
 *
 * Convenção de unidades:
 *   - `roaMetaAnual` é um decimal (0.01 = 1%)
 *   - Funções retornam decimais; formatação fica no componente chamador.
 */

// ============== GOAL CALCULATIONS ==============

/**
 * Calcula a meta de receita anual a partir da custódia e da meta de ROA anual.
 *
 * META_ANUAL = Custódia × ROA_META_ANUAL
 *
 * @param custodiaAtual Custódia total atual (ex: 36.000.000)
 * @param roaMetaAnual  Meta de ROA anual como decimal (ex: 0.01 = 1%)
 * @returns Meta de receita anual (ex: 360.000)
 */
export function calculateAnnualGoal(custodiaAtual: number, roaMetaAnual: number): number {
  return custodiaAtual * roaMetaAnual;
}

/**
 * Calcula a meta de receita mensal esperada (proporcional simples).
 *
 * META_MENSAL = META_ANUAL ÷ 12
 *
 * @param custodiaAtual Custódia total atual
 * @param roaMetaAnual  Meta de ROA anual como decimal
 * @returns Meta de receita mensal (ex: 30.000)
 */
export function calculateMonthlyGoal(custodiaAtual: number, roaMetaAnual: number): number {
  return calculateAnnualGoal(custodiaAtual, roaMetaAnual) / 12;
}

// ============== ROA CALCULATIONS ==============

/**
 * ROA Mensal Matemático — porcentagem pura.
 *
 * ROA_MENSAL = Receita do mês ÷ Custódia do mês
 *
 * Apenas informativo técnico: quanto de retorno a custódia gerou neste mês.
 * Retorna decimal (ex: 0.000833 para 0,083%).
 *
 * @param receitaMes    Receita realizada no mês (somente LIQUIDADA)
 * @param custodiaMes   Custódia usada como base (snapshot atual ou média do mês)
 * @returns ROA mensal como decimal (multiplicar por 100 para exibir em %)
 */
export function calculateMonthlyROA(receitaMes: number, custodiaMes: number): number {
  if (custodiaMes <= 0) return 0;
  return receitaMes / custodiaMes;
}

/**
 * ROA Anual Acumulado — convergente para a meta ao longo do ano.
 *
 * ROA_ANUAL = Receita acumulada no ano ÷ Custódia média do ano
 *
 * Deve convergir para `roaMetaAnual` ao final de 12 meses.
 * Retorna decimal (ex: 0.0072 para 0,72%).
 *
 * @param receitaAcumuladaAno  Soma de receita realizada de Jan até o mês atual
 * @param custodiaMediaAno     Custódia média do ano (ou snapshot se média não disponível)
 * @returns ROA anual acumulado como decimal
 */
export function calculateAnnualROA(receitaAcumuladaAno: number, custodiaMediaAno: number): number {
  if (custodiaMediaAno <= 0) return 0;
  return receitaAcumuladaAno / custodiaMediaAno;
}

// ============== GOAL PACE (RITMO DA META) ==============

/**
 * Ritmo da Meta — indicador estratégico principal.
 *
 * RITMO_META = Receita do mês ÷ Meta mensal esperada
 *
 * Se = 1.0 → 100% (no ritmo)
 * Se = 0.5 → 50%  (metade do esperado)
 * Se = 1.2 → 120% (acima da meta)
 *
 * @param receitaMes   Receita realizada no mês
 * @param metaMensal   Meta de receita mensal esperada (de `calculateMonthlyGoal`)
 * @returns Ritmo como decimal (1.0 = 100%). Retorna 0 se meta = 0.
 */
export function calculateGoalPace(receitaMes: number, metaMensal: number): number {
  if (metaMensal <= 0) return 0;
  return receitaMes / metaMensal;
}

// ============== PACE LEVEL (para indicador visual) ==============

export type GoalPaceLevel = 'above' | 'on-track' | 'below';

/**
 * Determina o nível visual do ritmo da meta.
 *
 * >= 100% → 'above'   (verde)
 * >= 80%  → 'on-track' (amarelo)
 * < 80%   → 'below'   (vermelho)
 */
export function getGoalPaceLevel(paceDecimal: number): GoalPaceLevel {
  if (paceDecimal >= 1.0) return 'above';
  if (paceDecimal >= 0.8) return 'on-track';
  return 'below';
}

/**
 * Retorna a cor CSS correspondente ao nível do ritmo.
 */
export function getGoalPaceColor(level: GoalPaceLevel): string {
  switch (level) {
    case 'above':
      return 'var(--color-success)';
    case 'on-track':
      return 'var(--color-warning)';
    case 'below':
      return 'var(--color-danger)';
  }
}

/**
 * Retorna o ícone emoji correspondente ao nível do ritmo.
 */
export function getGoalPaceEmoji(level: GoalPaceLevel): string {
  switch (level) {
    case 'above':
      return '🎯';
    case 'on-track':
      return '⚡';
    case 'below':
      return '⚠️';
  }
}

// ============== COMPOSITE HELPER ==============

export interface RoaGoalMetrics {
  /** Meta de receita anual derivada (custódia × ROA meta) */
  metaReceitaAnual: number;
  /** Meta de receita mensal esperada (anual ÷ 12) */
  metaReceitaMensal: number;
  /** ROA mensal matemático (decimal, ex: 0.000833) */
  roaMensal: number;
  /** ROA anual acumulado (decimal, ex: 0.0072) */
  roaAnual: number;
  /** Ritmo da meta mensal (decimal, 1.0 = 100%) */
  ritmoMeta: number;
  /** Nível visual do ritmo */
  ritmoLevel: GoalPaceLevel;
  /** Cor CSS para o nível */
  ritmoColor: string;
}

/**
 * Calcula todas as métricas de ROA e meta em uma única chamada.
 * Ideal para o Dashboard e componentes que precisam de todas as métricas juntas.
 *
 * @param custodiaMes           Custódia total no mês selecionado
 * @param receitaMes            Receita realizada (LIQUIDADA) no mês
 * @param receitaAcumuladaAno   Receita acumulada no ano (Jan..mês)
 * @param custodiaMediaAno      Custódia média do ano (ou snapshot)
 * @param roaMetaAnual          Meta de ROA anual como decimal (0.01 = 1%)
 */
export function calculateRoaGoalMetrics(
  custodiaMes: number,
  receitaMes: number,
  receitaAcumuladaAno: number,
  custodiaMediaAno: number,
  roaMetaAnual: number,
): RoaGoalMetrics {
  const metaReceitaAnual = calculateAnnualGoal(custodiaMes, roaMetaAnual);
  const metaReceitaMensal = calculateMonthlyGoal(custodiaMes, roaMetaAnual);
  const roaMensal = calculateMonthlyROA(receitaMes, custodiaMes);
  const roaAnual = calculateAnnualROA(receitaAcumuladaAno, custodiaMediaAno);
  const ritmoMeta = calculateGoalPace(receitaMes, metaReceitaMensal);
  const ritmoLevel = getGoalPaceLevel(ritmoMeta);
  const ritmoColor = getGoalPaceColor(ritmoLevel);

  return {
    metaReceitaAnual,
    metaReceitaMensal,
    roaMensal,
    roaAnual,
    ritmoMeta,
    ritmoLevel,
    ritmoColor,
  };
}
