import { describe, expect, it } from 'vitest';
import type { Prospect, ProspectInteracao } from '../../../domain/types';
import { buildInteracoesByProspectMap, sortByUrgency } from './prospectUi';

function prospect(partial: Partial<Prospect>): Prospect {
  return {
    nome: 'Prospect',
    status: 'novo',
    potencial: 0,
    potencialTipo: 'captacao_liquida',
    ...partial,
  } as Prospect;
}

function interacao(partial: Partial<ProspectInteracao>): ProspectInteracao {
  return {
    prospectId: 'p-1',
    tipo: 'ligacao',
    data: '2026-02-01',
    resumo: '',
    ...partial,
  } as ProspectInteracao;
}

describe('sortByUrgency', () => {
  it('orders overdue > today > upcoming > no next step', () => {
    const today = new Date('2026-02-12T10:00:00');
    const prospects: Prospect[] = [
      prospect({ id: 'future', nome: 'Future', proximoContato: '2026-02-20' }),
      prospect({ id: 'today', nome: 'Today', proximoContato: '2026-02-12' }),
      prospect({ id: 'overdue-old', nome: 'Overdue old', proximoContato: '2026-02-01' }),
      prospect({ id: 'overdue-new', nome: 'Overdue new', proximoContato: '2026-02-10' }),
      prospect({ id: 'idle-short', nome: 'Idle short' }),
      prospect({ id: 'idle-long', nome: 'Idle long' }),
    ];

    const interacoes = buildInteracoesByProspectMap([
      interacao({ prospectId: 'idle-short', data: '2026-02-10' }),
      interacao({ prospectId: 'idle-long', data: '2026-01-01' }),
    ]);

    const sortedIds = [...prospects]
      .sort((a, b) => sortByUrgency(a, b, today, interacoes))
      .map((item) => item.id);

    expect(sortedIds).toEqual([
      'overdue-old',
      'overdue-new',
      'today',
      'future',
      'idle-long',
      'idle-short',
    ]);
  });

  it('falls back to updatedAt desc when urgency is equivalent', () => {
    const today = new Date('2026-02-12T10:00:00');
    const interacoes = buildInteracoesByProspectMap([]);
    const first = prospect({
      id: 'a',
      nome: 'A',
      proximoContato: '2026-03-01',
      updatedAt: '2026-02-11T10:00:00Z',
    });
    const second = prospect({
      id: 'b',
      nome: 'B',
      proximoContato: '2026-03-01',
      updatedAt: '2026-02-10T10:00:00Z',
    });

    const sorted = [second, first].sort((a, b) => sortByUrgency(a, b, today, interacoes));

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
  });
});
