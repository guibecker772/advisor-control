import { describe, expect, it } from 'vitest';
import type { CaptacaoLancamento } from '../types';
import { getCaptacaoResumoPeriodo } from './captacaoPeriodo';

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

describe('getCaptacaoResumoPeriodo', () => {
  it('agrega entradas/saidas por data no periodo com fallback para mes/ano', () => {
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ data: '2026-02-01', tipo: 'captacao_liquida', direcao: 'entrada', valor: 100 }),
      lancamento({ data: '2026-02-02', tipo: 'resgate', direcao: 'Saída' as CaptacaoLancamento['direcao'], valor: 40 }),
      lancamento({ data: '2026-02-03', tipo: 'transferencia_xp', direcao: 'Saida' as CaptacaoLancamento['direcao'], valor: 10 }),
      // Deve ser ignorado: data aponta para janeiro, mesmo com mes/ano preenchidos para fevereiro.
      lancamento({ data: '2026-01-31', mes: 2, ano: 2026, tipo: 'captacao_liquida', direcao: 'entrada', valor: 999 }),
      // Deve entrar via fallback de mes/ano quando data invalida.
      lancamento({ data: '', mes: 2, ano: 2026, tipo: 'captacao_liquida', direcao: 'entrada', valor: 50 }),
    ];

    const resumo = getCaptacaoResumoPeriodo(lancamentos, 2, 2026);

    expect(resumo.entradas).toBe(150);
    expect(resumo.saidas).toBe(50);
    expect(resumo.captacaoLiquida).toBe(110);
    expect(resumo.transferenciaXp).toBe(-10);
    expect(resumo.lancamentosPeriodo).toHaveLength(4);
    expect(resumo.seriesEvolucao).toHaveLength(28);
  });

  it('mantem serie quando o mes possui apenas saidas', () => {
    const lancamentos: CaptacaoLancamento[] = [
      lancamento({ data: '2026-02-05', tipo: 'resgate', direcao: 'saida', valor: 80 }),
    ];

    const resumo = getCaptacaoResumoPeriodo(lancamentos, 2, 2026);

    expect(resumo.entradas).toBe(0);
    expect(resumo.saidas).toBe(80);
    expect(resumo.captacaoLiquida).toBe(-80);
    expect(resumo.seriesEvolucao.some((item) => item.captacaoLiquida !== 0 || item.transferenciaXp !== 0)).toBe(true);
  });
});
