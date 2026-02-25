import { describe, expect, it } from 'vitest';
import {
  canAcceptNewReservations,
  deriveLegacyReservationFlags,
  isLiquidationMomentExpired,
  isLiquidated,
  isReservationWindowExpired,
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
    expect(normalizeOfferStatus('reservada', { reservaLiquidada: true })).toBe('RESERVADA');
    expect(normalizeOfferStatus('pendente', { reservaEfetuada: true })).toBe('PENDENTE');
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

  it('handles reservation window in Sao Paulo timezone with end-of-day validity', () => {
    const now = new Date('2026-02-10T15:00:00.000Z');
    const nowAfterDateEnd = new Date('2026-02-11T03:30:00.000Z');

    expect(isReservationWindowExpired('2026-02-10', now)).toBe(false);
    expect(isReservationWindowExpired('10/02/2026', now)).toBe(false);
    expect(isReservationWindowExpired('2026-02-09', now)).toBe(true);
    expect(isReservationWindowExpired('10/02/2026', nowAfterDateEnd)).toBe(true);

    expect(canAcceptNewReservations({ status: 'PENDENTE', reservationEndDate: '2026-02-10' }, now)).toBe(true);
    expect(canAcceptNewReservations({ status: 'PENDENTE', reservationEndDate: '2026-02-09' }, now)).toBe(false);
    expect(canAcceptNewReservations({ status: 'LIQUIDADA', reservationEndDate: '2099-12-31' }, now)).toBe(false);
  });

  it('locks by liquidation moment only when now is after liquidationAt', () => {
    const now = new Date('2026-02-10T15:00:00.000Z');

    expect(isLiquidationMomentExpired('2026-02-12', now)).toBe(false);
    expect(isLiquidationMomentExpired('2026-02-10', now)).toBe(false);
    expect(isLiquidationMomentExpired('2026-02-09', now)).toBe(true);
    expect(isLiquidationMomentExpired('10/02/2026 11:00', now)).toBe(true);
    expect(isLiquidationMomentExpired({ seconds: 1893456000 }, now)).toBe(false);

    expect(canAcceptNewReservations({ status: 'RESERVADA', liquidationDate: '2026-02-12' }, now)).toBe(true);
    expect(canAcceptNewReservations({ status: 'RESERVADA', liquidationDate: '2026-02-09' }, now)).toBe(false);
  });

  it('applies lock matrix: status, reservation end, and liquidation moment', () => {
    const now = new Date('2026-02-10T15:00:00.000Z');

    expect(canAcceptNewReservations({
      status: 'RESERVADA',
      reservationEndDate: '2026-02-20',
      liquidationDate: '2026-02-25',
    }, now)).toBe(true);

    expect(canAcceptNewReservations({
      status: 'RESERVADA',
      reservationEndDate: '2026-02-09',
    }, now)).toBe(false);

    expect(canAcceptNewReservations({
      status: 'RESERVADA',
      liquidationDate: '2026-02-09',
    }, now)).toBe(false);

    expect(canAcceptNewReservations({
      status: 'RESERVADA',
      reservationEndDate: '2026-02-20',
      liquidationDate: '2026-02-09',
    }, now)).toBe(false);

    expect(canAcceptNewReservations({
      status: 'LIQUIDADA',
      reservationEndDate: '2099-12-31',
      liquidationDate: '2099-12-31',
    }, now)).toBe(false);

    expect(canAcceptNewReservations({
      status: 'CANCELADA',
      reservationEndDate: '2099-12-31',
      liquidationDate: '2099-12-31',
    }, now)).toBe(false);
  });
});
