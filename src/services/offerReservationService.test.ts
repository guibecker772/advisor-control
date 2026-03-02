import { describe, expect, it } from 'vitest';
import type { OfferReservation, OfferReservationInput } from '../domain/types';
import { applyReservationToOfferSnapshot, normalizeOfferForPersistence } from './offerReservationService';

function buildInput(overrides: Partial<OfferReservationInput> = {}): OfferReservationInput {
  return {
    nomeAtivo: 'Oferta Teste',
    status: 'PENDENTE',
    competenceMonth: '2026-02',
    dataReserva: '2026-02-01',
    clientes: [
      {
        clienteId: 'cliente-1',
        allocatedValue: 1000,
        saldoOk: true,
        status: 'RESERVADA',
      },
    ],
    ...overrides,
  };
}

describe('normalizeOfferForPersistence', () => {
  it('keeps explicit status when liquidationDate is present', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'PENDENTE',
      liquidationDate: '2026-02-20',
    }));

    expect(normalized.status).toBe('PENDENTE');
    expect(normalized.liquidationDate).toBe('2026-02-20');
    expect(normalized.dataLiquidacao).toBe('2026-02-20');
    expect(normalized.reservaLiquidada).toBe(false);
  });

  it('keeps explicit status when dataLiquidacao is present', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'RESERVADA',
      dataLiquidacao: '2026-02-25',
    }));

    expect(normalized.status).toBe('RESERVADA');
    expect(normalized.liquidationDate).toBe('2026-02-25');
    expect(normalized.dataLiquidacao).toBe('2026-02-25');
  });

  it('keeps status CANCELADA when liquidation date is filled', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'CANCELADA',
      liquidationDate: '2026-02-28',
      reservaLiquidada: true,
    }));

    expect(normalized.status).toBe('CANCELADA');
    expect(normalized.reservaLiquidada).toBe(false);
  });

  it('prioritizes explicit status over stale legacy flags', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'RESERVADA',
      reservaEfetuada: false,
      reservaLiquidada: true,
      liquidationDate: '2026-02-28',
    }));

    expect(normalized.status).toBe('RESERVADA');
    expect(normalized.reservaLiquidada).toBe(false);
    expect(normalized.reservaEfetuada).toBe(true);
  });

  it('blocks new reservation when reservation window has expired', () => {
    const offer = {
      id: 'offer-1',
      status: 'PENDENTE',
      reservationEndDate: '2020-01-01',
      clientes: [],
    } as unknown as OfferReservation;

    const result = applyReservationToOfferSnapshot(offer, {
      clientId: 'cliente-1',
      reservedAmount: 1000,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('OFFER_LOCKED');
  });
});
