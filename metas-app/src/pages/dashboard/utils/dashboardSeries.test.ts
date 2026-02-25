import { describe, expect, it } from 'vitest';
import type { CaptacaoLancamento } from '../../../domain/types';
import { buildEvolucaoSeries } from './dashboardSeries';

function lancamento(partial: Partial<CaptacaoLancamento>): CaptacaoLancamento {
  return {
    data: '2026-02-10',
    mes: 2,
    ano: 2026,
    direcao: 'entrada',
    tipo: 'captacao_liquida',
    origem: 'manual',
    valor: 0,
    ...partial,
  } as CaptacaoLancamento;
}

describe('dashboardSeries helpers', () => {
  it('builds daily accumulated series based on lancamento.data', () => {
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ data: '2026-02-01', tipo: 'captacao_liquida', direcao: 'entrada', valor: 100 }),
      lancamento({ data: '2026-02-03', tipo: 'resgate', direcao: 'saida', valor: 40 }),
      lancamento({ data: '2026-02-03', tipo: 'transferencia_xp', direcao: 'entrada', valor: 20 }),
      lancamento({ data: '2026-02-10', tipo: 'transferencia_xp', direcao: 'saida', valor: 5 }),
      lancamento({ data: '2026-01-31', mes: 2, ano: 2026, tipo: 'captacao_liquida', direcao: 'entrada', valor: 999 }),
    ];

    const series = buildEvolucaoSeries(lancamentos, 2, 2026);

    expect(series).toHaveLength(28);
    expect(series[0].dia).toBe(1);
    expect(series[0].captacaoLiquidaAcumulada).toBe(100);
    expect(series[0].transferenciaXpAcumulada).toBe(0);

    expect(series[2].dia).toBe(3);
    expect(series[2].captacaoLiquidaAcumulada).toBe(60);
    expect(series[2].transferenciaXpAcumulada).toBe(20);

    expect(series[9].dia).toBe(10);
    expect(series[9].transferenciaXpAcumulada).toBe(15);
  });

  it('keeps negative accumulated values when month has only saidas', () => {
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ data: '2026-02-02', tipo: 'resgate', direcao: 'saida', valor: 80 }),
      lancamento({ data: '2026-02-04', tipo: 'transferencia_xp', direcao: 'saida', valor: 30 }),
    ];

    const series = buildEvolucaoSeries(lancamentos, 2, 2026);

    expect(series[1].captacaoLiquidaAcumulada).toBe(-80);
    expect(series[3].transferenciaXpAcumulada).toBe(-30);
  });

  it('falls back to mes/ano when data is invalid', () => {
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ data: '', mes: 2, ano: 2026, tipo: 'captacao_liquida', direcao: 'entrada', valor: 50 }),
    ];

    const series = buildEvolucaoSeries(lancamentos, 2, 2026);

    expect(series[0].captacaoLiquida).toBe(50);
    expect(series[0].captacaoLiquidaAcumulada).toBe(50);
  });
});
