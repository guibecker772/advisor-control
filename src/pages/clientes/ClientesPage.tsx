import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { clienteRepository, clienteReuniaoRepository } from '../../services/repositories';
import { clienteSchema, type Cliente, type ClienteInput, type ClienteReuniao } from '../../domain/types';
import { calcularCustodiaTotal, formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  KpiCard,
  PageContainer,
  PageHeader,
  PageSkeleton,
  SectionCard,
  SegmentedControl,
  Tooltip,
} from '../../components/ui';
import SavedViewsControl from '../../components/saved-views/SavedViewsControl';
import Client360Drawer from '../../components/clientes/Client360Drawer';
import ClientImportWizardDialog from '../../components/clientes/ClientImportWizardDialog';
import { type SavedViewSnapshot } from '../../lib/savedViews';
import { resolveAccessCapabilities } from '../../lib/access';
import { subscribeDataInvalidation } from '../../lib/dataInvalidation';
import {
  parsePerfilFiltro,
  parsePerfilFromQuery,
  type PerfilFiltro,
  type PerfilInvestidor,
} from './utils/perfilFiltro';

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'prospecto', label: 'Prospecto' },
];

const origemOptions = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'captacao', label: 'Captação Ativa' },
  { value: 'migracao', label: 'Migração' },
  { value: 'evento', label: 'Evento' },
  { value: 'outros', label: 'Outros' },
];

const perfilOptions = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Qualificado', label: 'Qualificado' },
  { value: 'Profissional', label: 'Profissional' },
];

const perfilFiltroOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Qualificado', label: 'Qualificado' },
  { value: 'Profissional', label: 'Profissional' },
];

const PERFIL_FILTRO_STORAGE_KEY = 'advisor_control.clients.perfilFiltro';

function getPerfilInvestidor(cliente: Cliente): PerfilInvestidor {
  if (cliente.perfilInvestidor === 'Qualificado' || cliente.perfilInvestidor === 'Profissional') {
    return cliente.perfilInvestidor;
  }
  return 'Regular';
}

function getPerfilBadgeVariant(perfil: PerfilInvestidor): 'neutral' | 'info' | 'purple' {
  if (perfil === 'Qualificado') return 'info';
  if (perfil === 'Profissional') return 'purple';
  return 'neutral';
}

function isReviewPendingClient(cliente: Cliente): boolean {
  const reviewPendingFromCustomField = cliente.customFields?.reviewPending === true;
  const reviewPendingFromTag = (cliente.tags ?? []).some((tag) => tag.toLowerCase().includes('revis'));
  return reviewPendingFromCustomField || reviewPendingFromTag;
}

export default function ClientesPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [reunioes, setReunioes] = useState<ClienteReuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSorting, setTableSorting] = useState<SortingState>([]);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const handledQueryRef = useRef<string | null>(null);
  const access = useMemo(() => resolveAccessCapabilities(user), [user]);
  const reviewPendingOnly = searchParams.get('reviewPending') === '1';
  const [perfilFiltro, setPerfilFiltro] = useState<PerfilFiltro>('all');
  
  // Filtros de período
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      status: 'ativo',
      custodiaInicial: 0,
      custodiaAtual: 0,
    },
  });

  // Carregar clientes e reuniões
  useEffect(() => {
    if (authLoading) return;
    if (!ownerUid) {
      setClientes([]);
      setReunioes([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [clientesData, reunioesData] = await Promise.all([
          clienteRepository.getAll(ownerUid),
          clienteReuniaoRepository.getByMonth(ownerUid, mesFiltro, anoFiltro),
        ]);
        setClientes(clientesData);
        setReunioes(reunioesData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, ownerUid, mesFiltro, anoFiltro, refreshSeq]);

  useEffect(() => {
    return subscribeDataInvalidation(['clients'], () => {
      setRefreshSeq((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPerfilFiltro = parsePerfilFiltro(window.localStorage.getItem(PERFIL_FILTRO_STORAGE_KEY));
    if (storedPerfilFiltro) {
      setPerfilFiltro(storedPerfilFiltro);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PERFIL_FILTRO_STORAGE_KEY, perfilFiltro);
  }, [perfilFiltro]);

  useEffect(() => {
    const perfilFromQuery = parsePerfilFromQuery(searchParams.get('perfil'));
    if (!perfilFromQuery) return;

    setPerfilFiltro(perfilFromQuery);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('perfil');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Mapa de reuniões por clienteId
  const reunioesMap = useMemo(() => {
    const map: Record<string, ClienteReuniao> = {};
    reunioes.forEach(r => { if (r.clienteId) map[r.clienteId] = r; });
    return map;
  }, [reunioes]);

  // Abrir modal para criar/editar
  const openModal = useCallback((cliente?: Cliente) => {
    if (cliente) {
      setSelectedCliente(cliente);
      reset(cliente);
    } else {
      setSelectedCliente(null);
      reset({
        nome: '',
        email: '',
        telefone: '',
        cpfCnpj: '',
        codigoConta: '',
        perfilInvestidor: 'Regular',
        status: 'ativo',
        origem: '',
        custodiaInicial: 0,
        custodiaAtual: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  }, [reset]);

  const getSavedViewSnapshot = useCallback((): SavedViewSnapshot => {
    const firstSort = tableSorting[0];
    return {
      searchTerm: tableSearch,
      filters: {
        mesFiltro,
        anoFiltro,
        perfilFiltro,
      },
      sort: firstSort ? { id: firstSort.id, desc: firstSort.desc } : null,
    };
  }, [anoFiltro, mesFiltro, perfilFiltro, tableSearch, tableSorting]);

  const applySavedViewSnapshot = useCallback((snapshot: SavedViewSnapshot) => {
    setTableSearch(snapshot.searchTerm ?? '');
    setTableSorting(snapshot.sort ? [{ id: snapshot.sort.id, desc: snapshot.sort.desc }] : []);

    const mes = Number(snapshot.filters?.mesFiltro);
    const ano = Number(snapshot.filters?.anoFiltro);
    const perfil = parsePerfilFiltro(
      typeof snapshot.filters?.perfilFiltro === 'string'
        ? snapshot.filters.perfilFiltro
        : null,
    );
    if (!Number.isNaN(mes) && mes >= 1 && mes <= 12) {
      setMesFiltro(mes);
    }
    if (!Number.isNaN(ano) && ano >= 1900) {
      setAnoFiltro(ano);
    }
    if (perfil) {
      setPerfilFiltro(perfil);
    }
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
      const target = clientes.find((cliente) => cliente.id === openParam);
      if (target) {
        setSelectedCliente(target);
        setDetalhesModalOpen(true);
      }
      nextParams.delete('open');
      shouldReplace = true;
    }

    if (shouldReplace) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [clientes, loading, openModal, searchParams, setSearchParams]);

  const clearReviewPendingFilter = useCallback(() => {
    if (!reviewPendingOnly) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('reviewPending');
    setSearchParams(nextParams, { replace: true });
  }, [reviewPendingOnly, searchParams, setSearchParams]);

  const clearAllActiveFilters = useCallback(() => {
    setPerfilFiltro('all');
    clearReviewPendingFilter();
  }, [clearReviewPendingFilter]);

  // Salvar cliente
  const onSubmit = async (data: ClienteInput) => {
    if (!ownerUid) return;

    try {
      setSaving(true);
      const parsed = clienteSchema.parse(data);

      if (selectedCliente?.id) {
        const updated = await clienteRepository.update(selectedCliente.id, parsed, ownerUid);
        if (updated) {
          setClientes((prev) =>
            prev.map((c) => (c.id === selectedCliente.id ? updated : c))
          );
          toast.success('Cliente atualizado com sucesso!');
        }
      } else {
        const created = await clienteRepository.create(parsed, ownerUid);
        setClientes((prev) => [...prev, created]);
        toast.success('Cliente criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  // Excluir cliente
  const handleDelete = async () => {
    if (!ownerUid || !selectedCliente?.id) return;

    try {
      setSaving(true);
      await clienteRepository.delete(selectedCliente.id, ownerUid);
      setClientes((prev) => prev.filter((c) => c.id !== selectedCliente.id));
      toast.success('Cliente excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedCliente(null);
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    } finally {
      setSaving(false);
    }
  };

  // Colunas da tabela
  const columns = useMemo<ColumnDef<Cliente>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Nome',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedCliente(info.row.original); setDetalhesModalOpen(true); }}
              className="font-medium hover:underline text-left"
              style={{ color: 'var(--color-gold)' }}
            >
              {info.getValue() as string}
            </button>
            {(info.row.original.tags ?? []).includes('Convertido') && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              >
                Convertido
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'codigoConta',
        header: 'Cód. Conta',
        cell: (info) => <span className="font-mono text-sm">{(info.getValue() as string) || '-'}</span>,
      },
      {
        accessorKey: 'perfilInvestidor',
        header: 'Perfil',
        cell: (info) => {
          const perfil = getPerfilInvestidor(info.row.original);
          return <Badge variant={getPerfilBadgeVariant(perfil)}>{perfil}</Badge>;
        },
      },
      {
        id: 'reuniao',
        header: 'Reunião',
        cell: (info) => {
          const clienteId = info.row.original.id;
          const reuniao = clienteId ? reunioesMap[clienteId] : undefined;
          return reuniao?.realizada ? (
            <span className="flex items-center text-sm" style={{ color: 'var(--color-success)' }}><CheckCircle className="w-4 h-4 mr-1" />Sim</span>
          ) : (
            <span className="flex items-center text-sm" style={{ color: 'var(--color-text-muted)' }}><XCircle className="w-4 h-4 mr-1" />Não</span>
          );
        },
      },
      {
        accessorKey: 'custodiaAtual',
        header: 'Custódia',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'indicadores',
        header: 'Indicadores',
        cell: (info) => {
          const c = info.row.original;
          const clienteId = c.id;
          const tem_reuniao = clienteId ? reunioesMap[clienteId]?.realizada : false;
          const custodia = c.custodiaAtual ?? 0;
          const badges: { emoji: string; label: string; color: string }[] = [];

          if (!tem_reuniao) {
            badges.push({ emoji: '💤', label: 'Sem reunião', color: 'var(--color-warning)' });
          }
          if (custodia > 500_000) {
            badges.push({ emoji: '💰', label: 'Alto potencial', color: 'var(--color-gold)' });
          }

          if (badges.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                  title={b.label}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${b.color} 15%, transparent)`,
                    color: b.color,
                  }}
                >
                  {b.emoji}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as string;
          const variant = status === 'ativo' ? 'success' : status === 'inativo' ? 'danger' : 'warning';
          return <StatusBadge status={status} variant={variant} />;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedCliente(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [openModal, reunioesMap]
  );

  // Calcular totais
  const filteredClientes = useMemo(() => {
    const clientesPorRevisao = reviewPendingOnly
      ? clientes.filter(isReviewPendingClient)
      : clientes;

    if (perfilFiltro === 'all') {
      return clientesPorRevisao;
    }

    return clientesPorRevisao.filter(
      (cliente) => getPerfilInvestidor(cliente) === perfilFiltro,
    );
  }, [clientes, perfilFiltro, reviewPendingOnly]);

  const totais = useMemo(() => {
    const ativos = filteredClientes.filter((c) => c.status === 'ativo');
    const qualificados = filteredClientes.filter(
      (cliente) => getPerfilInvestidor(cliente) === 'Qualificado',
    );
    const profissionais = filteredClientes.filter(
      (cliente) => getPerfilInvestidor(cliente) === 'Profissional',
    );
    const custodiaTotal = calcularCustodiaTotal(filteredClientes);

    return {
      total: filteredClientes.length,
      ativos: ativos.length,
      qualificados: qualificados.length,
      profissionais: profissionais.length,
      custodiaTotal,
    };
  }, [filteredClientes]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (perfilFiltro !== 'all') count += 1;
    if (reviewPendingOnly) count += 1;
    return count;
  }, [perfilFiltro, reviewPendingOnly]);

  if (loading) {
    return (
      <PageContainer variant="wide">
        <PageSkeleton showKpis kpiCount={5} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie sua carteira de clientes"
        actions={(
          <div className="flex items-center gap-2">
            <Tooltip content="Sem permissão para importar clientes" disabled={access.canImportClients}>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setImportWizardOpen(true)}
                  disabled={!access.canImportClients}
                >
                  Importar
                </Button>
              </span>
            </Tooltip>
            <Button
              type="button"
              onClick={() => openModal()}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Novo Cliente
            </Button>
          </div>
        )}
        controls={(
          <>
            <select
              value={mesFiltro}
              onChange={(event) => setMesFiltro(Number(event.target.value))}
              className="w-full rounded-md px-3 py-2 text-sm sm:w-auto"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {new Date(2000, index).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={anoFiltro}
              onChange={(event) => setAnoFiltro(Number(event.target.value))}
              className="w-full rounded-md px-3 py-2 text-sm sm:w-auto"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              {[2024, 2025, 2026, 2027].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <div className="w-full flex flex-col gap-1 sm:min-w-[280px] sm:w-auto">
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Perfil
              </span>
              <SegmentedControl
                options={perfilFiltroOptions}
                value={perfilFiltro}
                onChange={(value) => {
                  const nextPerfilFiltro = parsePerfilFiltro(value);
                  if (nextPerfilFiltro) {
                    setPerfilFiltro(nextPerfilFiltro);
                  }
                }}
                size="sm"
              />
            </div>
            <SavedViewsControl
              uid={user?.uid}
              scope="clients"
              getSnapshot={getSavedViewSnapshot}
              applySnapshot={applySavedViewSnapshot}
              hasExplicitQuery={searchParams.toString().length > 0}
            />
          </>
        )}
      />

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Filtros ativos
          </span>
          {perfilFiltro !== 'all' && (
            <Chip
              variant="info"
              onRemove={() => setPerfilFiltro('all')}
              removeAriaLabel="Remover filtro Perfil"
            >
              Perfil: {perfilFiltro}
            </Chip>
          )}
          {reviewPendingOnly && (
            <Chip
              variant="warning"
              onRemove={clearReviewPendingFilter}
              removeAriaLabel="Remover filtro revisão pendente"
            >
              revisão pendente
            </Chip>
          )}
          {activeFilterCount >= 2 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearAllActiveFilters}
            >
              Limpar tudo
            </Button>
          )}
        </div>
      )}

      <SectionCard
        title="Resumo da carteira"
        subtitle="Valores atualizados com os filtros de revisão pendente e perfil"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            title="Total"
            value={totais.total}
            subtitle="Clientes no filtro"
            accentColor="info"
            layout="wide"
          />
          <KpiCard
            title="Ativos"
            value={totais.ativos}
            subtitle="Status ativo"
            accentColor="success"
            layout="wide"
          />
          <KpiCard
            title="Qualificados"
            value={totais.qualificados}
            subtitle="Perfil qualificado"
            accentColor="gold"
            layout="wide"
          />
          <KpiCard
            title="Profissionais"
            value={totais.profissionais}
            subtitle="Perfil profissional"
            accentColor="warning"
            layout="wide"
          />
          <KpiCard
            title="Custódia total"
            value={formatCurrency(totais.custodiaTotal)}
            subtitle="Soma da carteira filtrada"
            accentColor="gold"
            layout="wide"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Carteira de clientes"
        subtitle={`${filteredClientes.length} cliente(s) com os filtros atuais`}
      >
        {filteredClientes.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Tente remover filtros ou cadastre um novo cliente."
            action={{
              label: 'Novo cliente',
              onClick: () => openModal(),
            }}
            secondaryAction={reviewPendingOnly ? {
              label: 'Limpar filtro de revisão',
              onClick: clearReviewPendingFilter,
            } : undefined}
          />
        ) : (
          <DataTable
            data={filteredClientes}
            columns={columns}
            searchPlaceholder="Buscar clientes..."
            searchValue={tableSearch}
            onSearchChange={setTableSearch}
            sortingState={tableSorting}
            onSortingChange={setTableSorting}
          />
        )}
      </SectionCard>

      {/* Modal de criação/edição */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCliente ? 'Editar Cliente' : 'Novo Cliente'}
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
              label="Código da Conta"
              {...register('codigoConta')}
              error={errors.codigoConta?.message}
            />
            <Input
              label="CPF/CNPJ"
              {...register('cpfCnpj')}
              error={errors.cpfCnpj?.message}
            />
            <Select
              label="Perfil do Investidor"
              options={perfilOptions}
              {...register('perfilInvestidor')}
              error={errors.perfilInvestidor?.message}
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
              label="Status"
              options={statusOptions}
              {...register('status')}
              error={errors.status?.message}
            />
            <Select
              label="Origem"
              options={origemOptions}
              {...register('origem')}
              error={errors.origem?.message}
            />
            <Input
              label="Custódia Inicial"
              type="number"
              step="0.01"
              {...register('custodiaInicial', { valueAsNumber: true })}
              error={errors.custodiaInicial?.message}
            />
            <Input
              label="Custódia Atual"
              type="number"
              step="0.01"
              {...register('custodiaAtual', { valueAsNumber: true })}
              error={errors.custodiaAtual?.message}
            />
            <Input
              label="Data de Entrada"
              type="date"
              {...register('dataEntrada')}
              error={errors.dataEntrada?.message}
            />
            <Input
              label="Assessor"
              {...register('assessor')}
              error={errors.assessor?.message}
            />
          </div>

          <TextArea
            label="ObservAções"
            {...register('observacoes')}
            error={errors.observacoes?.message}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
            >
              {selectedCliente ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmDelete
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        loading={saving}
      />

      <ClientImportWizardDialog
        isOpen={importWizardOpen}
        user={user}
        ownerUid={ownerUid}
        onClose={() => setImportWizardOpen(false)}
        onImportFinished={async () => {
          if (!ownerUid) return;
          const clientesAtualizados = await clienteRepository.getAll(ownerUid);
          setClientes(clientesAtualizados);
        }}
        onOpenReviewPending={() => {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set('reviewPending', '1');
          setSearchParams(nextParams);
          setImportWizardOpen(false);
        }}
      />

      {/* Client 360 Drawer */}
      {selectedCliente && (
        <Client360Drawer
          isOpen={detalhesModalOpen}
          onClose={() => setDetalhesModalOpen(false)}
          cliente={selectedCliente}
          mes={mesFiltro}
          ano={anoFiltro}
          reuniao={selectedCliente.id ? reunioesMap[selectedCliente.id] : undefined}
          onReuniaoSaved={(r) => setReunioes((prev) => {
            const idx = prev.findIndex((x) => x.id === r.id);
            return idx >= 0 ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
          })}
        />
      )}
    </PageContainer>
  );
}





