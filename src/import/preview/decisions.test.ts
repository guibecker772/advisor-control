import { describe, expect, it } from 'vitest';
import {
  buildDecisionSnapshots,
  hasUnresolvedConflicts,
  resolveEffectiveAction,
  type ConflictResolutionMap,
  type RowOverrideMap,
} from './decisions';
import type { ClientImportPreviewRow } from '../types';

function createRow(partial: Partial<ClientImportPreviewRow>): ClientImportPreviewRow {
  return {
    rowId: partial.rowId ?? 'row-1',
    rowNumber: partial.rowNumber ?? 2,
    raw: {},
    payload: partial.payload ?? { nome: 'Cliente' },
    accountNumber: partial.accountNumber ?? '',
    issues: partial.issues ?? [],
    hasBlockingError: partial.hasBlockingError ?? false,
    baseAction: partial.baseAction ?? 'create',
    existingMatch: partial.existingMatch,
    conflictGroupId: partial.conflictGroupId,
  };
}

describe('import preview decisions', () => {
  it('marca conflito como bloqueante ate resolver grupo', () => {
    const rows = [
      createRow({ rowId: 'a', conflictGroupId: 'account:123', accountNumber: '123' }),
      createRow({ rowId: 'b', conflictGroupId: 'account:123', accountNumber: '123' }),
    ];

    const overrides: RowOverrideMap = {};
    const resolutions: ConflictResolutionMap = {};

    expect(hasUnresolvedConflicts(rows, overrides, resolutions)).toBe(true);
    expect(resolveEffectiveAction(rows[0], overrides, resolutions)).toBe('conflict');
  });

  it('quando seleciona winner, apenas uma linha segue para create/update', () => {
    const rows = [
      createRow({ rowId: 'a', conflictGroupId: 'account:123', accountNumber: '123', baseAction: 'update', existingMatch: { accountNumber: '123', clientId: 'c1' } }),
      createRow({ rowId: 'b', conflictGroupId: 'account:123', accountNumber: '123' }),
    ];

    const resolutions: ConflictResolutionMap = {
      'account:123': { winnerRowId: 'a', ignoreAll: false },
    };

    const snapshots = buildDecisionSnapshots(rows, {}, resolutions);
    expect(snapshots.find((snapshot) => snapshot.rowId === 'a')?.effectiveAction).toBe('update');
    expect(snapshots.find((snapshot) => snapshot.rowId === 'b')?.effectiveAction).toBe('ignore');
  });
});
