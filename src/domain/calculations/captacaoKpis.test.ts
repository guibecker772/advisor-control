import { describe, expect, it } from 'vitest';
import type { CaptacaoLancamento } from '../types';
import {
  calcularCaptacaoLiquidaMensal,
  calcularTransferenciaXpMensal,
} from './index';

describe('captacao KPI aggregation', () => {
  it('separates captacao liquida and transferencia XP by exact category', () => {
    const lancamentos = [
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 300000 },
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 300000 },
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'transferencia_xp', valor: 250000 },
    ] as unknown as CaptacaoLancamento[];

    expect(calcularCaptacaoLiquidaMensal(lancamentos, 2, 2026)).toBe(600000);
    expect(calcularTransferenciaXpMensal(lancamentos, 2, 2026)).toBe(250000);
  });

  it('uses the same month validity base and keeps signed amounts', () => {
    const lancamentos = [
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 100 },
      { mes: 2, ano: 2026, direcao: 'saida', tipo: 'captacao_liquida', valor: 25 },
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'transferencia_xp', valor: 80 },
      { mes: 2, ano: 2026, direcao: 'saida', tipo: 'transferencia_xp', valor: 20 },
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 999, status: 'cancelado' },
      { mes: 2, ano: 2026, direcao: 'entrada', tipo: 'transferencia_xp', valor: 777, voided: true },
      { mes: 1, ano: 2026, direcao: 'entrada', tipo: 'captacao_liquida', valor: 5000 },
    ] as unknown as CaptacaoLancamento[];

    expect(calcularCaptacaoLiquidaMensal(lancamentos, 2, 2026)).toBe(75);
    expect(calcularTransferenciaXpMensal(lancamentos, 2, 2026)).toBe(60);
  });
});
