import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Users,
} from 'lucide-react';
import { toastSuccess, toastError } from '../../lib/toast';

import { useAuth } from '../../contexts/AuthContext';
import { prospectRepository, prospectInteracaoRepository } from '../../services/repositories';
import { prospectSchema, type Prospect, type ProspectInput, type ProspectInteracao } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import {
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  InlineEmpty,
  Modal,
  PageContainer,
  PageHeader,
  PageSkeleton,
  SectionCard,
  SegmentedControl,
} from '../../components/ui';
import { Input, Select, TextArea } from '../../components/shared/FormFields';
import SavedViewsControl from '../../components/saved-views/SavedViewsControl';
import { type SavedViewSnapshot } from '../../lib/savedViews';
import { emitDataInvalidation, subscribeDataInvalidation } from '../../lib/dataInvalidation';
import { saveProspectWithConversion } from '../../services/prospectConversionService';
import ProspectBoardView from './components/ProspectBoardView';
import ProspectKpiSummary from './components/ProspectKpiSummary';
import {
  PROSPECT_ORIGEM_OPTIONS,
  PROSPECT_STATUS_COLUMNS,
  PROSPECT_TIPO_OPTIONS,
  buildInteracoesByProspectMap,
  type ProspectContactFilter,
  type ProspectOrigemFilter,
  type ProspectStatusFilter,
  type ProspectViewMode,
  getContactUrgency,
  getOrigemLabel,
  getPipeAtualValue,
  getStatusLabel,
  getTipoLabel,
  isProspectAtivo,
  isProspectContactFilter,
  isProspectOrigemFilter,
  isProspectStatusFilter,
  isProspectViewMode,
  matchesSearchTerm,
  normalizeDate,
  normalizeProspectStatus,
} from './utils/prospectUi';

const viewModeOptions = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Tabela' },
];

const statusFilterOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
];

const contactFilterOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'today', label: 'Hoje' },
  { value: 'no_next_step', label: 'Sem próximo passo' },
];

const statusFilterLabels: Record<ProspectStatusFilter, string> = {
  all: 'Todos',
  active: 'Ativos',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

const contactFilterLabels: Record<ProspectContactFilter, string> = {
  all: 'Todos',
  overdue: 'Vencidos',
  today: 'Hoje',
  no_next_step: 'Sem próximo passo',
};

const PROSPECT_VIEW_MODE_STORAGE_KEY = 'advisor_control.prospects.viewMode';
const DEFAULT_VIEW_MODE: ProspectViewMode = 'cards';
const DEFAULT_STATUS_FILTER: ProspectStatusFilter = 'active';
const DEFAULT_CONTACT_FILTER: ProspectContactFilter = 'all';
const DEFAULT_ORIGEM_FILTER: ProspectOrigemFilter = 'all';

const interacaoTipoOptions = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
  { value: 'outro', label: 'Outro' },
];

const interacaoIcons: Record<string, ReactNode> = {
  ligacao: <Phone className="w-4 h-4" />,
  reuniao: <Users className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  visita: <Calendar className="w-4 h-4" />,
  outro: <Bell className="w-4 h-4" />,
};

function isWonProspectStatus(status: Prospect['status'] | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return normalized === 'ganho' || normalized === 'won' || normalized === 'closedwon' || normalized === 'closed_won';
}

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (normalizeProspectStatus(status)) {
    case 'ganho':
      return 'success';
    case 'perdido':
      return 'danger';
    case 'proposta':
    case 'qualificado':
      return 'warning';
    default:
      return 'default';
  }
}

function getInitialViewMode(): ProspectViewMode {
  if (typeof window === 'undefined') return DEFAULT_VIEW_MODE;
  const saved = window.localStorage.getItem(PROSPECT_VIEW_MODE_STORAGE_KEY);
  return isProspectViewMode(saved) ? saved : DEFAULT_VIEW_MODE;
}

function getProspectById(prospects: Prospect[], id: string | null): Prospect | undefined {
  if (!id) return undefined;
  return prospects.find((prospect) => prospect.id === id);
}

export default function ProspectsPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [searchParams, setSearchParams] = useSearchParams();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [interacoes, setInteracoes] = useState<ProspectInteracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSorting, setTableSorting] = useState<SortingState>([]);
  const [viewMode, setViewMode] = useState<ProspectViewMode>(getInitialViewMode);
  const [statusFilter, setStatusFilter] = useState<ProspectStatusFilter>(DEFAULT_STATUS_FILTER);
  const [contactFilter, setContactFilter] = useState<ProspectContactFilter>(DEFAULT_CONTACT_FILTER);
  const [origemFilter, setOrigemFilter] = useState<ProspectOrigemFilter>(DEFAULT_ORIGEM_FILTER);
  const [focusInteractionToken, setFocusInteractionToken] = useState(0);
  const handledQueryRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProspectInput>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      status: 'novo',
      potencial: 0,
      probabilidade: 50,
    },
  });

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setProspects([]);
      setInteracoes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [prospectsData, interacoesData] = await Promise.all([
        prospectRepository.getAll(ownerUid),
        prospectInteracaoRepository.getAll(ownerUid),
      ]);
      setProspects(prospectsData);
      setInteracoes(interacoesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toastError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid]);

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData]);

  useEffect(() => {
    if (authLoading || !ownerUid) return;
    return subscribeDataInvalidation(['prospects'], async () => {
      await loadData();
    });
  }, [authLoading, loadData, ownerUid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROSPECT_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const interacoesByProspect = useMemo(() => {
    return buildInteracoesByProspectMap(interacoes);
  }, [interacoes]);

  const statusWatch = watch('status');
  const realizadoValorWatch = watch('realizadoValor');
  const realizadoDataWatch = watch('realizadoData');
  const isWonSelected = isWonProspectStatus(statusWatch);

  const openModal = useCallback((prospect?: Prospect) => {
    if (prospect) {
      setSelectedProspect(prospect);
      reset(prospect);
    } else {
      setSelectedProspect(null);
      reset({
        nome: '',
        email: '',
        telefone: '',
        origem: '',
        status: 'novo',
        potencial: 0,
        potencialTipo: 'captacao_liquida',
        probabilidade: 50,
        proximoContato: '',
        proximoContatoHora: '',
        realizadoValor: 0,
        realizadoTipo: 'captacao_liquida',
        realizadoData: '',
        observacoes: '',
      });
    }
    setModalOpen(true);
  }, [reset]);

  const openProspectDetails = useCallback((prospect: Prospect, focusAddInteraction = false) => {
    setSelectedProspect(prospect);
    setDetalhesModalOpen(true);
    if (focusAddInteraction) {
      setFocusInteractionToken((value) => value + 1);
    }
  }, []);

  const getSavedViewSnapshot = useCallback((): SavedViewSnapshot => {
    const firstSort = tableSorting[0];
    return {
      searchTerm,
      filters: {
        viewMode,
        statusFilter,
        contactFilter,
        origemFilter,
      },
      sort: firstSort ? { id: firstSort.id, desc: firstSort.desc } : null,
    };
  }, [contactFilter, origemFilter, searchTerm, statusFilter, tableSorting, viewMode]);

  const applySavedViewSnapshot = useCallback((snapshot: SavedViewSnapshot) => {
    setSearchTerm(snapshot.searchTerm ?? '');
    setTableSorting(snapshot.sort ? [{ id: snapshot.sort.id, desc: snapshot.sort.desc }] : []);

    const nextViewMode = typeof snapshot.filters?.viewMode === 'string' ? snapshot.filters.viewMode : undefined;
    const nextStatusFilter = typeof snapshot.filters?.statusFilter === 'string' ? snapshot.filters.statusFilter : undefined;
    const nextContactFilter = typeof snapshot.filters?.contactFilter === 'string' ? snapshot.filters.contactFilter : undefined;
    const nextOrigemFilter = typeof snapshot.filters?.origemFilter === 'string' ? snapshot.filters.origemFilter : undefined;

    setViewMode(isProspectViewMode(nextViewMode) ? nextViewMode : DEFAULT_VIEW_MODE);
    setStatusFilter(isProspectStatusFilter(nextStatusFilter) ? nextStatusFilter : DEFAULT_STATUS_FILTER);
    setContactFilter(isProspectContactFilter(nextContactFilter) ? nextContactFilter : DEFAULT_CONTACT_FILTER);
    setOrigemFilter(isProspectOrigemFilter(nextOrigemFilter) ? nextOrigemFilter : DEFAULT_ORIGEM_FILTER);
  }, []);

  const clearProspectFilters = useCallback(() => {
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setContactFilter(DEFAULT_CONTACT_FILTER);
    setOrigemFilter(DEFAULT_ORIGEM_FILTER);
    setSearchTerm('');
  }, []);

  useEffect(() => {
    if (loading) return;

    const queryKey = searchParams.toString();
    if (handledQueryRef.current === queryKey) return;
    handledQueryRef.current = queryKey;

    const createParam = searchParams.get('create');
    const openParam = searchParams.get('open');
    if (!createParam && !openParam) return;

    const nextParams = new URLSearchParams(searchParams);
    let shouldReplace = false;

    if (createParam === '1') {
      openModal();
      nextParams.delete('create');
      shouldReplace = true;
    }

    if (openParam) {
      const target = getProspectById(prospects, openParam);
      if (target) {
        openProspectDetails(target);
      }
      nextParams.delete('open');
      shouldReplace = true;
    }

    if (shouldReplace) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [loading, openModal, openProspectDetails, prospects, searchParams, setSearchParams]);

  const onSubmit = async (data: ProspectInput) => {
    if (!ownerUid) return;

    try {
      setSaving(true);
      const parsed = prospectSchema.parse(data);

      const isWon = isWonProspectStatus(parsed.status);
      const hasRealizedGate = Number(parsed.realizadoValor || 0) > 0 && Boolean(parsed.realizadoData);

      if (isWon && !hasRealizedGate) {
        toastError('Para status ganho, informe valor realizado > 0 e data de realizado.');
        return;
      }

      const result = await saveProspectWithConversion({
        prospectId: selectedProspect?.id,
        data: parsed,
      }, {
        ownerUid,
      });

      if (selectedProspect?.id) {
        setProspects((prev) => prev.map((item) => (item.id === selectedProspect.id ? result.prospect : item)));
        if (result.prospect.converted) {
          toastSuccess('Prospect atualizado e conversão sincronizada com cliente/metas.');
        } else {
          toastSuccess('Prospect atualizado com sucesso!');
        }
      } else {
        setProspects((prev) => [...prev, result.prospect]);
        if (result.prospect.converted) {
          toastSuccess('Prospect criado e convertido em cliente.');
        } else {
          toastSuccess('Prospect criado com sucesso!');
        }
      }

      emitDataInvalidation(['prospects', 'clients', 'captacao', 'metas', 'dashboard']);

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar prospect:', error);
      if (error instanceof Error && error.message === 'PROSPECT_CONVERSION_REQUIREMENTS') {
        toastError('Para converter em cliente, status ganho exige valor realizado > 0 e data preenchida.');
      } else {
        toastError('Erro ao salvar prospect');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ownerUid || !selectedProspect?.id) return;

    try {
      setSaving(true);
      await prospectRepository.delete(selectedProspect.id, ownerUid);
      setProspects((prev) => prev.filter((p) => p.id !== selectedProspect.id));
      toastSuccess('Prospect excluído com sucesso!');
      emitDataInvalidation(['prospects', 'clients', 'captacao', 'metas', 'dashboard']);
      setDeleteModalOpen(false);
      setSelectedProspect(null);
    } catch (error) {
      console.error('Erro ao excluir prospect:', error);
      toastError('Erro ao excluir prospect');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Prospect>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Nome',
        cell: (info) => (
          <button
            type="button"
            onClick={() => openProspectDetails(info.row.original)}
            className="font-medium hover:underline text-left focus-gold rounded-sm"
            style={{ color: 'var(--color-gold)' }}
          >
            {info.getValue() as string}
          </button>
        ),
      },
      {
        accessorKey: 'origem',
        header: 'Origem',
        cell: (info) => {
          const origem = info.getValue() as string;
          return (
            <Badge variant={origem === 'liberta' ? 'success' : 'neutral'}>
              {getOrigemLabel(origem)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'proximoContato',
        header: 'Próx. contato',
        cell: (info) => {
          const prospect = info.row.original;
          const urgency = getContactUrgency(prospect, new Date());
          const dueDate = normalizeDate(prospect.proximoContato);
          if (!dueDate) {
            return <span style={{ color: 'var(--color-text-muted)' }}>Sem próximo passo</span>;
          }
          const hourText = prospect.proximoContatoHora ? ` ${prospect.proximoContatoHora}` : '';

          return (
            <span
              className="flex items-center text-sm"
              style={{
                color:
                  urgency === 'overdue'
                    ? 'var(--color-danger)'
                    : urgency === 'today'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-secondary)',
              }}
            >
              {urgency === 'overdue' && <AlertTriangle className="w-4 h-4 mr-1" />}
              {dueDate.toLocaleDateString('pt-BR')}{hourText}
            </span>
          );
        },
      },
      {
        accessorKey: 'potencial',
        header: 'Pipe atual',
        cell: (info) => {
          const prospect = info.row.original;
          const pipeAtual = getPipeAtualValue(prospect);
          const label = getTipoLabel(prospect.potencialTipo);
          const exceeded = Number(prospect.realizadoValor ?? 0) > Number(prospect.potencial ?? 0);
          return (
            <span style={exceeded ? { color: 'var(--color-warning)' } : undefined}>
              <CurrencyCell value={pipeAtual} /> <span style={{ color: 'var(--color-text-muted)' }}>({label})</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'realizadoValor',
        header: 'Realizado',
        cell: (info) => {
          const value = info.getValue() as number;
          if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
          const label = getTipoLabel(info.row.original.realizadoTipo);
          return (
            <span style={{ color: 'var(--color-success)' }}>
              <CurrencyCell value={value} /> <span>({label})</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as string;
          return <StatusBadge status={getStatusLabel(status)} variant={getStatusVariant(status)} />;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedProspect(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [openModal, openProspectDetails]
  );

  const filteredProspects = useMemo(() => {
    const today = new Date();

    return prospects.filter((prospect) => {
      const normalizedStatus = normalizeProspectStatus(prospect.status);

      if (statusFilter === 'active' && !isProspectAtivo(normalizedStatus)) return false;
      if (statusFilter === 'ganho' && normalizedStatus !== 'ganho') return false;
      if (statusFilter === 'perdido' && normalizedStatus !== 'perdido') return false;

      const urgency = getContactUrgency(prospect, today);
      if (contactFilter === 'overdue' && urgency !== 'overdue') return false;
      if (contactFilter === 'today' && urgency !== 'today') return false;
      if (contactFilter === 'no_next_step' && urgency !== 'none') return false;

      if (origemFilter !== 'all' && prospect.origem !== origemFilter) return false;

      return matchesSearchTerm(prospect, searchTerm);
    });
  }, [contactFilter, origemFilter, prospects, searchTerm, statusFilter]);

  const totalProspectsAtivos = useMemo(() => {
    return prospects.filter((prospect) => isProspectAtivo(prospect.status)).length;
  }, [prospects]);

  const hasSearchFilter = searchTerm.trim().length > 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== DEFAULT_STATUS_FILTER) count += 1;
    if (contactFilter !== DEFAULT_CONTACT_FILTER) count += 1;
    if (origemFilter !== DEFAULT_ORIGEM_FILTER) count += 1;
    if (hasSearchFilter) count += 1;
    return count;
  }, [contactFilter, hasSearchFilter, origemFilter, statusFilter]);

  const hasNonDefaultFilter = activeFilterCount > 0;

  const lembretes = useMemo(() => {
    const today = new Date();
    return filteredProspects.filter((prospect) => {
      const urgency = getContactUrgency(prospect, today);
      return (urgency === 'overdue' || urgency === 'today') && isProspectAtivo(prospect.status);
    });
  }, [filteredProspects]);

  if (loading) {
    return <PageSkeleton showKpis kpiCount={6} />;
  }

  return (
    <PageContainer variant="wide">
      <PageHeader
        title="Prospects"
        subtitle="Pipeline de potenciais clientes"
        actions={(
          <Button
            type="button"
            onClick={() => openModal()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Novo Prospect
          </Button>
        )}
        controls={(
          <>
            <SavedViewsControl
              uid={user?.uid}
              scope="prospects"
              getSnapshot={getSavedViewSnapshot}
              applySnapshot={applySavedViewSnapshot}
              hasExplicitQuery={searchParams.toString().length > 0}
            />

            <div className="w-full space-y-1 sm:min-w-[200px] sm:w-auto">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Visualização
              </span>
              <SegmentedControl
                options={viewModeOptions}
                value={viewMode}
                onChange={(value) => {
                  if (isProspectViewMode(value)) {
                    setViewMode(value);
                  }
                }}
                size="sm"
              />
            </div>

            <div className="w-full space-y-1 sm:min-w-[250px] sm:w-auto">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Status
              </span>
              <SegmentedControl
                options={statusFilterOptions}
                value={statusFilter}
                onChange={(value) => {
                  if (isProspectStatusFilter(value)) {
                    setStatusFilter(value);
                  }
                }}
                size="sm"
              />
            </div>

            <div className="w-full space-y-1 sm:min-w-[280px] sm:w-auto">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Pendência de contato
              </span>
              <SegmentedControl
                options={contactFilterOptions}
                value={contactFilter}
                onChange={(value) => {
                  if (isProspectContactFilter(value)) {
                    setContactFilter(value);
                  }
                }}
                size="sm"
              />
            </div>

            <div className="w-full sm:min-w-[180px] sm:w-auto">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Origem
              </label>
              <select
                value={origemFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  if (isProspectOrigemFilter(value)) {
                    setOrigemFilter(value);
                  }
                }}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <option value="all">Todas</option>
                {PROSPECT_ORIGEM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {viewMode === 'cards' && (
              <div className="w-full sm:min-w-[260px] sm:max-w-[360px]">
                <Input
                  label="Buscar prospect"
                  placeholder="Nome, origem, status..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            )}
          </>
        )}
      />

      {hasNonDefaultFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Filtros ativos
          </span>

          {statusFilter !== DEFAULT_STATUS_FILTER && (
            <Chip
              variant="info"
              onRemove={() => setStatusFilter(DEFAULT_STATUS_FILTER)}
              removeAriaLabel="Remover filtro Status"
            >
              Status: {statusFilterLabels[statusFilter]}
            </Chip>
          )}

          {contactFilter !== DEFAULT_CONTACT_FILTER && (
            <Chip
              variant="warning"
              onRemove={() => setContactFilter(DEFAULT_CONTACT_FILTER)}
              removeAriaLabel="Remover filtro Pendência de contato"
            >
              Pendência: {contactFilterLabels[contactFilter]}
            </Chip>
          )}

          {origemFilter !== DEFAULT_ORIGEM_FILTER && (
            <Chip
              variant="neutral"
              onRemove={() => setOrigemFilter(DEFAULT_ORIGEM_FILTER)}
              removeAriaLabel="Remover filtro Origem"
            >
              Origem: {getOrigemLabel(origemFilter)}
            </Chip>
          )}

          {hasSearchFilter && (
            <Chip
              variant="neutral"
              onRemove={() => setSearchTerm('')}
              removeAriaLabel="Limpar busca"
            >
              Busca: {searchTerm.trim()}
            </Chip>
          )}

          {activeFilterCount >= 2 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearProspectFilters}
            >
              Limpar tudo
            </Button>
          )}
        </div>
      )}

      <ProspectKpiSummary
        prospects={filteredProspects}
        reminders={lembretes}
        onOpenProspect={(prospect) => openProspectDetails(prospect)}
      />

      <SectionCard
        title={viewMode === 'cards' ? 'Board de Prospects' : 'Tabela de Prospects'}
        subtitle={
          viewMode === 'cards'
            ? 'Visão por status com priorização por urgência de contato'
            : `${filteredProspects.length} prospect(s) após filtros`
        }
      >
        {filteredProspects.length === 0 ? (
          totalProspectsAtivos === 0
            && statusFilter === DEFAULT_STATUS_FILTER
            && contactFilter === DEFAULT_CONTACT_FILTER
            && origemFilter === DEFAULT_ORIGEM_FILTER
            && !hasSearchFilter ? (
              <EmptyState
                title="Nenhum prospect no pipeline"
                description="Adicione prospects para começar o acompanhamento comercial."
                action={{
                  label: 'Novo prospect',
                  onClick: () => openModal(),
                }}
              />
            ) : (
              <EmptyState
                title="Nenhum prospect corresponde aos filtros"
                description="Ajuste os filtros ativos ou limpe os critérios para ampliar os resultados."
                action={{
                  label: 'Limpar filtros',
                  onClick: clearProspectFilters,
                }}
              />
            )
        ) : viewMode === 'cards' ? (
          <ProspectBoardView
            prospects={filteredProspects}
            interacoesByProspect={interacoesByProspect}
            onOpenDetails={(prospect) => openProspectDetails(prospect)}
            onEdit={openModal}
            onDelete={(prospect) => {
              setSelectedProspect(prospect);
              setDeleteModalOpen(true);
            }}
            onQuickAddInteracao={(prospect) => openProspectDetails(prospect, true)}
          />
        ) : (
          <DataTable
            data={filteredProspects}
            columns={columns}
            searchPlaceholder="Buscar prospects..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            sortingState={tableSorting}
            onSortingChange={setTableSorting}
          />
        )}
      </SectionCard>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedProspect ? 'Editar Prospect' : 'Novo Prospect'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome *"
              {...register('nome')}
              error={errors.nome?.message}
            />
            <Input
              label="CPF/CNPJ"
              {...register('cpfCnpj')}
              error={errors.cpfCnpj?.message}
            />
            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Telefone"
              {...register('telefone')}
              error={errors.telefone?.message}
            />
            <Select
              label="Origem"
              options={PROSPECT_ORIGEM_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              {...register('origem')}
              error={errors.origem?.message}
            />
            <Select
              label="Status"
              options={PROSPECT_STATUS_COLUMNS.map((option) => ({ value: option.value, label: option.label }))}
              {...register('status')}
              error={errors.status?.message}
            />
            <Input
              label="Potencial (R$)"
              type="number"
              step="0.01"
              {...register('potencial', { valueAsNumber: true })}
              error={errors.potencial?.message}
            />
            <Select
              label="Tipo Potencial"
              options={PROSPECT_TIPO_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              {...register('potencialTipo')}
            />
            <Input
              label="Probabilidade (%)"
              type="number"
              min="0"
              max="100"
              {...register('probabilidade', { valueAsNumber: true })}
              error={errors.probabilidade?.message}
            />
            <Input
              label="Data do Contato"
              type="date"
              {...register('dataContato')}
              error={errors.dataContato?.message}
            />
            <Input
              label="Próximo contato"
              type="date"
              {...register('proximoContato')}
              error={errors.proximoContato?.message}
            />
            <Input
              label="Hora"
              type="time"
              {...register('proximoContatoHora')}
            />
          </div>

          {/* Realizado */}
          <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h4 className="font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>Realizado (quando convertido)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Valor Realizado"
                type="number"
                step="0.01"
                {...register('realizadoValor', { valueAsNumber: true })}
              />
              <Select
                label="Tipo Realizado"
                options={PROSPECT_TIPO_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                {...register('realizadoTipo')}
              />
              <Input
                label="Data Realizado"
                type="date"
                {...register('realizadoData')}
              />
            </div>
            {isWonSelected && !(Number(realizadoValorWatch || 0) > 0 && Boolean(realizadoDataWatch)) && (
              <p className="mt-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                Status ganho exige valor realizado maior que zero e data de realizado.
              </p>
            )}
            {!isWonSelected && (Number(realizadoValorWatch || 0) > 0 || Boolean(realizadoDataWatch)) && (
              <p className="mt-2 text-sm" style={{ color: 'var(--color-warning)' }}>
                Defina status como ganho para converter este prospect em cliente.
              </p>
            )}
          </div>

          <TextArea
            label="Observações"
            {...register('observacoes')}
            error={errors.observacoes?.message}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {selectedProspect ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Prospect"
        message="Tem certeza que deseja excluir este prospect? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
        loading={saving}
      />

      {/* Modal de Detalhes do Prospect */}
      {selectedProspect && (
        <ProspectDetalhesModal
          isOpen={detalhesModalOpen}
          onClose={() => setDetalhesModalOpen(false)}
          prospect={selectedProspect}
          interacoes={interacoes.filter((i) => i.prospectId === selectedProspect.id)}
          focusAddInteractionToken={focusInteractionToken}
          onInteracaoSaved={(i) => setInteracoes((prev) => {
            const idx = prev.findIndex((x) => x.id === i.id);
            return idx >= 0 ? prev.map((x) => (x.id === i.id ? i : x)) : [...prev, i];
          })}
          onInteracaoDeleted={(id) => setInteracoes((prev) => prev.filter((x) => x.id !== id))}
        />
      )}
    </PageContainer>
  );
}

// ============== MODAL DE DETALHES DO PROSPECT ==============
interface DetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: Prospect;
  interacoes: ProspectInteracao[];
  focusAddInteractionToken: number;
  onInteracaoSaved: (i: ProspectInteracao) => void;
  onInteracaoDeleted: (id: string) => void;
}

function ProspectDetalhesModal({
  isOpen,
  onClose,
  prospect,
  interacoes,
  focusAddInteractionToken,
  onInteracaoSaved,
  onInteracaoDeleted,
}: DetalhesModalProps) {
  const { user } = useAuth();
  const [novaInteracao, setNovaInteracao] = useState({ tipo: 'ligacao', data: '', resumo: '' });
  const [saving, setSaving] = useState(false);
  const resumoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (focusAddInteractionToken === 0) return;

    const todayDate = new Date().toISOString().split('T')[0];
    setNovaInteracao((current) => ({ ...current, data: todayDate }));

    requestAnimationFrame(() => {
      resumoInputRef.current?.focus();
    });
  }, [focusAddInteractionToken, isOpen]);

  const handleAddInteracao = async () => {
    if (!user || !prospect.id || !novaInteracao.data) return;
    try {
      setSaving(true);
      const created = await prospectInteracaoRepository.create({
        prospectId: prospect.id,
        tipo: novaInteracao.tipo as 'ligacao' | 'reuniao' | 'email' | 'whatsapp' | 'visita' | 'outro',
        data: novaInteracao.data,
        resumo: novaInteracao.resumo,
      }, user.uid);
      onInteracaoSaved(created);
      setNovaInteracao({ tipo: 'ligacao', data: '', resumo: '' });
      toastSuccess('interação adicionada!');
    } catch {
      toastError('Erro ao adicionar interação');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInteracao = async (id: string) => {
    if (!user) return;
    try {
      await prospectInteracaoRepository.delete(id, user.uid);
      onInteracaoDeleted(id);
      toastSuccess('interação excluída!');
    } catch {
      toastError('Erro ao excluir interação');
    }
  };

  const sortedInteracoes = [...interacoes].sort((a, b) => {
    const byDate = (normalizeDate(b.data)?.getTime() ?? 0) - (normalizeDate(a.data)?.getTime() ?? 0);
    if (byDate !== 0) return byDate;
    return (normalizeDate(b.updatedAt)?.getTime() ?? 0) - (normalizeDate(a.updatedAt)?.getTime() ?? 0);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes: ${prospect.nome}`} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 rounded-lg p-4 text-sm md:grid-cols-2" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Origem:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{getOrigemLabel(prospect.origem)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>{' '}
            <Badge variant={normalizeProspectStatus(prospect.status) === 'ganho' ? 'success' : normalizeProspectStatus(prospect.status) === 'perdido' ? 'danger' : 'neutral'}>
              {getStatusLabel(prospect.status)}
            </Badge>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Potencial:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              {formatCurrency(prospect.potencial || 0)} ({getTipoLabel(prospect.potencialTipo)})
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Pipe atual:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-info)' }}>
              {formatCurrency(getPipeAtualValue(prospect))}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Realizado:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-success)' }}>
              {formatCurrency(prospect.realizadoValor || 0)} ({getTipoLabel(prospect.realizadoTipo)})
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Próx. contato:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              {prospect.proximoContato
                ? `${new Date(`${prospect.proximoContato}T00:00:00`).toLocaleDateString('pt-BR')} ${prospect.proximoContatoHora || ''}`
                : 'Sem próximo passo'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Telefone:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{prospect.telefone || '-'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Convertido:</span>{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{prospect.converted ? 'Sim' : 'Não'}</span>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Adicionar interação</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select
              label="Tipo"
              options={interacaoTipoOptions}
              value={novaInteracao.tipo}
              onChange={(event) => setNovaInteracao((current) => ({ ...current, tipo: event.target.value }))}
            />
            <Input
              label="Data *"
              type="date"
              value={novaInteracao.data}
              onChange={(event) => setNovaInteracao((current) => ({ ...current, data: event.target.value }))}
            />
            <Input
              ref={resumoInputRef}
              label="Resumo"
              value={novaInteracao.resumo}
              onChange={(event) => setNovaInteracao((current) => ({ ...current, resumo: event.target.value }))}
              placeholder="Resumo da interação"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleAddInteracao}
              loading={saving}
              disabled={!novaInteracao.data}
            >
              Adicionar interação
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Histórico de contatos ({interacoes.length})</h4>
          {sortedInteracoes.length === 0 ? (
            <InlineEmpty message="Nenhuma interação registrada." />
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {sortedInteracoes.map((interacao) => (
                <div
                  key={interacao.id}
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{ backgroundColor: 'var(--color-surface-2)' }}
                >
                  <div style={{ color: 'var(--color-gold)' }}>
                    {interacaoIcons[interacao.tipo] || <Bell className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {interacaoTipoOptions.find((option) => option.value === interacao.tipo)?.label || interacao.tipo}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {normalizeDate(interacao.data)?.toLocaleDateString('pt-BR') || '-'}
                      </span>
                    </div>
                    {interacao.resumo && (
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {interacao.resumo}
                      </p>
                    )}
                  </div>
                  {interacao.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteInteracao(interacao.id as string)}
                    >
                      Excluir
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}



