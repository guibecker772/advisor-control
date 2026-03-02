import type { CaptacaoLancamento } from '../../../domain/types';
import {
  buildCaptacaoEvolucaoSeries,
  type CaptacaoPeriodoSeriesPoint,
} from '../../../domain/calculations/captacaoPeriodo';

export type EvolucaoPatrimonialPoint = CaptacaoPeriodoSeriesPoint;

export function buildEvolucaoSeries(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number,
): EvolucaoPatrimonialPoint[] {
  return buildCaptacaoEvolucaoSeries(lancamentos, mes, ano);
}
