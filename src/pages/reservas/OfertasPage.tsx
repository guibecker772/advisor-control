import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Users, CheckCircle, Trash2, AlertCircle, X, Edit3, Save, Link as LinkIcon, FileText, CircleAlert } from 'lucide-react';
import { toastSuccess, toastError } from '../../lib/toast';
import { emitDataInvalidation, subscribeDataInvalidation, type InvalidationScope } from '../../lib/dataInvalidation';

import { useAuth } from '../../contexts/AuthContext';
import { resolveAccessCapabilities } from '../../lib/access';
import { clienteRepository } from '../../services/repositories';
import {
  applyReservationToOfferSnapshot,
  createOfferReservation,
  deleteOfferReservation,
  listOffers,
  updateOfferReservation,
} from '../../services/offerReservationService';
import {
  clienteSchema,
  offerReservationSchema,
  offerReservationFormSchema,
  calcOfferReservationTotals,
  classeAtivoOptions,
  type OfferReservation,
  type OfferReservationFormInput,
  type OfferAttachmentLink,
  type Cliente,
} from '../../domain/types';
import {
  canAcceptNewReservations,
  formatCompetenceMonthPtBr,
  getCurrentCompetenceMonth,
  getOfferAudienceLabel,
  getOfferStatusLabel,
  isLiquidationMomentExpired,
  isLiquidated,
  isReservationWindowExpired,
  normalizeCompetenceMonth,
  normalizeOfferStatus,
} from '../../domain/offers';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Badge, BaseCard, Button, Modal, ConfirmDialog, PageHeader, PageSkeleton, Tabs, Tooltip } from '../../components/ui';
import { Input, Select, TextArea } from '../../components/shared/FormFields';
import ClientSelect from '../../components/clientes/ClientSelect';

// Helpers para conversão decimal <-> percentual na UI
const toPercentDisplay = (decimal: number | undefined): number => {
  if (decimal === undefined || decimal === null) return 0;
  // Se valor > 1, já está em %, senão converter
  return decimal > 1 ? decimal : decimal * 100;
};
const toDecimalFromPercent = (percent: number | undefined): number => {
  if (percent === undefined || percent === null) return 0;
  // Se valor > 1, dividir por 100, senão já está decimal
  return percent > 1 ? percent / 100 : percent;
};

const commissionModeOptions = [
  { value: 'ROA_PERCENT', label: 'ROA (% sobre alocação)' },
  { value: 'FIXED_REVENUE', label: 'Receita Fixa (R$)' },
];

const classeAtivoSelectOptions = [
  { value: '', label: 'Selecione...' },
  ...classeAtivoOptions.map((c) => ({ value: c, label: c })),
];

const offerStatusSelectOptions = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'RESERVADA', label: 'Reservada' },
  { value: 'LIQUIDADA', label: 'Liquidada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const offerAudienceSelectOptions = [
  { value: 'GENERAL', label: 'Geral' },
  { value: 'QUALIFIED', label: 'Qualificado' },
];

const offerTypeOptions = [
  { value: 'PRIVATE', label: 'Privada' },
  { value: 'PUBLIC', label: 'Oferta Pública' },
];

const quickClientProfileOptions = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'QUALIFIED', label: 'Qualificado' },
  { value: 'PROFESSIONAL', label: 'Profissional' },
];

function getTodaySaoPauloDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function normalizePhone(value: string | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function normalizeEmail(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

export default function OfertasPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [searchParams] = useSearchParams();
  const access = useMemo(() => resolveAccessCapabilities(user), [user]);
  const [ofertas, setOfertas] = useState<OfferReservation[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfferReservation | null>(null);
  const [saving, setSaving] = useState(false);
  const [competenceMonthFiltro, setCompetenceMonthFiltro] = useState<string>(getCurrentCompetenceMonth());
  const queryCompetenceMonth = searchParams.get('competenceMonth');

  useEffect(() => {
    if (!queryCompetenceMonth) return;
    setCompetenceMonthFiltro(normalizeCompetenceMonth(queryCompetenceMonth, new Date().toISOString()));
  }, [queryCompetenceMonth]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<OfferReservationFormInput>({
    resolver: zodResolver(offerReservationFormSchema),
    defaultValues: {
      classeAtivo: 'Outros',
      offerType: 'PRIVATE',
      minimumInvestment: 0,
      reservationEndDate: '',
      assetClass: 'OUTROS',
      audience: 'GENERAL',
      status: 'PENDENTE',
      competenceMonth: getCurrentCompetenceMonth(),
      commissionMode: 'ROA_PERCENT',
      roaPercent: 2,       // UI em % (será convertido para 0.02 no submit)
      revenueFixed: 0,
      repassePercent: 25,  // UI em % (será convertido para 0.25 no submit)
      irPercent: 19,       // UI em % (será convertido para 0.19 no submit)
      reservaEfetuada: false,
      reservaLiquidada: false,
      clientes: [],
      summary: '',
      attachments: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'clientes',
  });

  const commissionMode = watch('commissionMode');

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setOfertas([]);
      setClientes([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [ofertaData, clienteData] = await Promise.all([
        listOffers(ownerUid),
        clienteRepository.getAll(ownerUid),
      ]);
      setOfertas(ofertaData);
      setClientes(clienteData);
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
    return subscribeDataInvalidation(['offers', 'salary'], async () => {
      await loadData();
    });
  }, [authLoading, loadData, ownerUid]);

  const clientSelectOptions = useMemo(
    () => clientes
      .filter((c) => Boolean(c.id))
      .map((c) => ({
        value: c.id || '',
        label: c.nome,
        hint: [c.cpfCnpj, c.codigoConta, c.email, c.telefone].filter(Boolean).join(' | '),
        searchText: [c.nome, c.cpfCnpj, c.codigoConta, c.email, c.telefone].filter(Boolean).join(' '),
      })),
    [clientes],
  );

  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter((o) => normalizeCompetenceMonth(o.competenceMonth, o.dataReserva || o.createdAt) === competenceMonthFiltro);
  }, [ofertas, competenceMonthFiltro]);

  const openModal = useCallback(
    (oferta?: OfferReservation) => {
      if (oferta) {
        setSelectedOferta(oferta);
        reset({
          ...oferta,
          classeAtivo: oferta.classeAtivo || 'Outros',
          offerType: oferta.offerType || 'PRIVATE',
          minimumInvestment: oferta.minimumInvestment || 0,
          reservationEndDate: oferta.reservationEndDate || '',
          assetClass: oferta.assetClass || 'OUTROS',
          audience: oferta.audience || 'GENERAL',
          status: oferta.status || 'PENDENTE',
          competenceMonth: normalizeCompetenceMonth(oferta.competenceMonth, oferta.dataReserva || oferta.createdAt),
          liquidationDate: oferta.liquidationDate || oferta.dataLiquidacao || '',
          dataLiquidacao: oferta.liquidationDate || oferta.dataLiquidacao || '',
          // Converter decimal -> % para exibi??o na UI
          roaPercent: toPercentDisplay(oferta.roaPercent),
          repassePercent: toPercentDisplay(oferta.repassePercent),
          irPercent: toPercentDisplay(oferta.irPercent),
          clientes: oferta.clientes || [],
          summary: oferta.summary || '',
          attachments: oferta.attachments || [],
        });
      } else {
        setSelectedOferta(null);
        reset({
          nomeAtivo: '',
          classeAtivo: 'Outros',
          offerType: 'PRIVATE',
          minimumInvestment: 0,
          reservationEndDate: '',
          assetClass: 'OUTROS',
          audience: 'GENERAL',
          status: 'PENDENTE',
          competenceMonth: competenceMonthFiltro,
          commissionMode: 'ROA_PERCENT',
          roaPercent: 2,       // UI em %
          revenueFixed: 0,
          repassePercent: 25,  // UI em %
          irPercent: 19,       // UI em %
          dataReserva: new Date().toISOString().split('T')[0],
          dataLiquidacao: '',
          liquidationDate: '',
          reservaEfetuada: false,
          reservaLiquidada: false,
          clientes: [],
          summary: '',
          attachments: [],
          observacoes: '',
        });
      }
      setModalOpen(true);
    },
    [reset, competenceMonthFiltro]
  );

  const onSubmit = async (data: OfferReservationFormInput) => {
    if (!ownerUid) return;
    try {
      setSaving(true);
      
      // Converter percentuais de UI (%) -> banco (decimal) antes de validar
      const dataWithDecimals = {
        ...data,
        competenceMonth: normalizeCompetenceMonth(data.competenceMonth, data.dataReserva || new Date().toISOString()),
        liquidationDate: data.liquidationDate || data.dataLiquidacao || undefined,
        dataLiquidacao: data.liquidationDate || data.dataLiquidacao || undefined,
        roaPercent: toDecimalFromPercent(data.roaPercent),
        repassePercent: toDecimalFromPercent(data.repassePercent),
        irPercent: toDecimalFromPercent(data.irPercent),
      };
      
      const parsed = offerReservationSchema.parse(dataWithDecimals);

      // Enriquecer clientes com nome
      const clientesEnriquecidos = parsed.clientes.map((c) => {
        const clienteInfo = clientes.find((cl) => cl.id === c.clienteId);
        return { ...c, clienteNome: clienteInfo?.nome || '' };
      });

      const dataWithClientes = { ...parsed, clientes: clientesEnriquecidos };

      if (selectedOferta?.id) {
        const updated = await updateOfferReservation(selectedOferta.id, dataWithClientes, ownerUid);
        if (updated) {
          await loadData();
          emitDataInvalidation(['offers', 'salary']);
          toastSuccess('Oferta atualizada com sucesso!');
        }
      } else {
        await createOfferReservation(dataWithClientes, ownerUid);
        await loadData();
        emitDataInvalidation(['offers', 'salary']);
        toastSuccess('Oferta criada com sucesso!');
      }
      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar oferta:', error);
      toastError('Erro ao salvar oferta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ownerUid || !selectedOferta?.id) return;
    try {
      setSaving(true);
      await deleteOfferReservation(selectedOferta.id, ownerUid);
      await loadData();
      emitDataInvalidation(['offers', 'salary']);
      toastSuccess('Oferta excluída com sucesso!');
      setDeleteModalOpen(false);
      setSelectedOferta(null);
    } catch (error) {
      console.error('Erro ao excluir oferta:', error);
      toastError('Erro ao excluir oferta');
    } finally {
      setSaving(false);
    }
  };

  const addCliente = () => {
    append({ clienteId: '', clienteNome: '', allocatedValue: 0, saldoOk: false });
  };

  const columns = useMemo<ColumnDef<OfferReservation>[]>(
    () => [
      {
        accessorKey: 'nomeAtivo',
        header: 'Ativo/Oferta',
        cell: (info) => (
          <button
            type="button"
            className="font-medium hover:underline cursor-pointer text-left"
            style={{ color: 'var(--color-gold)' }}
            onClick={() => {
              setSelectedOferta(info.row.original);
              setDetalhesModalOpen(true);
            }}
            aria-label={`Ver detalhes de ${info.getValue() as string}`}
          >
            {info.getValue() as string}
          </button>
        ),
      },
      {
        accessorKey: 'classeAtivo',
        header: 'Classe',
        cell: (info) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{(info.getValue() as string) || 'Outros'}</span>,
      },
      {
        accessorKey: 'competenceMonth',
        header: 'Competência',
        cell: (info) => {
          const competenceMonth = info.getValue() as string;
          return <span>{formatCompetenceMonthPtBr(competenceMonth)}</span>;
        },
      },
      {
        accessorKey: 'audience',
        header: 'Público',
        cell: (info) => {
          const audience = info.getValue() as OfferReservation['audience'];
          return <Badge variant={audience === 'QUALIFIED' ? 'warning' : 'info'}>{getOfferAudienceLabel(audience || 'GENERAL')}</Badge>;
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as OfferReservation['status'];
          const variant = status === 'LIQUIDADA'
            ? 'success'
            : status === 'CANCELADA'
              ? 'danger'
              : status === 'RESERVADA'
                ? 'warning'
                : 'neutral';
          return <Badge variant={variant}>{getOfferStatusLabel(status || 'PENDENTE')}</Badge>;
        },
      },
      {
        accessorKey: 'clientes',
        header: 'Clientes',
        cell: (info) => {
          const clientes = info.getValue() as OfferReservation['clientes'];
          return (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <span>{clientes?.length || 0}</span>
            </div>
          );
        },
      },
      {
        id: 'totalAlocado',
        header: 'Alocação Total',
        cell: (info) => {
          const { totalAllocated } = calcOfferReservationTotals(info.row.original);
          return <CurrencyCell value={totalAllocated} />;
        },
      },
      {
        id: 'receitaCasa',
        header: 'Receita Casa',
        cell: (info) => {
          const { revenueHouse } = calcOfferReservationTotals(info.row.original);
          return <CurrencyCell value={revenueHouse} />;
        },
      },
      {
        id: 'liquidoAssessor',
        header: 'Líquido Assessor',
        cell: (info) => {
          const { advisorNet } = calcOfferReservationTotals(info.row.original);
          return <CurrencyCell value={advisorNet} />;
        },
      },
      {
        id: 'liquidationDate',
        header: 'Liquida em',
        cell: (info) => {
          const row = info.row.original;
          const data = row.liquidationDate || row.dataLiquidacao;
          return data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => {
          if (access.readOnly) {
            return (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Somente leitura
              </span>
            );
          }
          return (
            <ActionButtons
              onEdit={() => openModal(info.row.original)}
              onDelete={() => {
                setSelectedOferta(info.row.original);
                setDeleteModalOpen(true);
              }}
            />
          );
        },
      },
    ],
    [openModal, access.readOnly]
  );

  // KPIs
  const kpis = useMemo(() => {
    let receitaOfertas = 0;
    let repasseAssessor = 0;
    let liquidoAssessor = 0;
    let pendentes = 0;

    ofertasFiltradas.forEach((o) => {
      const { revenueHouse, advisorGross, advisorNet } = calcOfferReservationTotals(o);
      const status = normalizeOfferStatus(o.status, {
        reservaEfetuada: o.reservaEfetuada,
        reservaLiquidada: o.reservaLiquidada,
      });
      if (isLiquidated(o)) {
        receitaOfertas += revenueHouse;
        repasseAssessor += advisorGross;
        liquidoAssessor += advisorNet;
      }
      if (status === 'PENDENTE' || status === 'RESERVADA') {
        pendentes++;
      }
    });

    return { receitaOfertas, repasseAssessor, liquidoAssessor, pendentes };
  }, [ofertasFiltradas]);

  // Verificar saldo pendente nos clientes
  const clientesSemSaldo = useMemo(() => {
    let count = 0;
    ofertasFiltradas.forEach((o) => {
      o.clientes.forEach((c) => {
        if (!c.saldoOk) count++;
      });
    });
    return count;
  }, [ofertasFiltradas]);

  if (loading) {
    return <PageSkeleton showKpis kpiCount={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <PageHeader
        title="Ofertas / Reservas de Ativos"
        subtitle="Controle de ofertas com cálculo de ROA e repasse"
        actions={
          <div className="flex items-center gap-4">
            <input
              type="month"
              value={competenceMonthFiltro}
              onChange={(event) => setCompetenceMonthFiltro(normalizeCompetenceMonth(event.target.value, new Date().toISOString()))}
              className="px-3 py-2 rounded-md text-sm focus-gold"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              aria-label="Filtrar por competência"
            />
            <Tooltip content="Sem permissão para editar ofertas" disabled={!access.readOnly}>
              <span className="inline-flex">
                <button
                  onClick={() => openModal()}
                  disabled={access.readOnly}
                  className="flex items-center px-4 py-2 rounded-md transition-colors hover:brightness-110 focus-gold disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nova Oferta
                </button>
              </span>
            </Tooltip>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Receita Ofertas</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatCurrency(kpis.receitaOfertas)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Repasse Bruto</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-info)' }}>{formatCurrency(kpis.repasseAssessor)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Líquido Assessor</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatCurrency(kpis.liquidoAssessor)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Pendentes</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{kpis.pendentes}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Clientes s/ Saldo</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{clientesSemSaldo}</p>
          {clientesSemSaldo > 0 && <AlertCircle className="w-5 h-5 mt-1" style={{ color: 'var(--color-danger)' }} />}
        </div>
      </div>

      {/* Tabela */}
      <DataTable data={ofertasFiltradas} columns={columns} searchPlaceholder="Buscar ofertas..." />

      {/* Modal Criar/Editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedOferta ? 'Editar Oferta' : 'Nova Oferta'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados do Ativo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input label="Nome do Ativo *" {...register('nomeAtivo')} error={errors.nomeAtivo?.message} />
            <Select
              label="Classe do Ativo *"
              options={classeAtivoSelectOptions}
              {...register('classeAtivo')}
              error={errors.classeAtivo?.message}
            />
            <Select
              label="Tipo da Oferta"
              options={offerTypeOptions}
              {...register('offerType')}
              error={errors.offerType?.message}
            />
            <Input
              label="Investimento Mínimo (R$)"
              type="number"
              step="0.01"
              {...register('minimumInvestment', { valueAsNumber: true })}
              error={errors.minimumInvestment?.message}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Modo de Comissão"
              options={commissionModeOptions}
              {...register('commissionMode')}
              error={errors.commissionMode?.message}
            />
            {commissionMode === 'ROA_PERCENT' ? (
              <Input
                label="ROA (%)"
                type="number"
                step="0.01"
                placeholder="Ex: 2 para 2%"
                {...register('roaPercent', { valueAsNumber: true })}
                error={errors.roaPercent?.message}
              />
            ) : (
              <Input
                label="Receita Fixa (R$)"
                type="number"
                step="0.01"
                {...register('revenueFixed', { valueAsNumber: true })}
                error={errors.revenueFixed?.message}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              label="Competência (YYYY-MM) *"
              type="month"
              {...register('competenceMonth')}
              error={errors.competenceMonth?.message}
            />
            <Input label="Data Reserva" type="date" {...register('dataReserva')} error={errors.dataReserva?.message} />
            <Input label="Fim da Reserva" type="date" {...register('reservationEndDate')} error={errors.reservationEndDate?.message} />
            <Input label="Liquida em" type="date" {...register('liquidationDate')} error={errors.liquidationDate?.message} />
            <Select
              label="Status"
              options={offerStatusSelectOptions}
              {...register('status')}
              error={errors.status?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Público"
              options={offerAudienceSelectOptions}
              {...register('audience')}
              error={errors.audience?.message}
            />
            <Input
              label="Repasse (%)"
              type="number"
              step="0.01"
              placeholder="Ex: 25 para 25%"
              {...register('repassePercent', { valueAsNumber: true })}
              error={errors.repassePercent?.message}
            />
            <Input
              label="IR (%)"
              type="number"
              step="0.01"
              placeholder="Ex: 19 para 19%"
              {...register('irPercent', { valueAsNumber: true })}
              error={errors.irPercent?.message}
            />
          </div>

          {/* Clientes da Reserva */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Clientes da Reserva</h3>
              <button type="button" onClick={addCliente} className="flex items-center text-sm" style={{ color: 'var(--color-gold)' }}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Cliente
              </button>
            </div>
            {errors.clientes?.message && <p className="text-sm mb-2" style={{ color: 'var(--color-danger)' }}>{errors.clientes.message}</p>}

            {fields.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>Nenhum cliente adicionado.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const clienteFieldPath = `clientes.${index}.clienteId` as const;
                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end p-3 rounded" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                      <div className="col-span-5">
                        <ClientSelect
                          label="Cliente"
                          value={watch(clienteFieldPath) || ''}
                          options={clientSelectOptions}
                          loading={loading}
                          onChange={(nextValue) => {
                            setValue(clienteFieldPath, nextValue, { shouldDirty: true, shouldValidate: true });
                          }}
                          error={errors.clientes?.[index]?.clienteId?.message}
                          placeholder="Selecione o cliente"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          label="Valor Alocado"
                          type="number"
                          step="0.01"
                          {...register(`clientes.${index}.allocatedValue`, { valueAsNumber: true })}
                          error={errors.clientes?.[index]?.allocatedValue?.message}
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2 pb-1">
                        <input
                          type="checkbox"
                          {...register(`clientes.${index}.saldoOk`)}
                          className="w-5 h-5 accent-[var(--color-gold)]"
                        />
                        <span className="text-sm">Saldo OK</span>
                      </div>
                      <div className="col-span-2 flex justify-end pb-1">
                        <button type="button" onClick={() => remove(index)} style={{ color: 'var(--color-danger)' }}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo de Cálculos */}
          {fields.length > 0 && (
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-gold-bg)' }}>
              <h4 className="font-medium mb-2">Resumo de Cálculos (Prévia)</h4>
              <CalculoPreview control={control} commissionMode={commissionMode || 'ROA_PERCENT'} />
            </div>
          )}

          <TextArea label="Resumo comercial" {...register('summary')} error={errors.summary?.message} />
          <TextArea label="Observações" {...register('observacoes')} error={errors.observacoes?.message} />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-md transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 hover:brightness-110 focus-gold transition-colors"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              {saving ? 'Salvando...' : selectedOferta ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDelete} loading={saving} title="Excluir oferta" message="Tem certeza que deseja excluir esta oferta? Esta ação não pode ser desfeita." variant="danger" confirmText="Excluir" />

      <OfertaDetalhesModal
        key={selectedOferta?.id ? `${selectedOferta.id}-${detalhesModalOpen ? 'open' : 'closed'}` : 'no-offer'}
        oferta={selectedOferta}
        isOpen={detalhesModalOpen}
        onClose={() => setDetalhesModalOpen(false)}
        ownerUid={ownerUid}
        clientes={clientes}
        loading={loading}
        readOnly={access.readOnly}
        onSave={async (updatedOferta, options) => {
          if (!ownerUid || !selectedOferta?.id) return;
          try {
            setSaving(true);
            const updated = await updateOfferReservation(selectedOferta.id, updatedOferta, ownerUid);
            if (updated) {
              await loadData();
              const scopes: InvalidationScope[] = options?.emitClientsInvalidation
                ? ['offers', 'salary', 'clients']
                : ['offers', 'salary'];
              emitDataInvalidation(scopes);
              toastSuccess(options?.successMessage || 'Oferta atualizada com sucesso!');
              setSelectedOferta(updated);
              if (!options?.keepOpen) {
                setDetalhesModalOpen(false);
              }
            }
          } catch (error) {
            console.error('Erro ao salvar oferta:', error);
            toastError('Erro ao salvar oferta');
            throw error;
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

// Componente para preview de cálculos (valores na UI estão em %, converter para decimal)
type CalculoPreviewControl = {
  _formValues?: Partial<Pick<OfferReservationFormInput, 'clientes' | 'roaPercent' | 'revenueFixed' | 'repassePercent' | 'irPercent'>>;
};

function CalculoPreview({ control, commissionMode }: { control: CalculoPreviewControl; commissionMode?: string }) {
  const mode = commissionMode || 'ROA_PERCENT';
  const clientes = control._formValues?.clientes || [];
  const roaPercentUI = control._formValues?.roaPercent || 0;
  const revenueFixed = control._formValues?.revenueFixed || 0;
  const repassePercentUI = control._formValues?.repassePercent || 25;
  const irPercentUI = control._formValues?.irPercent || 19;

  // Converter de UI (%) para decimal (ex: 25 -> 0.25)
  const roaDecimal = roaPercentUI > 1 ? roaPercentUI / 100 : roaPercentUI;
  const repasseDecimal = repassePercentUI > 1 ? repassePercentUI / 100 : repassePercentUI;
  const irDecimal = irPercentUI > 1 ? irPercentUI / 100 : irPercentUI;

  const totalAlocado = clientes.reduce((sum, c) => sum + (Number(c?.allocatedValue) || 0), 0);
  const receitaCasa = mode === 'ROA_PERCENT' ? totalAlocado * roaDecimal : revenueFixed;
  const repasseBruto = receitaCasa * repasseDecimal;
  const ir = repasseBruto * irDecimal;
  const liquido = repasseBruto - ir;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
      <div>
        <span style={{ color: 'var(--color-text-secondary)' }}>Alocação:</span>
        <p className="font-semibold">{formatCurrency(totalAlocado)}</p>
      </div>
      <div>
        <span style={{ color: 'var(--color-text-secondary)' }}>Receita Casa:</span>
        <p className="font-semibold" style={{ color: 'var(--color-gold)' }}>{formatCurrency(receitaCasa)}</p>
      </div>
      <div>
        <span style={{ color: 'var(--color-text-secondary)' }}>Repasse Bruto:</span>
        <p className="font-semibold">{formatCurrency(repasseBruto)}</p>
      </div>
      <div>
        <span style={{ color: 'var(--color-text-secondary)' }}>IR ({irPercentUI.toFixed(0)}%):</span>
        <p className="font-semibold" style={{ color: 'var(--color-danger)' }}>-{formatCurrency(ir)}</p>
      </div>
      <div>
        <span style={{ color: 'var(--color-text-secondary)' }}>Líquido:</span>
        <p className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatCurrency(liquido)}</p>
      </div>
    </div>
  );
}

// Helper para formatar moeda com proteção contra NaN
function safeCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '?';
  }
  return formatCurrency(value);
}

// Helper para exibir percentual com proteção contra NaN
function safePercent(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '?';
  }
  return `${value.toFixed(decimals)}%`;
}

type OfferDetailSaveOptions = {
  keepOpen?: boolean;
  emitClientsInvalidation?: boolean;
  successMessage?: string;
};

// Modal de detalhes da oferta (editável)
function OfertaDetalhesModal({
  oferta,
  isOpen,
  onClose,
  ownerUid,
  clientes,
  loading,
  onSave,
  readOnly,
  saving,
}: {
  oferta: OfferReservation | null;
  isOpen: boolean;
  onClose: () => void;
  ownerUid?: string;
  clientes: Cliente[];
  loading: boolean;
  onSave: (data: OfferReservation, options?: OfferDetailSaveOptions) => Promise<void>;
  readOnly: boolean;
  saving: boolean;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<OfferReservation | null>(() => {
    if (!oferta) return null;
    return {
      ...oferta,
      offerType: oferta.offerType || 'PRIVATE',
      minimumInvestment: oferta.minimumInvestment || 0,
      reservationEndDate: oferta.reservationEndDate || '',
      competenceMonth: normalizeCompetenceMonth(oferta.competenceMonth, oferta.dataReserva || oferta.createdAt),
      audience: oferta.audience || 'GENERAL',
      status: oferta.status || 'PENDENTE',
      liquidationDate: oferta.liquidationDate || oferta.dataLiquidacao || '',
      dataLiquidacao: oferta.liquidationDate || oferta.dataLiquidacao || '',
      summary: oferta.summary || '',
      attachments: oferta.attachments || [],
      clientes: [...oferta.clientes],
    };
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationMode, setReservationMode] = useState<'select-client' | 'create-client'>('select-client');
  const [inlineAddClientId, setInlineAddClientId] = useState('');
  const [selectedExistingClientId, setSelectedExistingClientId] = useState('');
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [quickClientProfile, setQuickClientProfile] = useState<'REGULAR' | 'QUALIFIED' | 'PROFESSIONAL'>('REGULAR');
  const [reservationAmount, setReservationAmount] = useState<number>(0);
  const [reservationDate, setReservationDate] = useState<string>(getTodaySaoPauloDate());
  const [reservationNotes, setReservationNotes] = useState('');
  const [addingReservation, setAddingReservation] = useState(false);
  const [highlightedClientId, setHighlightedClientId] = useState<string | null>(null);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const reservationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  if (!isOpen || !oferta || !formData) return null;

  // Calcular totais com proteção contra NaN
  const calcularTotais = (data: OfferReservation) => {
    const totalAllocated = data.clientes.reduce((sum, c) => sum + (Number(c.allocatedValue) || 0), 0);
    const roaDecimal = (data.roaPercent || 0) > 1 ? (data.roaPercent || 0) / 100 : (data.roaPercent || 0);
    const repasseDecimal = (data.repassePercent || 0) > 1 ? (data.repassePercent || 0) / 100 : (data.repassePercent || 0);
    const irDecimal = (data.irPercent || 0) > 1 ? (data.irPercent || 0) / 100 : (data.irPercent || 0);
    
    const revenueHouse = data.commissionMode === 'ROA_PERCENT' 
      ? totalAllocated * roaDecimal 
      : (Number(data.revenueFixed) || 0);
    const advisorGross = revenueHouse * repasseDecimal;
    const advisorTax = advisorGross * irDecimal;
    const advisorNet = advisorGross - advisorTax;
    
    return { totalAllocated, revenueHouse, advisorGross, advisorTax, advisorNet };
  };

  const totals = calcularTotais(formData);
  const clientesComSaldo = formData.clientes.filter((c) => c.saldoOk).length;
  const clientesSemSaldo = formData.clientes.length - clientesComSaldo;

  // Converter percentuais para exibi??o (decimal -> %)
  const toDisplayPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return 0;
    return value > 1 ? value : value * 100;
  };

  const roaDisplay = toDisplayPercent(formData.roaPercent);
  const repasseDisplay = toDisplayPercent(formData.repassePercent);
  const irDisplay = toDisplayPercent(formData.irPercent);

  // Clientes disponíveis para adicionar (excluindo já adicionados)
  const clientesAdicionados = new Set(formData.clientes.map(c => c.clienteId));
  const clientesDisponiveis = clientes.filter(c => c.id && !clientesAdicionados.has(c.id));
  const normalizedStatus = normalizeOfferStatus(formData.status, {
    reservaEfetuada: formData.reservaEfetuada,
    reservaLiquidada: formData.reservaLiquidada,
  });
  const offerStatusLocked = normalizedStatus === 'CANCELADA' || normalizedStatus === 'LIQUIDADA';
  const reservationWindowExpired = isReservationWindowExpired(formData.reservationEndDate);
  const liquidationWindowExpired = isLiquidationMomentExpired(formData.liquidationDate || formData.dataLiquidacao);
  const offerAcceptsReservations = canAcceptNewReservations({
    status: formData.status,
    reservaEfetuada: formData.reservaEfetuada,
    reservaLiquidada: formData.reservaLiquidada,
    liquidationDate: formData.liquidationDate,
    dataLiquidacao: formData.dataLiquidacao,
    reservationEndDate: formData.reservationEndDate,
  });
  const offerLocked = !offerAcceptsReservations;
  const canAddReservation = !readOnly && !offerLocked;
  const reservationTotal = formData.clientes.reduce((sum, item) => sum + (Number(item.allocatedValue) || 0), 0);
  const reservationEndDateLabel = formData.reservationEndDate
    ? new Date(`${formData.reservationEndDate}T12:00:00`).toLocaleDateString('pt-BR')
    : null;
  const reservationLockMessage = offerStatusLocked
    ? 'Oferta liquidada/cancelada. Novas reservas estão bloqueadas.'
    : liquidationWindowExpired
      ? 'Liquidação da oferta já atingida. Novas reservas estão bloqueadas.'
      : reservationWindowExpired
      ? `Prazo da reserva encerrado em ${reservationEndDateLabel || 'data informada'}.`
      : '';
  const availableClientOptions = clientesDisponiveis.map((client) => ({
    value: client.id || '',
    label: client.nome,
    hint: [client.cpfCnpj, client.codigoConta, client.email, client.telefone].filter(Boolean).join(' | '),
    searchText: [client.nome, client.cpfCnpj, client.codigoConta, client.email, client.telefone].filter(Boolean).join(' '),
  }));

  const quickDuplicateClient = (() => {
    const email = normalizeEmail(quickClientEmail);
    const phone = normalizePhone(quickClientPhone);
    if (!email && !phone) return null;
    return clientes.find((client) => {
      const sameEmail = email && normalizeEmail(client.email) === email;
      const samePhone = phone && normalizePhone(client.telefone) === phone;
      return Boolean(sameEmail || samePhone);
    }) || null;
  })();
  const selectedExistingClient = selectedExistingClientId
    ? clientes.find((client) => client.id === selectedExistingClientId) || null
    : null;

  const handleHighlightReservation = (clientId: string) => {
    setHighlightedClientId(clientId);
    const rowElement = reservationRowRefs.current[clientId];
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.setTimeout(() => {
      setHighlightedClientId((current) => (current === clientId ? null : current));
    }, 2200);
  };

  const resetReservationDrawer = () => {
    setReservationMode('select-client');
    setInlineAddClientId('');
    setSelectedExistingClientId('');
    setQuickClientName('');
    setQuickClientEmail('');
    setQuickClientPhone('');
    setQuickClientProfile('REGULAR');
    setReservationAmount(0);
    setReservationDate(getTodaySaoPauloDate());
    setReservationNotes('');
  };

  const handleOpenReservationDrawer = () => {
    if (!canAddReservation) return;
    resetReservationDrawer();
    setReservationDrawerOpen(true);
  };

  const handleAddMaterialLink = () => {
    const name = newMaterialName.trim();
    const url = newMaterialUrl.trim();
    if (!name || !url) {
      toastError('Informe nome e URL do material.');
      return;
    }
    try {
      const parsedUrl = new URL(url);
      setFormData((prev) => {
        if (!prev) return null;
        const current = prev.attachments || [];
        if (current.length >= 10) {
          toastError('Limite de 10 materiais por oferta.');
          return prev;
        }
        const next: OfferAttachmentLink = {
          id: `material-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          url: parsedUrl.toString(),
          type: 'link',
          createdAt: new Date().toISOString(),
        };
        return { ...prev, attachments: [...current, next] };
      });
      setNewMaterialName('');
      setNewMaterialUrl('');
    } catch {
      toastError('URL do material inválida.');
    }
  };

  const handleRemoveMaterialLink = (attachmentId: string) => {
    if (readOnly) return;
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        attachments: (prev.attachments || []).filter((attachment) => attachment.id !== attachmentId),
      };
    });
  };

  const handleSaveReservation = async () => {
    if (addingReservation) return;
    if (!canAddReservation) {
      toastError(reservationLockMessage || 'Oferta indisponível para novas reservas.');
      return;
    }
    if (!Number.isFinite(reservationAmount) || reservationAmount <= 0) {
      toastError('Informe um valor reservado maior que zero.');
      return;
    }

    setAddingReservation(true);

    try {
      let selectedClient: Cliente | null = null;
      let createdNewClient = false;

      if (reservationMode === 'select-client') {
        selectedClient = clientes.find((client) => client.id === selectedExistingClientId) || null;
        if (!selectedClient || !selectedClient.id) {
          toastError('Selecione um cliente para continuar.');
          return;
        }
      } else {
        const name = quickClientName.trim();
        if (!name) {
          toastError('Nome do cliente é obrigatório.');
          return;
        }
        if (quickDuplicateClient && quickDuplicateClient.id) {
          setReservationMode('select-client');
          setSelectedExistingClientId(quickDuplicateClient.id);
          toastError('Cliente com email/telefone já existe. Selecione o cadastro existente.');
          return;
        }
        if (!ownerUid) {
          toastError('Não foi possível identificar o usuário para criar cliente.');
          return;
        }

        const profileType = quickClientProfile === 'QUALIFIED'
          ? 'Qualificado'
          : quickClientProfile === 'PROFESSIONAL'
            ? 'Profissional'
            : 'Regular';
        const payload = clienteSchema.parse({
          nome: name,
          email: quickClientEmail.trim(),
          telefone: quickClientPhone.trim(),
          perfilInvestidor: profileType,
          status: 'ativo',
        });
        selectedClient = await clienteRepository.create(payload, ownerUid);
        createdNewClient = true;
      }

      if (!selectedClient?.id) {
        toastError('Cliente inválido para criar reserva.');
        return;
      }

      const reservationInput = {
        clientId: selectedClient.id,
        clientName: selectedClient.nome,
        reservedAmount: reservationAmount,
        reserveDate: reservationDate,
        notes: reservationNotes,
      };
      const mutation = applyReservationToOfferSnapshot(formData, reservationInput);
      if (!mutation.ok || !mutation.offer) {
        if (mutation.reason === 'DUPLICATE_CLIENT' && mutation.duplicateClientId) {
          toastError('Este cliente já possui reserva nesta oferta.');
          handleHighlightReservation(mutation.duplicateClientId);
          return;
        }
        if (mutation.reason === 'OFFER_LOCKED') {
          toastError('Oferta já liquidada/cancelada.');
          return;
        }
        toastError('Não foi possível adicionar a reserva.');
        return;
      }

      setFormData(mutation.offer);
      await onSave(mutation.offer, {
        keepOpen: true,
        emitClientsInvalidation: createdNewClient,
        successMessage: createdNewClient
          ? 'Cliente e reserva adicionados com sucesso!'
          : 'Reserva adicionada com sucesso!',
      });

      setReservationDrawerOpen(false);
      resetReservationDrawer();
    } catch {
      // Toast de erro já tratado no callback de persistência.
    } finally {
      setAddingReservation(false);
    }
  };

  // Handlers de edição
  const handleAddCliente = (clienteId: string) => {
    if (!clienteId) return;
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente || clientesAdicionados.has(clienteId)) {
      setValidationErrors(['Cliente já adicionado a esta oferta.']);
      return;
    }
    setFormData(prev => prev ? {
      ...prev,
      clientes: [...prev.clientes, { clienteId, clienteNome: cliente.nome, allocatedValue: 0, saldoOk: false, status: 'RESERVADA' }]
    } : null);
    setValidationErrors([]);
  };

  const handleRemoveCliente = (index: number) => {
    setFormData(prev => prev ? {
      ...prev,
      clientes: prev.clientes.filter((_, i) => i !== index)
    } : null);
  };

  const handleClienteChange = (index: number, field: 'allocatedValue' | 'saldoOk', value: number | boolean) => {
    setFormData(prev => {
      if (!prev) return null;
      const newClientes = [...prev.clientes];
      if (field === 'allocatedValue') {
        const numValue = Number(value);
        if (!Number.isFinite(numValue) || numValue < 0) {
          setValidationErrors(['Valor alocado inválido. Informe um número positivo.']);
          return prev;
        }
        newClientes[index] = { ...newClientes[index], allocatedValue: numValue };
      } else {
        newClientes[index] = { ...newClientes[index], saldoOk: value as boolean };
      }
      setValidationErrors([]);
      return { ...prev, clientes: newClientes };
    });
  };

  const handleParamChange = (field: keyof OfferReservation, value: string | number | boolean) => {
    setFormData(prev => {
      if (!prev) return null;
      // Validar números
      if (['roaPercent', 'repassePercent', 'irPercent', 'revenueFixed'].includes(field)) {
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) {
          setValidationErrors([`Valor inválido para ${field}.`]);
          return prev;
        }
        // Converter de % para decimal se necessário
        if (['roaPercent', 'repassePercent', 'irPercent'].includes(field)) {
          return { ...prev, [field]: numValue > 1 ? numValue / 100 : numValue };
        }
        return { ...prev, [field]: numValue };
      }
      setValidationErrors([]);
      return { ...prev, [field]: value };
    });
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];
    
    if (!formData.nomeAtivo?.trim()) {
      errors.push('Nome do ativo é obrigatório.');
    }
    if (!formData.competenceMonth) {
      errors.push('Competência é obrigatória.');
    }
    if (formData.clientes.length === 0) {
      errors.push('Adicione ao menos 1 cliente.');
    }
    
    // Verificar valores válidos
    formData.clientes.forEach((c, i) => {
      if (!Number.isFinite(c.allocatedValue) || c.allocatedValue < 0) {
        errors.push(`Valor alocado inválido no cliente ${i + 1}.`);
      }
    });

    // Verificar clientes duplicados
    const ids = formData.clientes.map(c => c.clienteId);
    const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicados.length > 0) {
      errors.push('Existem clientes duplicados na oferta.');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    // Enriquecer nomes de clientes
    const clientesEnriquecidos = formData.clientes.map(c => {
      const clienteInfo = clientes.find(cl => cl.id === c.clienteId);
      return { ...c, clienteNome: clienteInfo?.nome || c.clienteNome || '' };
    });

    const normalizedLiquidationDate = formData.liquidationDate || formData.dataLiquidacao || undefined;
    try {
      await onSave({
        ...formData,
        competenceMonth: normalizeCompetenceMonth(formData.competenceMonth, formData.dataReserva || formData.createdAt),
        liquidationDate: normalizedLiquidationDate,
        dataLiquidacao: normalizedLiquidationDate,
        clientes: clientesEnriquecidos,
      });
    } catch {
      // Toast de erro já tratado no callback de persistência.
    }
  };

  const handleCancel = () => {
    setFormData({
      ...oferta,
      offerType: oferta.offerType || 'PRIVATE',
      minimumInvestment: oferta.minimumInvestment || 0,
      reservationEndDate: oferta.reservationEndDate || '',
      competenceMonth: normalizeCompetenceMonth(oferta.competenceMonth, oferta.dataReserva || oferta.createdAt),
      audience: oferta.audience || 'GENERAL',
      status: oferta.status || 'PENDENTE',
      liquidationDate: oferta.liquidationDate || oferta.dataLiquidacao || '',
      dataLiquidacao: oferta.liquidationDate || oferta.dataLiquidacao || '',
      summary: oferta.summary || '',
      attachments: oferta.attachments || [],
      clientes: [...oferta.clientes],
    });
    setIsEditMode(false);
    setValidationErrors([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      <div
        className="relative max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: '0.75rem', boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhes-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div>
            <h2 id="detalhes-modal-title" className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {isEditMode ? 'Editar Oferta' : formData.nomeAtivo}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formData.classeAtivo || 'Outros'}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <Tooltip content="Sem permissão para editar oferta" disabled={!readOnly}>
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    disabled={readOnly}
                    className="flex items-center gap-1 px-3 py-2 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ color: 'var(--color-gold)' }}
                    aria-label="Editar oferta"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm font-medium">Editar</span>
                  </button>
                </span>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Erros de validação */}
        {validationErrors.length > 0 && (
          <div className="mx-4 mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
              <div>
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-sm" style={{ color: 'var(--color-danger)' }}>{err}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {(formData.offerType || 'PRIVATE') === 'PUBLIC' && (
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <BaseCard variant="bordered" padding="md">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Oferta Pública
                  </h3>
                </div>
                <Badge variant="info">{getOfferAudienceLabel(formData.audience || 'GENERAL')}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Mínimo</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {safeCurrency(formData.minimumInvestment)}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Público</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {getOfferAudienceLabel(formData.audience || 'GENERAL')}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Fim reserva</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {formData.reservationEndDate
                      ? new Date(`${formData.reservationEndDate}T12:00:00`).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Liquida em</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {formData.liquidationDate || formData.dataLiquidacao
                      ? new Date(`${(formData.liquidationDate || formData.dataLiquidacao || '')}T12:00:00`).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>
            </BaseCard>
          </div>
        )}

        {/* Resumo */}
        <div className="p-4 border-b" style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              {formData.clientes.length} cliente{formData.clientes.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span className="font-medium" style={{ color: 'var(--color-success)' }}>{clientesComSaldo} saldo OK</span>
            {clientesSemSaldo > 0 && (
              <>
                <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                <span className="font-medium" style={{ color: 'var(--color-danger)' }}>{clientesSemSaldo} pendente{clientesSemSaldo !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Preview de cálculos */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Alocação:</span>
              <p className="font-semibold">{safeCurrency(totals.totalAllocated)}</p>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Receita Casa:</span>
              <p className="font-semibold" style={{ color: 'var(--color-gold)' }}>{safeCurrency(totals.revenueHouse)}</p>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Repasse Bruto:</span>
              <p className="font-semibold">{safeCurrency(totals.advisorGross)}</p>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>IR ({safePercent(irDisplay, 0)}):</span>
              <p className="font-semibold" style={{ color: 'var(--color-danger)' }}>-{safeCurrency(totals.advisorTax)}</p>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Líquido:</span>
              <p className="font-semibold" style={{ color: 'var(--color-success)' }}>{safeCurrency(totals.advisorNet)}</p>
            </div>
          </div>
        </div>

        {/* Parâmetros */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Parâmetros</h3>
          {isEditMode ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Modo</label>
                <select
                  value={formData.commissionMode}
                  onChange={(e) => handleParamChange('commissionMode', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="ROA_PERCENT">ROA (%)</option>
                  <option value="FIXED_REVENUE">Receita Fixa</option>
                </select>
              </div>
              {formData.commissionMode === 'ROA_PERCENT' ? (
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>ROA (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roaDisplay}
                    onChange={(e) => handleParamChange('roaPercent', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                    placeholder="Ex: 2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Receita Fixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueFixed || 0}
                    onChange={(e) => handleParamChange('revenueFixed', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Repasse (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={repasseDisplay}
                  onChange={(e) => handleParamChange('repassePercent', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  placeholder="Ex: 25"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>IR (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={irDisplay}
                  onChange={(e) => handleParamChange('irPercent', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  placeholder="Ex: 19"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Modo:</span>{' '}
                <span className="font-medium">
                  {formData.commissionMode === 'ROA_PERCENT' ? 'ROA (%)' : 'Receita Fixa'}
                </span>
              </div>
              {formData.commissionMode === 'ROA_PERCENT' ? (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>ROA:</span>{' '}
                  <span className="font-medium">{safePercent(roaDisplay, 2)}</span>
                </div>
              ) : (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Receita Fixa:</span>{' '}
                  <span className="font-medium">{safeCurrency(formData.revenueFixed)}</span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Repasse:</span>{' '}
                <span className="font-medium">{safePercent(repasseDisplay, 0)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>IR:</span>{' '}
                <span className="font-medium">{safePercent(irDisplay, 0)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Reservas */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Reservas</h3>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {formData.clientes.length} cliente(s) | Total {safeCurrency(reservationTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip
                content={
                  readOnly
                    ? 'Sem permissão para editar'
                    : reservationLockMessage
                      ? reservationLockMessage
                      : ''
                }
                disabled={canAddReservation}
              >
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenReservationDrawer}
                    disabled={!canAddReservation}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Adicionar reserva / cliente
                  </Button>
                </span>
              </Tooltip>
              {isEditMode && !readOnly && (
                <div className="flex items-center gap-2">
                  {availableClientOptions.length > 0 ? (
                    <ClientSelect
                      value={inlineAddClientId}
                      options={availableClientOptions}
                      loading={loading}
                      onChange={(nextValue) => {
                        if (!nextValue) return;
                        setInlineAddClientId(nextValue);
                        handleAddCliente(nextValue);
                        setInlineAddClientId('');
                      }}
                      placeholder="Adicionar na edição"
                      searchPlaceholder="Buscar cliente para adicionar..."
                      className="w-72"
                    />
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Todos os clientes já adicionados</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {offerLocked && (
            <div className="mb-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}>
              <p className="text-sm" style={{ color: 'var(--color-warning)' }}>
                {reservationLockMessage}
              </p>
            </div>
          )}

          {formData.clientes.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>Nenhuma reserva registrada.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {formData.clientes.map((cliente, idx) => {
                const itemClientId = cliente.clienteId || `legacy-${idx}`;
                const resolvedClient = clientes.find(c => c.id === cliente.clienteId);
                const displayName = cliente.clienteNome || resolvedClient?.nome || 'Cliente (texto)';
                const isLegacyOnlyText = !cliente.clienteId;
                const isHighlighted = highlightedClientId === cliente.clienteId;
                return (
                  <div
                    key={itemClientId}
                    ref={(node) => { reservationRowRefs.current[itemClientId] = node; }}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: isHighlighted ? '1px solid var(--color-warning)' : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                            {displayName}
                          </span>
                          {isLegacyOnlyText && <Badge variant="neutral">Cliente (texto)</Badge>}
                          <Badge variant={cliente.status === 'LIQUIDADA' ? 'success' : cliente.status === 'CANCELADA' ? 'danger' : 'warning'}>
                            {cliente.status || 'RESERVADA'}
                          </Badge>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          {cliente.reserveDate
                            ? `Reserva: ${new Date(`${cliente.reserveDate}T12:00:00`).toLocaleDateString('pt-BR')}`
                            : 'Sem data de reserva'}
                          {cliente.notes ? `  |  ${cliente.notes}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isEditMode && !readOnly ? (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cliente.allocatedValue || 0}
                            onChange={(e) => handleClienteChange(idx, 'allocatedValue', parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 text-sm rounded-md focus-gold"
                            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                            aria-label={`Valor alocado para ${cliente.clienteNome}`}
                          />
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cliente.saldoOk}
                              onChange={(e) => handleClienteChange(idx, 'saldoOk', e.target.checked)}
                              className="w-4 h-4 accent-[var(--color-gold)]"
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Saldo OK</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveCliente(idx)}
                            className="p-1 rounded hover:bg-[var(--color-surface-hover)]"
                            style={{ color: 'var(--color-danger)' }}
                            aria-label={`Remover ${cliente.clienteNome}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                            {safeCurrency(cliente.allocatedValue)}
                          </span>
                          {cliente.saldoOk ? (
                            <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                              <CheckCircle className="w-4 h-4" />
                              Saldo OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-danger)' }}>
                              <AlertCircle className="w-4 h-4" />
                              Falta saldo
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Datas e status */}
        <div className="p-4 border-t" style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border-subtle)' }}>
          {isEditMode ? (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Tipo</label>
                <select
                  value={formData.offerType || 'PRIVATE'}
                  onChange={(e) => handleParamChange('offerType', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  {offerTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Competência</label>
                <input
                  type="month"
                  value={formData.competenceMonth || ''}
                  onChange={(e) => handleParamChange('competenceMonth', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Data Reserva</label>
                <input
                  type="date"
                  value={formData.dataReserva || ''}
                  onChange={(e) => handleParamChange('dataReserva', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Investimento Mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={Number(formData.minimumInvestment || 0)}
                  onChange={(e) => handleParamChange('minimumInvestment', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Liquida em</label>
                <input
                  type="date"
                  value={formData.liquidationDate || formData.dataLiquidacao || ''}
                  onChange={(e) => {
                    handleParamChange('liquidationDate', e.target.value);
                    handleParamChange('dataLiquidacao', e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fim da Reserva</label>
                <input
                  type="date"
                  value={formData.reservationEndDate || ''}
                  onChange={(e) => handleParamChange('reservationEndDate', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Status</label>
                <select
                  value={formData.status || 'PENDENTE'}
                  onChange={(e) => handleParamChange('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  {offerStatusSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Público</label>
                <select
                  value={formData.audience || 'GENERAL'}
                  onChange={(e) => handleParamChange('audience', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  {offerAudienceSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Tipo da oferta:</span>{' '}
                <span className="font-medium">{(formData.offerType || 'PRIVATE') === 'PUBLIC' ? 'Oferta Pública' : 'Privada'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Competência:</span>{' '}
                <span className="font-medium">{formatCompetenceMonthPtBr(formData.competenceMonth || '')}</span>
              </div>
              {formData.dataReserva && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Data Reserva:</span>{' '}
                  <span className="font-medium">
                    {new Date(formData.dataReserva + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Mínimo:</span>{' '}
                <span className="font-medium">{safeCurrency(formData.minimumInvestment)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Liquida em:</span>{' '}
                <span className="font-medium">
                  {formData.liquidationDate || formData.dataLiquidacao ? new Date((formData.liquidationDate || formData.dataLiquidacao || '') + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Fim reserva:</span>{' '}
                <span className="font-medium">
                  {formData.reservationEndDate ? new Date(`${formData.reservationEndDate}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
                <Badge
                  variant={
                    formData.status === 'LIQUIDADA'
                      ? 'success'
                      : formData.status === 'CANCELADA'
                        ? 'danger'
                        : formData.status === 'RESERVADA'
                          ? 'warning'
                          : 'neutral'
                  }
                >
                  {getOfferStatusLabel(formData.status || 'PENDENTE')}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--color-text-muted)' }}>Perfil do investidor:</span>
                <Badge variant={formData.audience === 'QUALIFIED' ? 'warning' : 'info'}>
                  {getOfferAudienceLabel(formData.audience || 'GENERAL')}
                </Badge>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Resumo comercial</label>
              {isEditMode && !readOnly ? (
                <textarea
                  value={formData.summary || ''}
                  onChange={(e) => handleParamChange('summary', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  rows={3}
                />
              ) : (
                <p className="text-sm rounded-md p-2" style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface)' }}>
                  {(formData.summary || '').trim() || 'Sem resumo comercial.'}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>Materiais (links)</label>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {(formData.attachments || []).length}/10
                </span>
              </div>
              {isEditMode && !readOnly && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Nome do material"
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    className="md:col-span-2 w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newMaterialUrl}
                    onChange={(e) => setNewMaterialUrl(e.target.value)}
                    className="md:col-span-2 w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddMaterialLink}>
                    Adicionar
                  </Button>
                </div>
              )}

              {(formData.attachments || []).length === 0 ? (
                <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>Nenhum material cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {(formData.attachments || []).map((attachment) => (
                    <div
                      key={attachment.id || attachment.url}
                      className="flex items-center justify-between gap-2 rounded-md p-2"
                      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>{attachment.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{attachment.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium inline-flex items-center gap-1"
                          style={{ color: 'var(--color-info)' }}
                        >
                          <LinkIcon className="w-3 h-3" />
                          Abrir
                        </a>
                        {isEditMode && !readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialLink(attachment.id || '')}
                            className="text-xs font-medium"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formData.observacoes && !isEditMode && (
              <div>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Observações:</span>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{formData.observacoes}</p>
              </div>
            )}
            {isEditMode && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Observações</label>
                <textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => handleParamChange('observacoes', e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {reservationDrawerOpen && (
          <div
            className="absolute inset-0 z-30 flex justify-end"
            onClick={() => setReservationDrawerOpen(false)}
          >
            <div
              className="absolute inset-0 opacity-70"
              style={{ backgroundColor: 'var(--color-surface-2)' }}
            />
            <aside
              className="relative h-full w-full max-w-md border-l flex flex-col"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border-subtle)',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Adicionar reserva"
            >
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Adicionar reserva / cliente
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Oferta: {formData.nomeAtivo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReservationDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)]"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label="Fechar drawer de reserva"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                <Tabs
                  value={reservationMode}
                  onChange={(value) => setReservationMode(value as 'select-client' | 'create-client')}
                  items={[
                    { value: 'select-client', label: 'Selecionar cliente' },
                    { value: 'create-client', label: 'Criar cliente rápido' },
                  ]}
                />

                {reservationMode === 'select-client' ? (
                  <div className="space-y-3">
                    <ClientSelect
                      label="Cliente"
                      value={selectedExistingClientId}
                      options={availableClientOptions}
                      loading={loading}
                      onChange={(nextValue) => setSelectedExistingClientId(nextValue)}
                      placeholder="Selecione o cliente"
                      searchPlaceholder="Buscar por nome, CPF/CNPJ, código, email ou telefone"
                      emptyText="Nenhum cliente disponível para reserva."
                    />
                    {selectedExistingClient && (
                      <div className="rounded-md p-2 border" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cliente selecionado</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selectedExistingClient.nome}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nome *"
                      value={quickClientName}
                      onChange={(event) => setQuickClientName(event.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={quickClientEmail}
                      onChange={(event) => setQuickClientEmail(event.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="Telefone"
                      value={quickClientPhone}
                      onChange={(event) => setQuickClientPhone(event.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <select
                      value={quickClientProfile}
                      onChange={(event) => setQuickClientProfile(event.target.value as 'REGULAR' | 'QUALIFIED' | 'PROFESSIONAL')}
                      className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {quickClientProfileOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {quickDuplicateClient?.id && (
                      <BaseCard variant="bordered" padding="sm">
                        <div className="flex items-start gap-2">
                          <CircleAlert className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                              Cliente parecido já cadastrado
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {quickDuplicateClient.nome}
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setReservationMode('select-client');
                                setSelectedExistingClientId(quickDuplicateClient.id || '');
                              }}
                            >
                              Selecionar cliente existente
                            </Button>
                          </div>
                        </div>
                      </BaseCard>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 space-y-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Dados da reserva
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={reservationAmount || ''}
                    onChange={(event) => setReservationAmount(Number.parseFloat(event.target.value) || 0)}
                    placeholder="Valor reservado *"
                    className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                  />
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(event) => setReservationDate(event.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                  />
                  <textarea
                    value={reservationNotes}
                    onChange={(event) => setReservationNotes(event.target.value)}
                    placeholder="Observação da reserva"
                    rows={3}
                    className="w-full px-3 py-2 rounded-md text-sm focus-gold"
                    style={{
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReservationDrawerOpen(false)}
                  disabled={addingReservation}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={addingReservation}
                  onClick={handleSaveReservation}
                >
                  Salvar reserva
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 hover:bg-[var(--color-surface-hover)] rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium hover:brightness-110 transition-colors disabled:opacity-50 focus-gold"
                style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-[var(--color-surface-hover)] rounded-lg font-medium transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
