import { describe, expect, it } from 'vitest';
import {
  filterClientSelectOptions,
  getNextEnabledOptionIndex,
} from './clientSelectUtils';

type ClientSelectOption = {
  value: string;
  label: string;
  hint?: string;
  searchText?: string;
  disabled?: boolean;
};

const OPTIONS: ClientSelectOption[] = [
  {
    value: '1',
    label: 'João Silva',
    hint: '123.456.789-00 | CTA-001',
    searchText: 'Joao Silva 12345678900 CTA001',
  },
  {
    value: '2',
    label: 'Empresa Águia',
    hint: '12.345.678/0001-90 | CNPJ-77',
    searchText: 'Empresa Aguia 12345678000190 CNPJ77',
  },
  {
    value: '3',
    label: 'Cliente Desabilitado',
    disabled: true,
  },
];

describe('ClientSelect helpers', () => {
  it('filters by normalized text (lowercase + sem acento)', () => {
    const result = filterClientSelectOptions(OPTIONS, 'joao');
    expect(result.map((item) => item.value)).toEqual(['1']);

    const resultAcento = filterClientSelectOptions(OPTIONS, 'aguia');
    expect(resultAcento.map((item) => item.value)).toEqual(['2']);
  });

  it('filters by CPF/CNPJ digits (com ou sem mascara)', () => {
    const cpf = filterClientSelectOptions(OPTIONS, '12345678900');
    expect(cpf.map((item) => item.value)).toEqual(['1']);

    const cnpjMasked = filterClientSelectOptions(OPTIONS, '12.345.678/0001-90');
    expect(cnpjMasked.map((item) => item.value)).toEqual(['2']);
  });

  it('filters by codigo quando presente no searchText', () => {
    const byCodigo = filterClientSelectOptions(OPTIONS, 'cta001');
    expect(byCodigo.map((item) => item.value)).toEqual(['1']);
  });

  it('returns next enabled option index for keyboard navigation', () => {
    const nextDown = getNextEnabledOptionIndex(OPTIONS, 1, 1);
    expect(nextDown).toBe(0);

    const nextUp = getNextEnabledOptionIndex(OPTIONS, 0, -1);
    expect(nextUp).toBe(1);
  });
});
