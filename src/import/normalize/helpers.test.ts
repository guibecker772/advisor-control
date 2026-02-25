import { describe, expect, it } from 'vitest';
import { normalizeImportedClientRow } from './clientImportRow';
import {
  normalizeAccountNumber,
  parseBooleanSimNao,
  parseBRNumber,
  parsePercentCDI,
} from './helpers';
import type { ClientImportColumnMapping } from '../types';

describe('import normalize helpers', () => {
  it('normaliza accountNumber removendo caracteres nao numericos', () => {
    expect(normalizeAccountNumber(' 12.34-5/6 ')).toBe('123456');
  });

  it('faz parse de numeros BR e EN', () => {
    expect(parseBRNumber('1.234.567,89')).toBeCloseTo(1234567.89, 2);
    expect(parseBRNumber('1234567.89')).toBeCloseTo(1234567.89, 2);
  });

  it('faz parse de % CDI multiplicando por 100', () => {
    expect(parsePercentCDI('1,674')).toBeCloseTo(167.4, 4);
    expect(parsePercentCDI('0.8083')).toBeCloseTo(80.83, 4);
    expect(parsePercentCDI('-0,5')).toBeCloseTo(-50, 4);
  });

  it('faz parse de boolean Sim/Nao', () => {
    expect(parseBooleanSimNao('Sim')).toBe(true);
    expect(parseBooleanSimNao('não')).toBe(false);
    expect(parseBooleanSimNao('NA')).toBeNull();
  });

  it('regra de aniversario year>=2000 salva apenas dia/mes', () => {
    const mapping: ClientImportColumnMapping = {
      Nome: 'nome',
      Aniversario: 'birthday',
    };

    const row = normalizeImportedClientRow(
      {
        Nome: 'Cliente Teste',
        Aniversario: '10/05/2023',
      },
      2,
      mapping,
    );

    expect(row.payload.birthDay).toBe(10);
    expect(row.payload.birthMonth).toBe(5);
    expect(row.payload.birthDate).toBeUndefined();
  });
});
