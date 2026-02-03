import { describe, it, expect } from 'vitest';
import {
  calcularCustodiaTotal,
  calcularCaptacaoLiquida,
  calcularReceitaRegistro,
  calcularROA,
  calcularROARegistro,
  calcularCustodiaMedia,
  calcularGAP,
  calcularGAPPercent,
  calcularAtingimento,
  calcularSalarioBruto,
  calcularSalarioLiquido,
  calcularSalarioCompleto,
  formatCurrency,
  formatPercent,
} from './index';

import type { Cliente, CustodiaReceita, Salario } from '../types';

describe('Cálculos de Custódia', () => {
  it('deve calcular custódia total corretamente', () => {
    const clientes: Partial<Cliente>[] = [
      { custodiaAtual: 100000 },
      { custodiaAtual: 250000 },
      { custodiaAtual: 50000 },
    ];
    expect(calcularCustodiaTotal(clientes as Cliente[])).toBe(400000);
  });

  it('deve retornar 0 para lista vazia', () => {
    expect(calcularCustodiaTotal([])).toBe(0);
  });

  it('deve calcular custódia média corretamente', () => {
    expect(calcularCustodiaMedia(100000, 120000)).toBe(110000);
    expect(calcularCustodiaMedia(0, 100000)).toBe(50000);
  });
});

describe('Cálculos de Captação', () => {
  it('deve calcular captação líquida corretamente', () => {
    expect(calcularCaptacaoLiquida(100000, 30000)).toBe(70000);
    expect(calcularCaptacaoLiquida(50000, 80000)).toBe(-30000); // Mais resgates
  });
});

describe('Cálculos de Receita', () => {
  it('deve calcular receita total de um registro', () => {
    const registro: Partial<CustodiaReceita> = {
      receitaRV: 1000,
      receitaRF: 500,
      receitaCOE: 200,
      receitaFundos: 300,
      receitaPrevidencia: 100,
      receitaOutros: 50,
    };
    expect(calcularReceitaRegistro(registro as CustodiaReceita)).toBe(2150);
  });

  it('deve retornar 0 para registro vazio', () => {
    expect(calcularReceitaRegistro({} as CustodiaReceita)).toBe(0);
  });
});

describe('Cálculos de ROA', () => {
  it('deve calcular ROA corretamente', () => {
    // ROA = (Receita / Custódia Média) * 100
    expect(calcularROA(1000, 100000)).toBe(1); // 1%
    expect(calcularROA(2000, 100000)).toBe(2); // 2%
  });

  it('deve retornar 0 quando custódia é 0 (evitar divisão por zero)', () => {
    expect(calcularROA(1000, 0)).toBe(0);
  });

  it('deve calcular ROA de registro completo', () => {
    const registro: CustodiaReceita = {
      mes: 1,
      ano: 2024,
      custodiaInicio: 100000,
      custodiaFim: 120000,
      captacaoBruta: 30000,
      resgate: 10000,
      receitaRV: 550,
      receitaRF: 300,
      receitaCOE: 100,
      receitaFundos: 50,
      receitaPrevidencia: 0,
      receitaOutros: 0,
    };
    // Custódia média = (100000 + 120000) / 2 = 110000
    // Receita total = 550 + 300 + 100 + 50 = 1000
    // ROA = (1000 / 110000) * 100 = 0.909...%
    const roa = calcularROARegistro(registro);
    expect(roa).toBeCloseTo(0.909, 2);
  });
});

describe('Cálculos de GAP', () => {
  it('deve calcular GAP absoluto corretamente', () => {
    expect(calcularGAP(100, 120)).toBe(20); // Acima da meta
    expect(calcularGAP(100, 80)).toBe(-20); // Abaixo da meta
    expect(calcularGAP(100, 100)).toBe(0); // Exato
  });

  it('deve calcular GAP percentual corretamente', () => {
    expect(calcularGAPPercent(100, 120)).toBe(20); // 20% acima
    expect(calcularGAPPercent(100, 80)).toBe(-20); // 20% abaixo
    expect(calcularGAPPercent(100, 100)).toBe(0);
  });

  it('deve tratar meta zero corretamente', () => {
    expect(calcularGAPPercent(0, 100)).toBe(100);
    expect(calcularGAPPercent(0, 0)).toBe(0);
  });

  it('deve calcular atingimento corretamente', () => {
    expect(calcularAtingimento(100, 120)).toBe(120); // 120%
    expect(calcularAtingimento(100, 80)).toBe(80); // 80%
    expect(calcularAtingimento(100, 100)).toBe(100); // 100%
  });
});

describe('Cálculos de Salário', () => {
  const salarioBase: Salario = {
    mes: 1,
    ano: 2024,
    receitaTotal: 10000,
    receitaCross: 2000,
    percentualComissao: 30,
    percentualCross: 50,
    bonusFixo: 500,
    bonusMeta: 300,
    adiantamentos: 200,
    descontos: 100,
    irrf: 400,
  };

  it('deve calcular salário bruto corretamente', () => {
    // Comissão Receita = 10000 * 0.30 = 3000
    // Comissão Cross = 2000 * 0.50 = 1000
    // Bônus = 500 + 300 = 800
    // Bruto = 3000 + 1000 + 800 = 4800
    expect(calcularSalarioBruto(salarioBase)).toBe(4800);
  });

  it('deve calcular salário líquido corretamente', () => {
    // Bruto = 4800
    // Deduções = 400 + 200 + 100 = 700
    // Líquido = 4800 - 700 = 4100
    expect(calcularSalarioLiquido(salarioBase)).toBe(4100);
  });

  it('deve calcular salário completo', () => {
    const resultado = calcularSalarioCompleto(salarioBase);
    
    expect(resultado.comissaoReceita).toBe(3000);
    expect(resultado.comissaoCross).toBe(1000);
    expect(resultado.bonusTotal).toBe(800);
    expect(resultado.bruto).toBe(4800);
    expect(resultado.deducoes).toBe(700);
    expect(resultado.liquido).toBe(4100);
  });
});

describe('Formatação', () => {
  it('deve formatar moeda em BRL', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    expect(formatCurrency(1000000)).toBe('R$ 1.000.000,00');
  });

  it('deve formatar percentual', () => {
    expect(formatPercent(25)).toBe('25,00%');
    expect(formatPercent(12.345, 1)).toBe('12,3%');
  });
});
