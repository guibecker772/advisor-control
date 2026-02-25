import { calcularCaptacaoLiquidaMensal, calcularTransferenciaXpMensal, getNomeMes } from '../../../domain/calculations';
import type { CaptacaoLancamento } from '../../../domain/types';

export interface DashboardMonthPoint {
  mes: number;
  ano: number;
  label: string;
}

export interface EvolucaoPatrimonialPoint extends DashboardMonthPoint {
  captacaoLiquida: number;
  transferenciaXp: number;
}

export function getLastMonths(count: number, mesAtual: number, anoAtual: number): DashboardMonthPoint[] {
  const safeCount = Math.max(1, count);
  const points: DashboardMonthPoint[] = [];

  for (let offset = safeCount - 1; offset >= 0; offset -= 1) {
    let mes = mesAtual - offset;
    let ano = anoAtual;

    while (mes <= 0) {
      mes += 12;
      ano -= 1;
    }

    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }

    const monthName = getNomeMes(mes);
    const shortMonth = monthName.slice(0, 3);
    const shortYear = String(ano).slice(-2);
    points.push({
      mes,
      ano,
      label: `${shortMonth}/${shortYear}`,
    });
  }

  return points;
}

export function buildEvolucaoSeries(
  lancamentos: CaptacaoLancamento[],
  months: DashboardMonthPoint[],
): EvolucaoPatrimonialPoint[] {
  return months.map((month) => ({
    ...month,
    captacaoLiquida: calcularCaptacaoLiquidaMensal(lancamentos, month.mes, month.ano),
    transferenciaXp: calcularTransferenciaXpMensal(lancamentos, month.mes, month.ano),
  }));
}

