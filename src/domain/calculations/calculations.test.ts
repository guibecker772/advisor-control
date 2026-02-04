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
  mapOfferAssetClassToSalaryClass,
  isOfertaEfetuada,
  filtrarOfertasPorMesAno,
  calcularReceitaCrossMensal,
  calcularSalarioCompletoV2,
  isCrossConcluido,
} from './index';

import type { Cliente, CustodiaReceita, Salario, OfferReservation, Cross } from '../types';

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
    // Novos campos obrigatórios
    classes: [],
    irPercent: 0,
    premiacao: 0,
    ajuste: 0,
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

describe('Mapeamento de Ofertas para Classes de Salário', () => {

  describe('mapOfferAssetClassToSalaryClass', () => {
    it('deve mapear classes de Renda Variável', () => {
      expect(mapOfferAssetClassToSalaryClass('Ações / RV')).toBe('rv');
      expect(mapOfferAssetClassToSalaryClass('ações/rv')).toBe('rv');
    });

    it('deve mapear Internacional como classe separada', () => {
      expect(mapOfferAssetClassToSalaryClass('Internacional')).toBe('internacional');
      expect(mapOfferAssetClassToSalaryClass('INTERNACIONAL')).toBe('internacional');
      expect(mapOfferAssetClassToSalaryClass('internacional')).toBe('internacional');
    });

    it('deve mapear classes de Renda Fixa', () => {
      expect(mapOfferAssetClassToSalaryClass('Emissão Bancária')).toBe('rf');
      expect(mapOfferAssetClassToSalaryClass('Crédito Privado')).toBe('rf');
      expect(mapOfferAssetClassToSalaryClass('Oferta Pública RF')).toBe('rf');
    });

    it('deve mapear COE', () => {
      expect(mapOfferAssetClassToSalaryClass('COE')).toBe('coe');
      expect(mapOfferAssetClassToSalaryClass('coe')).toBe('coe');
    });

    it('deve mapear classes de Fundos', () => {
      expect(mapOfferAssetClassToSalaryClass('Fundos Secundários')).toBe('fundos');
      expect(mapOfferAssetClassToSalaryClass('Fundos Oferta Pública')).toBe('fundos');
      expect(mapOfferAssetClassToSalaryClass('FIIs')).toBe('fundos');
    });

    it('deve mapear Previdência', () => {
      expect(mapOfferAssetClassToSalaryClass('Previdência')).toBe('previdencia');
      expect(mapOfferAssetClassToSalaryClass('previdencia')).toBe('previdencia');
    });

    it('deve mapear "Outros" e classes desconhecidas', () => {
      expect(mapOfferAssetClassToSalaryClass('Outros')).toBe('outros');
      expect(mapOfferAssetClassToSalaryClass('Classe Desconhecida')).toBe('outros');
      expect(mapOfferAssetClassToSalaryClass(undefined)).toBe('outros');
      expect(mapOfferAssetClassToSalaryClass('')).toBe('outros');
    });
  });

  describe('isOfertaEfetuada', () => {
    it('deve retornar true se reservaEfetuada é true', () => {
      expect(isOfertaEfetuada({ reservaEfetuada: true, reservaLiquidada: false } as unknown as OfferReservation)).toBe(true);
    });

    it('deve retornar true se reservaLiquidada é true', () => {
      expect(isOfertaEfetuada({ reservaEfetuada: false, reservaLiquidada: true } as unknown as OfferReservation)).toBe(true);
    });

    it('deve retornar false se ambos são false', () => {
      expect(isOfertaEfetuada({ reservaEfetuada: false, reservaLiquidada: false } as unknown as OfferReservation)).toBe(false);
    });
  });

  describe('filtrarOfertasPorMesAno', () => {
    const ofertas = [
      { dataReserva: '2024-01-15', reservaEfetuada: true, classeAtivo: 'COE' },
      { dataReserva: '2024-01-20', reservaEfetuada: false, classeAtivo: 'RF' },
      { dataReserva: '2024-02-10', reservaEfetuada: true, classeAtivo: 'RV' },
      { dataReserva: '2024-01-25', reservaLiquidada: true, classeAtivo: 'Fundos' },
    ] as unknown as OfferReservation[];

    it('deve filtrar por mês/ano e status efetuada', () => {
      const result = filtrarOfertasPorMesAno(ofertas, 1, 2024);
      expect(result).toHaveLength(2); // COE (efetuada) e Fundos (liquidada)
    });

    it('deve retornar vazio se não há ofertas no mês', () => {
      const result = filtrarOfertasPorMesAno(ofertas, 3, 2024);
      expect(result).toHaveLength(0);
    });
  });

  describe('isCrossConcluido', () => {
    it('deve reconhecer variações de "concluído"', () => {
      expect(isCrossConcluido('concluido')).toBe(true);
      expect(isCrossConcluido('Concluído')).toBe(true);
      expect(isCrossConcluido('CONCLUIDO')).toBe(true);
      expect(isCrossConcluido('completed')).toBe(true);
      expect(isCrossConcluido('done')).toBe(true);
    });

    it('deve rejeitar outros status', () => {
      expect(isCrossConcluido('pendente')).toBe(false);
      expect(isCrossConcluido('em andamento')).toBe(false);
      expect(isCrossConcluido('')).toBe(false);
      expect(isCrossConcluido(undefined)).toBe(false);
    });
  });

  describe('calcularReceitaCrossMensal', () => {
    const crosses = [
      { status: 'Concluído', dataVenda: '2024-01-10', comissao: 1000 },
      { status: 'pendente', dataVenda: '2024-01-15', comissao: 500 },
      { status: 'concluido', dataVenda: '2024-02-05', comissao: 800 },
      { status: 'concluido', mes: 1, ano: 2024, comissao: 1200 },
    ] as unknown as Cross[];

    it('deve somar comissões de cross concluídos do mês', () => {
      const result = calcularReceitaCrossMensal(crosses, 1, 2024);
      expect(result).toBe(2200); // 1000 + 1200 (pendente excluído)
    });

    it('deve retornar 0 se não há cross concluídos no mês', () => {
      const result = calcularReceitaCrossMensal(crosses, 3, 2024);
      expect(result).toBe(0);
    });
  });
});

describe('Teste de Regressão: Receita Total não inclui Cross', () => {
  it('receitaTotalClasses deve ser apenas a soma das classes, sem incluir Cross', () => {
    // Cenário: Ofertas = 8000, Cross comissão = 4000, %Cross = 50
    const salario = {
      mes: 1,
      ano: 2024,
      classes: [
        { classe: 'rv', receita: 3000, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'rf', receita: 2000, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'coe', receita: 1000, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'fundos', receita: 1000, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'previdencia', receita: 500, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'internacional', receita: 500, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'outros', receita: 0, repassePercent: 0.25, majoracaoPercent: 0 },
      ],
      receitaCross: 4000,
      percentualCross: 50,
      irPercent: 0,
      premiacao: 0,
      ajuste: 0,
    };

    const calc = calcularSalarioCompletoV2(salario as any);
    
    // Receita Total = soma das classes = 8000 (NÃO deve incluir Cross)
    expect(calc.receitaTotalClasses).toBe(8000);
    
    // Cross = 4000 * 50% = 2000
    expect(calc.comissaoCross).toBe(2000);
    
    // Bruto Classes = soma de repasse + majoração = 8000 * 0.25 = 2000
    expect(calc.brutoClasses).toBe(2000);
    
    // Bruto Total = brutoClasses + comissaoCross + premiacao + ajuste = 2000 + 2000 = 4000
    expect(calc.salarioBruto).toBe(4000);
  });

  it('receitaTotalClasses não deve mudar quando Cross é alterado', () => {
    const salarioBase = {
      mes: 1,
      ano: 2024,
      classes: [
        { classe: 'rv', receita: 5000, repassePercent: 0.25, majoracaoPercent: 0 },
        { classe: 'internacional', receita: 3000, repassePercent: 0.25, majoracaoPercent: 0 },
      ],
      receitaCross: 0,
      percentualCross: 50,
      irPercent: 0,
      premiacao: 0,
      ajuste: 0,
    };

    const calcSemCross = calcularSalarioCompletoV2(salarioBase as any);
    expect(calcSemCross.receitaTotalClasses).toBe(8000);
    expect(calcSemCross.comissaoCross).toBe(0);

    // Adicionando Cross não deve alterar receitaTotalClasses
    const salarioComCross = { ...salarioBase, receitaCross: 10000 };
    const calcComCross = calcularSalarioCompletoV2(salarioComCross as any);
    expect(calcComCross.receitaTotalClasses).toBe(8000); // Continua 8000
    expect(calcComCross.comissaoCross).toBe(5000); // 10000 * 50%
  });
});
