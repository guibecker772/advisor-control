import { describe, expect, it } from 'vitest';
import {
  deriveLegacyReservationFlags,
  isLiquidated,
  normalizeCompetenceMonth,
  normalizeOfferAssetClass,
  normalizeOfferAudience,
  normalizeOfferStatus,
} from './offers';

describe('offer normalization helpers', () => {
  it('normalizes competence month with explicit value and fallback date', () => {
    expect(normalizeCompetenceMonth('2026-02')).toBe('2026-02');
    expect(normalizeCompetenceMonth('', '2026-02-15')).toBe('2026-02');
  });

  it('normalizes status values and legacy flags', () => {
    expect(normalizeOfferStatus('liquidada')).toBe('LIQUIDADA');
    expect(normalizeOfferStatus('cancelled')).toBe('CANCELADA');
    expect(normalizeOfferStatus(undefined, { reservaEfetuada: true })).toBe('RESERVADA');
    expect(normalizeOfferStatus(undefined, { reservaLiquidada: true })).toBe('LIQUIDADA');
  });

  it('normalizes audience values with default GENERAL', () => {
    expect(normalizeOfferAudience('QUALIFIED')).toBe('QUALIFIED');
    expect(normalizeOfferAudience('qualificado')).toBe('QUALIFIED');
    expect(normalizeOfferAudience(undefined)).toBe('GENERAL');
  });

  it('normalizes asset class values using heuristics and fallback', () => {
    expect(normalizeOfferAssetClass('RENDA_VARIAVEL')).toBe('RENDA_VARIAVEL');
    expect(normalizeOfferAssetClass('Fundos Oferta Publica')).toBe('FUNDOS');
    expect(normalizeOfferAssetClass('Acoes / RV')).toBe('RENDA_VARIAVEL');
    expect(normalizeOfferAssetClass('Credito Privado')).toBe('RENDA_FIXA');
    expect(normalizeOfferAssetClass('Previdencia')).toBe('PREVIDENCIA');
    expect(normalizeOfferAssetClass('Internacional')).toBe('INTERNACIONAL');
    expect(normalizeOfferAssetClass('COE')).toBe('COE');
    expect(normalizeOfferAssetClass('Classe desconhecida')).toBe('OUTROS');
  });

  it('derives legacy reservation flags from normalized status', () => {
    expect(deriveLegacyReservationFlags('PENDENTE')).toEqual({ reservaEfetuada: false, reservaLiquidada: false });
    expect(deriveLegacyReservationFlags('RESERVADA')).toEqual({ reservaEfetuada: true, reservaLiquidada: false });
    expect(deriveLegacyReservationFlags('LIQUIDADA')).toEqual({ reservaEfetuada: true, reservaLiquidada: true });
    expect(deriveLegacyReservationFlags('CANCELADA')).toEqual({ reservaEfetuada: false, reservaLiquidada: false });
  });

  it('applies unified liquidated rule with status/date and cancelation guard', () => {
    expect(isLiquidated({ status: 'LIQUIDADA' })).toBe(true);
    expect(isLiquidated({ status: 'PENDENTE', dataLiquidacao: '2026-02-10' })).toBe(true);
    expect(isLiquidated({ status: 'RESERVADA', liquidationDate: '2026-02-10' })).toBe(true);
    expect(isLiquidated({ status: 'CANCELADA', dataLiquidacao: '2026-02-10' })).toBe(false);
    expect(isLiquidated({ status: 'CANCELADA', reservaLiquidada: true })).toBe(false);
    expect(isLiquidated({ status: 'PENDENTE' })).toBe(false);
  });
});
