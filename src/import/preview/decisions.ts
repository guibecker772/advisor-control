import type {
  ClientImportPreviewRow,
  ImportConflictResolution,
  RowDecisionSnapshot,
  PreviewEffectiveAction,
  PreviewOverrideAction,
} from '../types';

export type RowOverrideMap = Record<string, PreviewOverrideAction | undefined>;
export type ConflictResolutionMap = Record<string, ImportConflictResolution | undefined>;

function resolveConflictAction(
  row: ClientImportPreviewRow,
  resolution: ImportConflictResolution | undefined,
): PreviewEffectiveAction {
  if (!row.conflictGroupId) return row.baseAction;
  if (!resolution) return 'conflict';
  if (resolution.ignoreAll) return 'ignore';
  if (!resolution.winnerRowId) return 'conflict';
  return resolution.winnerRowId === row.rowId ? row.baseAction : 'ignore';
}

export function resolveEffectiveAction(
  row: ClientImportPreviewRow,
  overrides: RowOverrideMap,
  conflictResolutions: ConflictResolutionMap,
): PreviewEffectiveAction {
  if (row.hasBlockingError) {
    const override = overrides[row.rowId];
    return override === 'ignore' ? 'ignore' : 'error';
  }

  const baseFromConflict = resolveConflictAction(row, row.conflictGroupId ? conflictResolutions[row.conflictGroupId] : undefined);
  if (baseFromConflict === 'ignore' || baseFromConflict === 'conflict') {
    return baseFromConflict;
  }

  const override = overrides[row.rowId];
  if (!override) return baseFromConflict;
  return override;
}

export function buildDecisionSnapshots(
  rows: ClientImportPreviewRow[],
  overrides: RowOverrideMap,
  conflictResolutions: ConflictResolutionMap,
): RowDecisionSnapshot[] {
  return rows.map((row) => {
    const effectiveAction = resolveEffectiveAction(row, overrides, conflictResolutions);
    const backendAction = effectiveAction === 'create' || effectiveAction === 'update'
      ? effectiveAction
      : undefined;

    return {
      rowId: row.rowId,
      rowNumber: row.rowNumber,
      accountNumber: row.accountNumber,
      effectiveAction,
      backendAction,
      clientId: backendAction === 'update' ? row.existingMatch?.clientId : undefined,
      payload: backendAction ? row.payload : undefined,
      issues: row.issues,
      conflictGroupId: row.conflictGroupId,
    };
  });
}

export function hasUnresolvedConflicts(
  rows: ClientImportPreviewRow[],
  overrides: RowOverrideMap,
  conflictResolutions: ConflictResolutionMap,
): boolean {
  return rows.some((row) => resolveEffectiveAction(row, overrides, conflictResolutions) === 'conflict');
}
