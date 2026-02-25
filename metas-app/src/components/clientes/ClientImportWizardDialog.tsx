
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageSkeleton,
  Tabs,
  Tooltip,
} from '../ui';
import type {
  ClientImportColumnMapping,
  ClientImportColumnMappingValue,
  ClientImportMappingModel,
  ClientImportPreviewRow,
  ImportExecutionResult,
  ImportIssue,
  ParsedImportFile,
  ParsedImportSheet,
  PreviewOverrideAction,
} from '../../import/types';
import { IGNORE_IMPORT_COLUMN } from '../../import/types';
import { getDefaultSheetName, parseClientImportFile } from '../../import/parsers/clientImportParser';
import {
  applyMappingModel,
  autoMapHeaders,
  deleteMappingModel,
  getFieldOptions,
  getLastUsedModelId,
  loadMappingModels,
  saveMappingModel,
  setLastUsedModelId,
} from '../../import/mapping/clientImportMapping';
import { mergePreviewRows, normalizeImportedClientRow } from '../../import/normalize/clientImportRow';
import {
  buildDecisionSnapshots,
  hasUnresolvedConflicts,
  resolveEffectiveAction,
  type ConflictResolutionMap,
  type RowOverrideMap,
} from '../../import/preview/decisions';
import {
  bulkUpsertClients,
  createClientImportAudit,
  lookupClientsByAccount,
  type BulkUpsertItem,
} from '../../services/clientImportService';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type PreviewFilter = 'all' | 'errors' | 'conflicts' | 'create' | 'update';

interface ImportCounters {
  created: number;
  updated: number;
  ignored: number;
  errors: number;
}

interface ClientImportWizardDialogProps {
  isOpen: boolean;
  user: unknown;
  ownerUid?: string | null;
  onClose: () => void;
  onImportFinished?: () => Promise<void> | void;
  onOpenReviewPending?: () => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Upload',
  2: 'Aba',
  3: 'Mapeamento',
  4: 'Prévia',
  5: 'Importar',
  6: 'Resumo',
};

const PAGE_SIZE = 50;
const BATCH_SIZE = 200;
const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4, 5, 6];

function resolveUid(ownerUid: string | null | undefined, user: unknown): string | null {
  if (ownerUid && ownerUid.trim()) return ownerUid.trim();
  if (user && typeof user === 'object') {
    const maybeUid = (user as Record<string, unknown>).uid;
    if (typeof maybeUid === 'string' && maybeUid.trim()) return maybeUid.trim();
  }
  return null;
}

function getSheetByName(parsed: ParsedImportFile | null, sheetName: string): ParsedImportSheet | null {
  if (!parsed) return null;
  return parsed.sheets.find((sheet) => sheet.name === sheetName) ?? null;
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildIssueLabel(issues: ImportIssue[]): string {
  if (!issues.length) return 'Sem observações';
  return issues.map((issue) => issue.message).join(' | ');
}

function buildDiffLabel(row: ClientImportPreviewRow): string {
  if (!row.existingMatch) return 'Novo cliente';

  const diffParts: string[] = [];
  if (row.payload.nome && row.payload.nome !== row.existingMatch.nome) {
    diffParts.push(`Nome: ${row.existingMatch.nome ?? '—'} -> ${row.payload.nome}`);
  }
  if (row.payload.perfilInvestidor && row.payload.perfilInvestidor !== row.existingMatch.perfilInvestidor) {
    diffParts.push(`Perfil: ${row.existingMatch.perfilInvestidor ?? '—'} -> ${row.payload.perfilInvestidor}`);
  }
  if (row.payload.codigoConta && row.payload.codigoConta !== row.existingMatch.accountNumber) {
    diffParts.push(`Conta: ${row.existingMatch.accountNumber} -> ${row.payload.codigoConta}`);
  }
  if (typeof row.payload.metrics?.totalBRL === 'number' && row.payload.metrics.totalBRL !== row.existingMatch.metrics?.totalBRL) {
    diffParts.push(`Total BRL: ${row.existingMatch.metrics?.totalBRL ?? '—'} -> ${row.payload.metrics.totalBRL}`);
  }
  if (typeof row.payload.metrics?.onshoreBRL === 'number' && row.payload.metrics.onshoreBRL !== row.existingMatch.metrics?.onshoreBRL) {
    diffParts.push(`Onshore BRL: ${row.existingMatch.metrics?.onshoreBRL ?? '—'} -> ${row.payload.metrics.onshoreBRL}`);
  }
  if (typeof row.payload.metrics?.offshoreBRL === 'number' && row.payload.metrics.offshoreBRL !== row.existingMatch.metrics?.offshoreBRL) {
    diffParts.push(`Offshore BRL: ${row.existingMatch.metrics?.offshoreBRL ?? '—'} -> ${row.payload.metrics.offshoreBRL}`);
  }
  if (typeof row.payload.metrics?.cdiYearPct === 'number' && row.payload.metrics.cdiYearPct !== row.existingMatch.metrics?.cdiYearPct) {
    diffParts.push(`% CDI: ${row.existingMatch.metrics?.cdiYearPct ?? '—'} -> ${row.payload.metrics.cdiYearPct}`);
  }

  if (!diffParts.length) return 'Sem mudanças principais';
  return diffParts.join(' | ');
}

function getFilterTabs(): Array<{ value: PreviewFilter; label: string }> {
  return [
    { value: 'all', label: 'Todos' },
    { value: 'errors', label: 'Erros' },
    { value: 'conflicts', label: 'Conflitos' },
    { value: 'create', label: 'Criar' },
    { value: 'update', label: 'Atualizar' },
  ];
}

function buildCsvReport(results: ImportExecutionResult[]): string {
  const header = ['rowNumber', 'accountNumber', 'action', 'result', 'message'];
  const escapeValue = (value: string | number | undefined): string => {
    const text = String(value ?? '');
    if (!text.includes(';') && !text.includes('"') && !text.includes('\n')) return text;
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [
    header.join(';'),
    ...results.map((result) =>
      [
        escapeValue(result.rowNumber),
        escapeValue(result.accountNumber),
        escapeValue(result.action),
        escapeValue(result.result),
        escapeValue(result.message),
      ].join(';'),
    ),
  ];

  return lines.join('\n');
}

function downloadFile(content: string, mimeType: string, fileName: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ClientImportWizardDialog({
  isOpen,
  user,
  ownerUid,
  onClose,
  onImportFinished,
  onOpenReviewPending,
}: ClientImportWizardDialogProps) {
  const uid = useMemo(() => resolveUid(ownerUid, user), [ownerUid, user]);
  const [step, setStep] = useState<WizardStep>(1);
  const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [mapping, setMapping] = useState<ClientImportColumnMapping>({});
  const [mappingModels, setMappingModels] = useState<ClientImportMappingModel[]>([]);
  const [mappingModelName, setMappingModelName] = useState('');

  const [previewRows, setPreviewRows] = useState<ClientImportPreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [previewPage, setPreviewPage] = useState(0);
  const [rowOverrides, setRowOverrides] = useState<RowOverrideMap>({});
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolutionMap>({});

  const [importing, setImporting] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [importCounters, setImportCounters] = useState<ImportCounters>({
    created: 0,
    updated: 0,
    ignored: 0,
    errors: 0,
  });
  const [importResults, setImportResults] = useState<ImportExecutionResult[]>([]);

  const selectedSheet = useMemo(
    () => getSheetByName(parsedFile, selectedSheetName),
    [parsedFile, selectedSheetName],
  );

  const fieldOptions = useMemo(() => getFieldOptions(), []);

  const decisions = useMemo(
    () => buildDecisionSnapshots(previewRows, rowOverrides, conflictResolutions),
    [previewRows, rowOverrides, conflictResolutions],
  );

  const filteredRows = useMemo(() => {
    return previewRows.filter((row) => {
      const action = resolveEffectiveAction(row, rowOverrides, conflictResolutions);
      if (previewFilter === 'all') return true;
      if (previewFilter === 'errors') return row.issues.length > 0 || action === 'error';
      if (previewFilter === 'conflicts') return action === 'conflict';
      if (previewFilter === 'create') return action === 'create';
      if (previewFilter === 'update') return action === 'update';
      return true;
    });
  }, [conflictResolutions, previewFilter, previewRows, rowOverrides]);

  const paginatedRows = useMemo(() => {
    const start = previewPage * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, previewPage]);

  const totalPreviewPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)),
    [filteredRows.length],
  );

  const conflictGroups = useMemo(() => {
    const grouped = new Map<string, ClientImportPreviewRow[]>();
    for (const row of previewRows) {
      if (!row.conflictGroupId) continue;
      const current = grouped.get(row.conflictGroupId) ?? [];
      current.push(row);
      grouped.set(row.conflictGroupId, current);
    }
    return Array.from(grouped.entries());
  }, [previewRows]);

  const unresolvedConflicts = useMemo(
    () => hasUnresolvedConflicts(previewRows, rowOverrides, conflictResolutions),
    [previewRows, rowOverrides, conflictResolutions],
  );

  const actionableRowsCount = useMemo(
    () => decisions.filter((decision) => decision.backendAction).length,
    [decisions],
  );

  const blockingRowsCount = useMemo(
    () => decisions.filter((decision) => decision.effectiveAction === 'error' || decision.effectiveAction === 'conflict').length,
    [decisions],
  );

  const resetWizard = useCallback(() => {
    setStep(1);
    setParsedFile(null);
    setSelectedSheetName('');
    setMapping({});
    setMappingModelName('');
    setPreviewRows([]);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewFilter('all');
    setPreviewPage(0);
    setRowOverrides({});
    setConflictResolutions({});
    setImporting(false);
    setBatchIndex(0);
    setBatchTotal(0);
    setImportCounters({ created: 0, updated: 0, ignored: 0, errors: 0 });
    setImportResults([]);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setMappingModels(loadMappingModels(uid));
  }, [isOpen, uid]);

  const preparePreview = useCallback(async () => {
    if (!selectedSheet) {
      setPreviewError('Selecione uma aba válida para gerar a prévia.');
      return;
    }

    if (!Object.keys(mapping).length) {
      setPreviewError('Defina o mapeamento antes da prévia.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewPage(0);

    try {
      const drafts = selectedSheet.rows.map((row, index) =>
        normalizeImportedClientRow(row, index + 2, mapping),
      );

      const accounts = Array.from(
        new Set(drafts.map((draft) => draft.accountNumber).filter(Boolean)),
      );

      const lookupResponse = await lookupClientsByAccount({ accounts }, user as { uid?: string });
      const lookupMap = new Map(lookupResponse.matches.map((match) => [match.accountNumber, match]));
      const rows = mergePreviewRows(drafts, lookupMap);

      setPreviewRows(rows);
      setRowOverrides({});
      setConflictResolutions({});
      setStep(4);
    } catch (error) {
      if (error instanceof Error && error.message === 'IMPORT_FORBIDDEN') {
        setPreviewError('Sem permissão para importar clientes.');
      } else {
        setPreviewError('Não foi possível gerar a prévia.');
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [mapping, selectedSheet, user]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseClientImportFile(file);
      const defaultSheet = getDefaultSheetName(parsed);
      const targetSheet = getSheetByName(parsed, defaultSheet);
      const nextMapping = targetSheet ? autoMapHeaders(targetSheet.headers) : {};

      setParsedFile(parsed);
      setSelectedSheetName(defaultSheet);
      setMapping(nextMapping);
      setPreviewRows([]);
      setPreviewError(null);
      setStep(parsed.fileType === 'xlsx' ? 2 : 3);

      const lastUsedModelId = getLastUsedModelId(uid);
      if (lastUsedModelId) {
        const model = loadMappingModels(uid).find((item) => item.id === lastUsedModelId);
        if (model && targetSheet) {
          setMapping(applyMappingModel(targetSheet.headers, model));
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Não foi possível ler o arquivo selecionado.');
      }
    } finally {
      event.target.value = '';
    }
  }, [uid]);

  const handleSheetChange = useCallback((sheetName: string) => {
    setSelectedSheetName(sheetName);
    const targetSheet = getSheetByName(parsedFile, sheetName);
    setMapping(targetSheet ? autoMapHeaders(targetSheet.headers) : {});
    setPreviewRows([]);
    setPreviewError(null);
  }, [parsedFile]);

  const handleMappingChange = useCallback((header: string, value: ClientImportColumnMappingValue) => {
    setMapping((current) => ({
      ...current,
      [header]: value,
    }));
  }, []);

  const handleSaveModel = useCallback(() => {
    if (!uid) {
      toast.error('Usuário sem UID para salvar modelos.');
      return;
    }

    try {
      const models = saveMappingModel(uid, mappingModelName, mapping);
      setMappingModels(models);
      setMappingModelName('');
      toast.success('Modelo salvo com sucesso.');
    } catch (error) {
      if (error instanceof Error && error.message === 'MODEL_NAME_REQUIRED') {
        toast.error('Informe um nome para salvar o modelo.');
      } else {
        toast.error('Não foi possível salvar o modelo.');
      }
    }
  }, [mapping, mappingModelName, uid]);

  const handleApplyModel = useCallback((modelId: string) => {
    if (!selectedSheet) return;
    const model = mappingModels.find((item) => item.id === modelId);
    if (!model) return;

    setMapping(applyMappingModel(selectedSheet.headers, model));
    setLastUsedModelId(uid, model.id);
    toast.success('Modelo aplicado.');
  }, [mappingModels, selectedSheet, uid]);

  const handleDeleteModel = useCallback((modelId: string) => {
    const nextModels = deleteMappingModel(uid, modelId);
    setMappingModels(nextModels);
  }, [uid]);

  const updateConflictResolution = useCallback((groupId: string, resolution: { winnerRowId?: string; ignoreAll?: boolean }) => {
    setConflictResolutions((current) => ({
      ...current,
      [groupId]: resolution,
    }));
  }, []);

  const updateRowOverride = useCallback((rowId: string, action: PreviewOverrideAction | '') => {
    setRowOverrides((current) => {
      if (!action) {
        const next = { ...current };
        delete next[rowId];
        return next;
      }
      return {
        ...current,
        [rowId]: action,
      };
    });
  }, []);

  const handleStartImport = useCallback(async () => {
    const snapshot = buildDecisionSnapshots(previewRows, rowOverrides, conflictResolutions);
    const blockingRows = snapshot.filter((decision) => decision.effectiveAction === 'error' || decision.effectiveAction === 'conflict');

    if (blockingRows.length > 0) {
      toast.error('Resolva erros e conflitos antes de importar.');
      return;
    }

    const executable = snapshot.filter((decision) => decision.backendAction && decision.payload);
    const ignoredRows = snapshot.filter((decision) => decision.effectiveAction === 'ignore');
    const batches = chunkArray(executable, BATCH_SIZE);
    const nextResults: ImportExecutionResult[] = [];

    setImporting(true);
    setBatchIndex(0);
    setBatchTotal(batches.length);
    setImportCounters({
      created: 0,
      updated: 0,
      ignored: ignoredRows.length,
      errors: 0,
    });

    for (const ignored of ignoredRows) {
      nextResults.push({
        rowId: ignored.rowId,
        rowNumber: ignored.rowNumber,
        accountNumber: ignored.accountNumber,
        action: ignored.effectiveAction,
        result: 'ignored',
        message: 'Linha ignorada pelo usuário.',
      });
    }

    const importId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
      for (let index = 0; index < batches.length; index += 1) {
        setBatchIndex(index + 1);
        const batch = batches[index];
        const payloadItems: BulkUpsertItem[] = batch.map((item) => ({
          action: item.backendAction as 'create' | 'update',
          clientId: item.clientId,
          data: item.payload!,
          source: {
            importId,
            rowNumber: item.rowNumber,
          },
        }));

        const response = await bulkUpsertClients({ items: payloadItems }, user as { uid?: string });

        response.results.forEach((result, resultIndex) => {
          const row = batch[resultIndex];
          if (!row) return;

          if (result.status === 'created') {
            createdCount += 1;
            nextResults.push({
              rowId: row.rowId,
              rowNumber: row.rowNumber,
              accountNumber: row.accountNumber,
              action: row.effectiveAction,
              result: 'created',
              clientId: result.clientId,
            });
            return;
          }

          if (result.status === 'updated') {
            updatedCount += 1;
            nextResults.push({
              rowId: row.rowId,
              rowNumber: row.rowNumber,
              accountNumber: row.accountNumber,
              action: row.effectiveAction,
              result: 'updated',
              clientId: result.clientId,
            });
            return;
          }

          errorCount += 1;
          nextResults.push({
            rowId: row.rowId,
            rowNumber: row.rowNumber,
            accountNumber: row.accountNumber,
            action: row.effectiveAction,
            result: 'error',
            message: result.error ?? 'Erro no processamento.',
          });
        });

        setImportCounters({
          created: createdCount,
          updated: updatedCount,
          ignored: ignoredRows.length,
          errors: errorCount,
        });
      }

      const topErrorsMap = new Map<string, number>();
      for (const result of nextResults) {
        if (result.result !== 'error') continue;
        const key = result.message || 'unknown_error';
        topErrorsMap.set(key, (topErrorsMap.get(key) ?? 0) + 1);
      }

      await createClientImportAudit({
        fileName: parsedFile?.fileName ?? 'import',
        createdAt: new Date().toISOString(),
        createdCount,
        updatedCount,
        ignoredCount: ignoredRows.length,
        errorCount,
        topErrors: Array.from(topErrorsMap.entries())
          .slice(0, 5)
          .map(([code, count]) => ({ code, count })),
      }, user as { uid?: string });

      setImportResults(nextResults.sort((a, b) => a.rowNumber - b.rowNumber));
      setStep(6);
      await onImportFinished?.();
      toast.success('Importação concluída.');
    } catch (error) {
      if (error instanceof Error && error.message === 'IMPORT_FORBIDDEN') {
        toast.error('Sem permissão para importar clientes.');
      } else {
        toast.error('Falha ao executar a importação.');
      }
    } finally {
      setImporting(false);
    }
  }, [conflictResolutions, onImportFinished, parsedFile?.fileName, previewRows, rowOverrides, user]);

  const handleDownloadCsv = useCallback(() => {
    if (!importResults.length) return;
    const csv = buildCsvReport(importResults);
    downloadFile(csv, 'text/csv;charset=utf-8', 'import-clientes-relatorio.csv');
  }, [importResults]);

  const handleDownloadJson = useCallback(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      fileName: parsedFile?.fileName ?? null,
      counters: importCounters,
      results: importResults,
      decisions,
    };
    downloadFile(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', 'import-clientes-debug.json');
  }, [decisions, importCounters, importResults, parsedFile?.fileName]);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [onClose, resetWizard]);

  const canAdvanceFromStep = useMemo(() => {
    if (step === 1) return Boolean(parsedFile);
    if (step === 2) return Boolean(selectedSheetName);
    if (step === 3) return Boolean(selectedSheet && selectedSheet.headers.length > 0);
    if (step === 4) return previewRows.length > 0;
    if (step === 5) return false;
    return false;
  }, [parsedFile, previewRows.length, selectedSheet, selectedSheetName, step]);

  const renderStepHeader = () => (
    <div className="flex flex-wrap items-center gap-2">
      {WIZARD_STEPS.map((stepNumber) => {
        const isActive = stepNumber === step;
        const isCompleted = stepNumber < step;
        const variant = isActive ? 'gold' : isCompleted ? 'success' : 'neutral';
        return (
          <Badge key={stepNumber} variant={variant}>
            {stepNumber}. {STEP_LABELS[stepNumber]}
          </Badge>
        );
      })}
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-dashed p-6"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
      >
        <label className="flex cursor-pointer flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Selecione arquivo XLSX ou CSV
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              O arquivo é processado no navegador, sem upload para backend.
            </p>
          </div>
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
          <span
            className="rounded-md px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--color-gold-bg)', color: 'var(--color-gold)' }}
          >
            Escolher arquivo
          </span>
        </label>
      </div>
      {parsedFile && (
        <div
          className="rounded-lg p-4"
          style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {parsedFile.fileName}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {parsedFile.fileType.toUpperCase()} · {formatFileSize(parsedFile.fileSize)}
          </p>
        </div>
      )}
    </div>
  );

  const renderSheetStep = () => (
    <div className="space-y-4">
      {parsedFile?.fileType === 'csv' ? (
        <EmptyState
          title="Arquivo CSV não possui abas"
          description="Siga para o mapeamento das colunas."
          icon={<FileSpreadsheet className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />}
        />
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Selecione a aba
          </label>
          <select
            value={selectedSheetName}
            onChange={(event) => handleSheetChange(event.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            {parsedFile?.sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} ({sheet.rows.length} linhas)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => {
    if (!selectedSheet) {
      return (
        <ErrorState
          title="Aba inválida"
          description="Escolha uma aba para continuar."
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Nome do modelo"
            value={mappingModelName}
            onChange={(event) => setMappingModelName(event.target.value)}
            placeholder="Ex: Mapeamento XP Fevereiro"
            className="min-w-[220px] flex-1"
          />
          <Button variant="secondary" onClick={handleSaveModel}>
            Salvar modelo
          </Button>
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setMapping(autoMapHeaders(selectedSheet.headers))}
          >
            Auto-map
          </Button>
        </div>

        {mappingModels.length > 0 && (
          <div
            className="rounded-lg p-3"
            style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}
          >
            <p className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>
              Modelos salvos
            </p>
            <div className="flex flex-wrap gap-2">
              {mappingModels.map((model) => (
                <div key={model.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyModel(model.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {model.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteModel(model.id)}
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-[48vh] overflow-auto rounded-lg" style={{ border: '1px solid var(--color-border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <tr>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Coluna origem</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Campo destino</th>
              </tr>
            </thead>
            <tbody>
              {selectedSheet.headers.map((header) => (
                <tr key={header} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{header}</td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[header] ?? IGNORE_IMPORT_COLUMN}
                      onChange={(event) => handleMappingChange(header, event.target.value as ClientImportColumnMappingValue)}
                      className="w-full rounded-md px-2 py-1"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {fieldOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderConflictResolution = () => {
    if (conflictGroups.length === 0) return null;

    return (
      <div className="space-y-3">
        {conflictGroups.map(([groupId, rows]) => {
          const resolution = conflictResolutions[groupId];
          const isResolved = Boolean(resolution?.ignoreAll || resolution?.winnerRowId);
          return (
            <div
              key={groupId}
              className="rounded-lg p-3"
              style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Conflito de conta {rows[0]?.accountNumber}
                </p>
                <Badge variant={isResolved ? 'success' : 'warning'}>
                  {isResolved ? 'Resolvido' : 'Pendente'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {rows.map((row) => (
                  <button
                    key={row.rowId}
                    type="button"
                    onClick={() => updateConflictResolution(groupId, { winnerRowId: row.rowId, ignoreAll: false })}
                    className="rounded-md px-2 py-1 text-xs"
                    style={{
                      border: '1px solid var(--color-border)',
                      backgroundColor: resolution?.winnerRowId === row.rowId ? 'var(--color-gold-bg)' : 'var(--color-surface)',
                      color: resolution?.winnerRowId === row.rowId ? 'var(--color-gold)' : 'var(--color-text)',
                    }}
                  >
                    Usar linha {row.rowNumber} ({row.payload.nome ?? 'Sem nome'})
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateConflictResolution(groupId, { ignoreAll: true })}
                  className="rounded-md px-2 py-1 text-xs"
                  style={{
                    border: '1px solid var(--color-border)',
                    backgroundColor: resolution?.ignoreAll ? 'var(--color-danger-bg)' : 'var(--color-surface)',
                    color: resolution?.ignoreAll ? 'var(--color-danger)' : 'var(--color-text)',
                  }}
                >
                  Ignorar todas
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPreviewStep = () => {
    if (previewLoading) {
      return <PageSkeleton rows={6} />;
    }

    if (previewError) {
      return (
        <ErrorState
          title="Falha na prévia"
          description={previewError}
          onRetry={preparePreview}
        />
      );
    }

    if (!previewRows.length) {
      return (
        <EmptyState
          title="Nenhuma linha para prévia"
          description="Ajuste o mapeamento e gere novamente."
          primaryAction={{
            label: 'Gerar prévia',
            onClick: preparePreview,
          }}
        />
      );
    }

    return (
      <div className="space-y-4">
        {renderConflictResolution()}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={getFilterTabs()}
            value={previewFilter}
            onChange={(value) => {
              setPreviewFilter(value as PreviewFilter);
              setPreviewPage(0);
            }}
          />
          <div className="flex items-center gap-2">
            <Badge variant={unresolvedConflicts ? 'warning' : 'success'}>
              {unresolvedConflicts ? 'Conflitos pendentes' : 'Sem conflitos pendentes'}
            </Badge>
            <Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={preparePreview}>
              Regerar prévia
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--color-border-subtle)' }}>
          <table className="min-w-full text-xs">
            <thead style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <tr>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Linha</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Conta</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Nome</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Ação</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Diff (MVP)</th>
                <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Validações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const effectiveAction = resolveEffectiveAction(row, rowOverrides, conflictResolutions);
                const variant =
                  effectiveAction === 'create' ? 'success' :
                    effectiveAction === 'update' ? 'info' :
                      effectiveAction === 'ignore' ? 'neutral' :
                        effectiveAction === 'conflict' ? 'warning' : 'danger';

                return (
                  <tr key={row.rowId} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-2 py-2" style={{ color: 'var(--color-text)' }}>{row.rowNumber}</td>
                    <td className="px-2 py-2">
                      <Badge variant={variant}>{effectiveAction}</Badge>
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--color-text)' }}>{row.accountNumber || 'Sem conta'}</td>
                    <td className="px-2 py-2" style={{ color: 'var(--color-text)' }}>{row.payload.nome || 'Sem nome'}</td>
                    <td className="px-2 py-2">
                      <select
                        value={rowOverrides[row.rowId] ?? ''}
                        onChange={(event) => updateRowOverride(row.rowId, event.target.value as PreviewOverrideAction | '')}
                        className="rounded px-2 py-1"
                        style={{
                          backgroundColor: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                        disabled={row.conflictGroupId !== undefined}
                      >
                        <option value="">Padrão ({row.baseAction})</option>
                        <option value="create">Criar novo</option>
                        <option value="update">Atualizar</option>
                        <option value="ignore">Ignorar</option>
                      </select>
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>{buildDiffLabel(row)}</td>
                    <td className="px-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>{buildIssueLabel(row.issues)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filteredRows.length} linha(s) · página {previewPage + 1} de {totalPreviewPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={previewPage === 0} onClick={() => setPreviewPage((current) => Math.max(0, current - 1))}>
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={previewPage + 1 >= totalPreviewPages}
              onClick={() => setPreviewPage((current) => Math.min(totalPreviewPages - 1, current + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderImportStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criar/Atualizar</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{actionableRowsCount}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ignoradas</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{decisions.filter((decision) => decision.effectiveAction === 'ignore').length}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Conflitos</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{decisions.filter((decision) => decision.effectiveAction === 'conflict').length}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Erros bloqueantes</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{decisions.filter((decision) => decision.effectiveAction === 'error').length}</p>
        </div>
      </div>

      {importing && (
        <div
          className="rounded-lg p-3"
          style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>
            Lote {batchIndex}/{Math.max(batchTotal, 1)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Criados {importCounters.created} · Atualizados {importCounters.updated} · Ignorados {importCounters.ignored} · Erros {importCounters.errors}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tooltip content="Resolva conflitos e erros bloqueantes antes de importar." disabled={!unresolvedConflicts && blockingRowsCount === 0}>
          <span className="inline-flex">
            <Button
              onClick={handleStartImport}
              disabled={importing || unresolvedConflicts || blockingRowsCount > 0}
              leftIcon={importing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {importing ? 'Importando...' : 'Iniciar importação'}
            </Button>
          </span>
        </Tooltip>
        {!importing && (
          <Button variant="secondary" onClick={() => setStep(4)}>
            Voltar para prévia
          </Button>
        )}
      </div>
    </div>
  );

  const renderSummaryStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Criados</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{importCounters.created}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Atualizados</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{importCounters.updated}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ignorados</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{importCounters.ignored}</p>
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Erros</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{importCounters.errors}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownloadCsv}>
          Baixar CSV humano
        </Button>
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownloadJson}>
          Baixar JSON debug
        </Button>
        {onOpenReviewPending && (
          <Button variant="ghost" onClick={onOpenReviewPending}>
            Abrir revisão pendente
          </Button>
        )}
      </div>

      <div className="max-h-[36vh] overflow-auto rounded-lg" style={{ border: '1px solid var(--color-border-subtle)' }}>
        <table className="min-w-full text-xs">
          <thead style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <tr>
              <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Linha</th>
              <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Conta</th>
              <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Ação</th>
              <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Resultado</th>
              <th className="px-2 py-2 text-left" style={{ color: 'var(--color-text-muted)' }}>Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {importResults.map((result) => (
              <tr key={`${result.rowId}_${result.result}`} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td className="px-2 py-2" style={{ color: 'var(--color-text)' }}>{result.rowNumber}</td>
                <td className="px-2 py-2" style={{ color: 'var(--color-text)' }}>{result.accountNumber || 'Sem conta'}</td>
                <td className="px-2 py-2">
                  <Badge variant="neutral">{result.action}</Badge>
                </td>
                <td className="px-2 py-2">
                  <Badge
                    variant={
                      result.result === 'created' ? 'success' :
                        result.result === 'updated' ? 'info' :
                          result.result === 'ignored' ? 'neutral' : 'danger'
                    }
                  >
                    {result.result}
                  </Badge>
                </td>
                <td className="px-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>{result.message || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBody = () => {
    if (step === 1) return renderUploadStep();
    if (step === 2) return renderSheetStep();
    if (step === 3) return renderMappingStep();
    if (step === 4) return renderPreviewStep();
    if (step === 5) return renderImportStep();
    return renderSummaryStep();
  };

  const renderFooter = () => {
    const canGoBack = step > 1 && step < 6 && !importing;
    const showNext = step < 5;

    return (
      <div className="flex w-full items-center justify-between">
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {step === 4 && previewRows.length > 0
            ? `${previewRows.length} linha(s) na prévia`
            : step === 6
              ? `${importResults.length} item(ns) no relatório`
              : ''}
        </div>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button
              variant="ghost"
              onClick={() => setStep((current) => (Math.max(1, current - 1) as WizardStep))}
            >
              Voltar
            </Button>
          )}
          {showNext && (
            <Button
              variant="primary"
              disabled={!canAdvanceFromStep || previewLoading}
              onClick={() => {
                if (step === 3) {
                  void preparePreview();
                  return;
                }
                setStep((current) => (Math.min(5, current + 1) as WizardStep));
              }}
            >
              {step === 3 ? 'Gerar prévia' : 'Avançar'}
            </Button>
          )}
          {step === 5 && (
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={importing}
            >
              Fechar
            </Button>
          )}
          {step === 6 && (
            <Button variant="primary" onClick={handleClose}>
              Concluir
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importação de Clientes (XLSX/CSV)"
      size="xl"
      footer={renderFooter()}
    >
      <div className="space-y-4">
        {renderStepHeader()}
        {!uid && (
          <div
            className="flex items-start gap-2 rounded-lg p-3"
            style={{ border: '1px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)' }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Usuário sem UID identificado. Alguns recursos (modelos salvos) podem não funcionar.
            </p>
          </div>
        )}
        {step === 6 && importCounters.errors === 0 && (
          <div
            className="flex items-center gap-2 rounded-lg p-3"
            style={{ border: '1px solid var(--color-success)', backgroundColor: 'var(--color-success-bg)' }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Importação finalizada sem erros.
            </p>
          </div>
        )}
        {renderBody()}
      </div>
    </Modal>
  );
}
