import { describe, expect, it } from 'vitest';
import type { CaptacaoLancamento } from '../../../domain/types';
import { buildEvolucaoSeries, getLastMonths } from './dashboardSeries';

function lancamento(partial: Partial<CaptacaoLancamento>): CaptacaoLancamento {
  return {
    data: '2026-01-10',
    mes: 1,
    ano: 2026,
    direcao: 'entrada',
    tipo: 'captacao_liquida',
    origem: 'manual',
    valor: 0,
    ...partial,
  } as CaptacaoLancamento;
}

describe('dashboardSeries helpers', () => {
  it('builds last months including current month with year rollover', () => {
    const months = getLastMonths(3, 1, 2026);

    expect(months).toHaveLength(3);
    expect(months.map((item) => `${item.mes}/${item.ano}`)).toEqual([
      '11/2025',
      '12/2025',
      '1/2026',
    ]);
  });

  it('builds monthly series for captacao liquida and transferencia XP', () => {
    const months = getLastMonths(2, 2, 2026);
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ mes: 1, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 100 }),
      lancamento({ mes: 1, ano: 2026, direcao: 'saida', tipo: 'captacao_liquida', valor: 30 }),
      lancamento({ mes: 1, ano: 2026, direcao: 'entrada', tipo: 'transferencia_xp', valor: 40 }),
      lancamento({ mes: 1, ano: 2026, direcao: 'saida', tipo: 'transferencia_xp', valor: 10 }),
      lancamento({ mes: 2, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 200 }),
      lancamento({ mes: 2, ano: 2026, direcao: 'saida', tipo: 'transferencia_xp', valor: 50 }),
    ];

    const series = buildEvolucaoSeries(lancamentos, months);

    expect(series).toHaveLength(2);
    expect(series[0].mes).toBe(1);
    expect(series[0].captacaoLiquida).toBe(70);
    expect(series[0].transferenciaXp).toBe(30);

    expect(series[1].mes).toBe(2);
    expect(series[1].captacaoLiquida).toBe(200);
    expect(series[1].transferenciaXp).toBe(-50);
  });
});
