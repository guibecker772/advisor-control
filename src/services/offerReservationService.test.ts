import { describe, expect, it } from 'vitest';
import type { OfferReservationInput } from '../domain/types';
import { normalizeOfferForPersistence } from './offerReservationService';

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
  it('sets status to LIQUIDADA when liquidationDate is present', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'PENDENTE',
      liquidationDate: '2026-02-20',
    }));

    expect(normalized.status).toBe('LIQUIDADA');
    expect(normalized.liquidationDate).toBe('2026-02-20');
    expect(normalized.dataLiquidacao).toBe('2026-02-20');
    expect(normalized.reservaLiquidada).toBe(true);
  });

  it('sets status to LIQUIDADA when dataLiquidacao is present', () => {
    const normalized = normalizeOfferForPersistence(buildInput({
      status: 'RESERVADA',
      dataLiquidacao: '2026-02-25',
    }));

    expect(normalized.status).toBe('LIQUIDADA');
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
});
