import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Users, CheckCircle, Circle, Trash2, AlertCircle, X, Edit3, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { offerReservationRepository, clienteRepository } from '../../services/repositories';
import {
  offerReservationSchema,
  offerReservationFormSchema,
  calcOfferReservationTotals,
  classeAtivoOptions,
  type OfferReservation,
  type OfferReservationFormInput,
  type Cliente,
} from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

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

export default function OfertasPage() {
  const { user } = useAuth();
  const [ofertas, setOfertas] = useState<OfferReservation[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfferReservation | null>(null);
  const [saving, setSaving] = useState(false);
  const [mesFiltro, setMesFiltro] = useState<number>(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<OfferReservationFormInput>({
    resolver: zodResolver(offerReservationFormSchema),
    defaultValues: {
      classeAtivo: 'Outros',
      commissionMode: 'ROA_PERCENT',
      roaPercent: 2,       // UI em % (será convertido para 0.02 no submit)
      revenueFixed: 0,
      repassePercent: 25,  // UI em % (será convertido para 0.25 no submit)
      irPercent: 19,       // UI em % (será convertido para 0.19 no submit)
      reservaEfetuada: false,
      reservaLiquidada: false,
      clientes: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'clientes',
  });

  const commissionMode = watch('commissionMode');

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const [ofertaData, clienteData] = await Promise.all([
          offerReservationRepository.getAll(user.uid),
          clienteRepository.getAll(user.uid),
        ]);
        setOfertas(ofertaData);
        setClientes(clienteData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const clienteOptions = useMemo(
    () => [{ value: '', label: 'Selecione...' }, ...clientes.map((c) => ({ value: c.id || '', label: c.nome }))],
    [clientes]
  );

  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter((o) => {
      const dataLiq = o.dataLiquidacao ? new Date(o.dataLiquidacao + 'T00:00:00') : null;
      if (!dataLiq) return true; // Se sem data de liquidação, mostra sempre
      return dataLiq.getMonth() + 1 === mesFiltro && dataLiq.getFullYear() === anoFiltro;
    });
  }, [ofertas, mesFiltro, anoFiltro]);

  const openModal = useCallback(
    (oferta?: OfferReservation) => {
      if (oferta) {
        setSelectedOferta(oferta);
        reset({
          ...oferta,
          classeAtivo: oferta.classeAtivo || 'Outros',
          // Converter decimal → % para exibição na UI
          roaPercent: toPercentDisplay(oferta.roaPercent),
          repassePercent: toPercentDisplay(oferta.repassePercent),
          irPercent: toPercentDisplay(oferta.irPercent),
          clientes: oferta.clientes || [],
        });
      } else {
        setSelectedOferta(null);
        reset({
          nomeAtivo: '',
          classeAtivo: 'Outros',
          commissionMode: 'ROA_PERCENT',
          roaPercent: 2,       // UI em %
          revenueFixed: 0,
          repassePercent: 25,  // UI em %
          irPercent: 19,       // UI em %
          dataReserva: new Date().toISOString().split('T')[0],
          dataLiquidacao: '',
          reservaEfetuada: false,
          reservaLiquidada: false,
          clientes: [],
          observacoes: '',
        });
      }
      setModalOpen(true);
    },
    [reset]
  );

  const onSubmit = async (data: OfferReservationFormInput) => {
    if (!user) return;
    try {
      setSaving(true);
      
      // Converter percentuais de UI (%) → banco (decimal) antes de validar
      const dataWithDecimals = {
        ...data,
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
        const updated = await offerReservationRepository.update(selectedOferta.id, dataWithClientes, user.uid);
        if (updated) {
          setOfertas((prev) => prev.map((o) => (o.id === selectedOferta.id ? updated : o)));
          toast.success('Oferta atualizada com sucesso!');
        }
      } else {
        const created = await offerReservationRepository.create(dataWithClientes, user.uid);
        setOfertas((prev) => [...prev, created]);
        toast.success('Oferta criada com sucesso!');
      }
      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar oferta:', error);
      toast.error('Erro ao salvar oferta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedOferta?.id) return;
    try {
      setSaving(true);
      await offerReservationRepository.delete(selectedOferta.id, user.uid);
      setOfertas((prev) => prev.filter((o) => o.id !== selectedOferta.id));
      toast.success('Oferta excluída com sucesso!');
      setDeleteModalOpen(false);
      setSelectedOferta(null);
    } catch (error) {
      console.error('Erro ao excluir oferta:', error);
      toast.error('Erro ao excluir oferta');
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
            className="font-medium text-teal-700 hover:text-teal-900 hover:underline cursor-pointer text-left"
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
        cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || 'Outros'}</span>,
      },
      {
        accessorKey: 'clientes',
        header: 'Clientes',
        cell: (info) => {
          const clientes = info.getValue() as OfferReservation['clientes'];
          return (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-500" />
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
        accessorKey: 'dataLiquidacao',
        header: 'Liquidação',
        cell: (info) => {
          const data = info.getValue() as string;
          return data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
        },
      },
      {
        accessorKey: 'reservaEfetuada',
        header: 'Efetuada',
        cell: (info) =>
          info.getValue() ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          ),
      },
      {
        accessorKey: 'reservaLiquidada',
        header: 'Liquidada',
        cell: (info) =>
          info.getValue() ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          ),
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedOferta(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [openModal]
  );

  // KPIs
  const kpis = useMemo(() => {
    let receitaOfertas = 0;
    let repasseAssessor = 0;
    let liquidoAssessor = 0;
    let pendentes = 0;

    ofertasFiltradas.forEach((o) => {
      const { revenueHouse, advisorGross, advisorNet } = calcOfferReservationTotals(o);
      receitaOfertas += revenueHouse;
      repasseAssessor += advisorGross;
      liquidoAssessor += advisorNet;
      if (!o.reservaLiquidada) pendentes++;
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ofertas / Reservas de Ativos</h1>
          <p className="text-gray-600">Controle de ofertas com cálculo de ROA e repasse</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Select
              value={String(mesFiltro)}
              onChange={(e) => setMesFiltro(Number(e.target.value))}
              options={[
                { value: '1', label: 'Janeiro' },
                { value: '2', label: 'Fevereiro' },
                { value: '3', label: 'Março' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Maio' },
                { value: '6', label: 'Junho' },
                { value: '7', label: 'Julho' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Setembro' },
                { value: '10', label: 'Outubro' },
                { value: '11', label: 'Novembro' },
                { value: '12', label: 'Dezembro' },
              ]}
            />
            <Select
              value={String(anoFiltro)}
              onChange={(e) => setAnoFiltro(Number(e.target.value))}
              options={[2023, 2024, 2025, 2026].map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Oferta
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Receita Ofertas</p>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(kpis.receitaOfertas)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Repasse Bruto</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(kpis.repasseAssessor)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Líquido Assessor</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(kpis.liquidoAssessor)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{kpis.pendentes}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Clientes s/ Saldo</p>
          <p className="text-2xl font-bold text-red-500">{clientesSemSaldo}</p>
          {clientesSemSaldo > 0 && <AlertCircle className="w-5 h-5 text-red-500 mt-1" />}
        </div>
      </div>

      {/* Tabela */}
      <DataTable data={ofertasFiltradas} columns={columns} searchPlaceholder="Buscar ofertas..." />

      {/* Modal Criar/Editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedOferta ? 'Editar Oferta' : 'Nova Oferta'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados do Ativo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome do Ativo *" {...register('nomeAtivo')} error={errors.nomeAtivo?.message} />
            <Select
              label="Classe do Ativo *"
              options={classeAtivoSelectOptions}
              {...register('classeAtivo')}
              error={errors.classeAtivo?.message}
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input label="Data Reserva" type="date" {...register('dataReserva')} error={errors.dataReserva?.message} />
            <Input label="Data Liquidação *" type="date" {...register('dataLiquidacao')} error={errors.dataLiquidacao?.message} />
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

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('reservaEfetuada')} className="w-5 h-5 accent-teal-600" />
              <span>Reserva Efetuada</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('reservaLiquidada')} className="w-5 h-5 accent-teal-600" />
              <span>Reserva Liquidada</span>
            </label>
          </div>

          {/* Clientes da Reserva */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Clientes da Reserva</h3>
              <button type="button" onClick={addCliente} className="flex items-center text-sm text-teal-600 hover:text-teal-800">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Cliente
              </button>
            </div>
            {errors.clientes?.message && <p className="text-red-500 text-sm mb-2">{errors.clientes.message}</p>}

            {fields.length === 0 ? (
              <p className="text-gray-500 text-sm italic">Nenhum cliente adicionado.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-3 rounded">
                    <div className="col-span-5">
                      <Select
                        label="Cliente"
                        options={clienteOptions}
                        {...register(`clientes.${index}.clienteId`)}
                        error={errors.clientes?.[index]?.clienteId?.message}
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
                        className="w-5 h-5 accent-teal-600"
                      />
                      <span className="text-sm">Saldo OK</span>
                    </div>
                    <div className="col-span-2 flex justify-end pb-1">
                      <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo de Cálculos */}
          {fields.length > 0 && (
            <div className="bg-teal-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Resumo de Cálculos (Prévia)</h4>
              <CalculoPreview control={control} commissionMode={commissionMode || 'ROA_PERCENT'} />
            </div>
          )}

          <TextArea label="Observações" {...register('observacoes')} error={errors.observacoes?.message} />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedOferta ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDelete isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDelete} loading={saving} />

      <OfertaDetalhesModal
        oferta={selectedOferta}
        isOpen={detalhesModalOpen}
        onClose={() => setDetalhesModalOpen(false)}
        clientes={clientes}
        onSave={async (updatedOferta) => {
          if (!user || !selectedOferta?.id) return;
          try {
            setSaving(true);
            const updated = await offerReservationRepository.update(selectedOferta.id, updatedOferta, user.uid);
            if (updated) {
              setOfertas((prev) => prev.map((o) => (o.id === selectedOferta.id ? updated : o)));
              toast.success('Oferta atualizada com sucesso!');
              setDetalhesModalOpen(false);
            }
          } catch (error) {
            console.error('Erro ao salvar oferta:', error);
            toast.error('Erro ao salvar oferta');
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
function CalculoPreview({ control, commissionMode }: { control: any; commissionMode?: string }) {
  const mode = commissionMode || 'ROA_PERCENT';
  const clientes = control._formValues?.clientes || [];
  const roaPercentUI = control._formValues?.roaPercent || 0;
  const revenueFixed = control._formValues?.revenueFixed || 0;
  const repassePercentUI = control._formValues?.repassePercent || 25;
  const irPercentUI = control._formValues?.irPercent || 19;

  // Converter de UI (%) para decimal (ex: 25 → 0.25)
  const roaDecimal = roaPercentUI > 1 ? roaPercentUI / 100 : roaPercentUI;
  const repasseDecimal = repassePercentUI > 1 ? repassePercentUI / 100 : repassePercentUI;
  const irDecimal = irPercentUI > 1 ? irPercentUI / 100 : irPercentUI;

  const totalAlocado = clientes.reduce((sum: number, c: any) => sum + (c.allocatedValue || 0), 0);
  const receitaCasa = mode === 'ROA_PERCENT' ? totalAlocado * roaDecimal : revenueFixed;
  const repasseBruto = receitaCasa * repasseDecimal;
  const ir = repasseBruto * irDecimal;
  const liquido = repasseBruto - ir;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
      <div>
        <span className="text-gray-600">Alocação:</span>
        <p className="font-semibold">{formatCurrency(totalAlocado)}</p>
      </div>
      <div>
        <span className="text-gray-600">Receita Casa:</span>
        <p className="font-semibold text-teal-600">{formatCurrency(receitaCasa)}</p>
      </div>
      <div>
        <span className="text-gray-600">Repasse Bruto:</span>
        <p className="font-semibold">{formatCurrency(repasseBruto)}</p>
      </div>
      <div>
        <span className="text-gray-600">IR ({irPercentUI.toFixed(0)}%):</span>
        <p className="font-semibold text-red-500">-{formatCurrency(ir)}</p>
      </div>
      <div>
        <span className="text-gray-600">Líquido:</span>
        <p className="font-semibold text-green-600">{formatCurrency(liquido)}</p>
      </div>
    </div>
  );
}

// Helper para formatar moeda com proteção contra NaN
function safeCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—';
  }
  return formatCurrency(value);
}

// Helper para exibir percentual com proteção contra NaN
function safePercent(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(decimals)}%`;
}

// Modal de detalhes da oferta (editável)
function OfertaDetalhesModal({
  oferta,
  isOpen,
  onClose,
  clientes,
  onSave,
  saving,
}: {
  oferta: OfferReservation | null;
  isOpen: boolean;
  onClose: () => void;
  clientes: Cliente[];
  onSave: (data: OfferReservation) => Promise<void>;
  saving: boolean;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<OfferReservation | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Inicializar formData quando oferta muda
  useEffect(() => {
    if (oferta) {
      setFormData({ ...oferta, clientes: [...oferta.clientes] });
      setIsEditMode(false);
      setValidationErrors([]);
    }
  }, [oferta]);

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

  // Converter percentuais para exibição (decimal → %)
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
      clientes: [...prev.clientes, { clienteId, clienteNome: cliente.nome, allocatedValue: 0, saldoOk: false }]
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
    if (!formData.dataLiquidacao) {
      errors.push('Data de liquidação é obrigatória.');
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

    await onSave({ ...formData, clientes: clientesEnriquecidos });
  };

  const handleCancel = () => {
    setFormData({ ...oferta, clientes: [...oferta.clientes] });
    setIsEditMode(false);
    setValidationErrors([]);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhes-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 id="detalhes-modal-title" className="text-xl font-bold text-gray-900">
              {isEditMode ? 'Editar Oferta' : formData.nomeAtivo}
            </h2>
            <p className="text-sm text-gray-500">{formData.classeAtivo || 'Outros'}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1 px-3 py-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors"
                aria-label="Editar oferta"
              >
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium">Editar</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Erros de validação */}
        {validationErrors.length > 0 && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-red-700 text-sm">{err}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resumo */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-teal-600" />
            <span className="font-medium text-gray-800">
              {formData.clientes.length} cliente{formData.clientes.length !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-green-600 font-medium">{clientesComSaldo} saldo OK</span>
            {clientesSemSaldo > 0 && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-red-600 font-medium">{clientesSemSaldo} pendente{clientesSemSaldo !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Preview de cálculos */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Alocação:</span>
              <p className="font-semibold">{safeCurrency(totals.totalAllocated)}</p>
            </div>
            <div>
              <span className="text-gray-600">Receita Casa:</span>
              <p className="font-semibold text-teal-600">{safeCurrency(totals.revenueHouse)}</p>
            </div>
            <div>
              <span className="text-gray-600">Repasse Bruto:</span>
              <p className="font-semibold">{safeCurrency(totals.advisorGross)}</p>
            </div>
            <div>
              <span className="text-gray-600">IR ({safePercent(irDisplay, 0)}):</span>
              <p className="font-semibold text-red-500">-{safeCurrency(totals.advisorTax)}</p>
            </div>
            <div>
              <span className="text-gray-600">Líquido:</span>
              <p className="font-semibold text-green-600">{safeCurrency(totals.advisorNet)}</p>
            </div>
          </div>
        </div>

        {/* Parâmetros */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Parâmetros</h3>
          {isEditMode ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Modo</label>
                <select
                  value={formData.commissionMode}
                  onChange={(e) => handleParamChange('commissionMode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="ROA_PERCENT">ROA (%)</option>
                  <option value="FIXED_REVENUE">Receita Fixa</option>
                </select>
              </div>
              {formData.commissionMode === 'ROA_PERCENT' ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ROA (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roaDisplay}
                    onChange={(e) => handleParamChange('roaPercent', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Ex: 2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Receita Fixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueFixed || 0}
                    onChange={(e) => handleParamChange('revenueFixed', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Repasse (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={repasseDisplay}
                  onChange={(e) => handleParamChange('repassePercent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Ex: 25"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">IR (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={irDisplay}
                  onChange={(e) => handleParamChange('irPercent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Ex: 19"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500">Modo:</span>{' '}
                <span className="font-medium">
                  {formData.commissionMode === 'ROA_PERCENT' ? 'ROA (%)' : 'Receita Fixa'}
                </span>
              </div>
              {formData.commissionMode === 'ROA_PERCENT' ? (
                <div>
                  <span className="text-gray-500">ROA:</span>{' '}
                  <span className="font-medium">{safePercent(roaDisplay, 2)}</span>
                </div>
              ) : (
                <div>
                  <span className="text-gray-500">Receita Fixa:</span>{' '}
                  <span className="font-medium">{safeCurrency(formData.revenueFixed)}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Repasse:</span>{' '}
                <span className="font-medium">{safePercent(repasseDisplay, 0)}</span>
              </div>
              <div>
                <span className="text-gray-500">IR:</span>{' '}
                <span className="font-medium">{safePercent(irDisplay, 0)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de clientes */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Clientes</h3>
            {isEditMode && (
              <div className="flex items-center gap-2">
                {clientesDisponiveis.length > 0 ? (
                  <select
                    onChange={(e) => {
                      handleAddCliente(e.target.value);
                      e.target.value = '';
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    defaultValue=""
                  >
                    <option value="" disabled>+ Adicionar cliente</option>
                    {clientesDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-500 italic">Todos os clientes já adicionados</span>
                )}
              </div>
            )}
          </div>

          {formData.clientes.length === 0 ? (
            <p className="text-gray-500 text-sm italic">Nenhum cliente alocado.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {formData.clientes.map((cliente, idx) => (
                <div
                  key={cliente.clienteId || idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate">
                      {cliente.clienteNome || clientes.find(c => c.id === cliente.clienteId)?.nome || cliente.clienteId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditMode ? (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={cliente.allocatedValue || 0}
                          onChange={(e) => handleClienteChange(idx, 'allocatedValue', parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          aria-label={`Valor alocado para ${cliente.clienteNome}`}
                        />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cliente.saldoOk}
                            onChange={(e) => handleClienteChange(idx, 'saldoOk', e.target.checked)}
                            className="w-4 h-4 accent-teal-600"
                          />
                          <span className="text-xs text-gray-600">Saldo OK</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveCliente(idx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          aria-label={`Remover ${cliente.clienteNome}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-700">
                          {safeCurrency(cliente.allocatedValue)}
                        </span>
                        {cliente.saldoOk ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Saldo OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <AlertCircle className="w-4 h-4" />
                            Falta saldo
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Datas e status */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {isEditMode ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data Reserva</label>
                <input
                  type="date"
                  value={formData.dataReserva || ''}
                  onChange={(e) => handleParamChange('dataReserva', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data Liquidação *</label>
                <input
                  type="date"
                  value={formData.dataLiquidacao || ''}
                  onChange={(e) => handleParamChange('dataLiquidacao', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={formData.reservaEfetuada || false}
                  onChange={(e) => handleParamChange('reservaEfetuada', e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                  id="edit-reserva-efetuada"
                />
                <label htmlFor="edit-reserva-efetuada" className="text-sm text-gray-700 cursor-pointer">Efetuada</label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={formData.reservaLiquidada || false}
                  onChange={(e) => handleParamChange('reservaLiquidada', e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                  id="edit-reserva-liquidada"
                />
                <label htmlFor="edit-reserva-liquidada" className="text-sm text-gray-700 cursor-pointer">Liquidada</label>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              {formData.dataReserva && (
                <div>
                  <span className="text-gray-500">Data Reserva:</span>{' '}
                  <span className="font-medium">
                    {new Date(formData.dataReserva + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Data Liquidação:</span>{' '}
                <span className="font-medium">
                  {formData.dataLiquidacao ? new Date(formData.dataLiquidacao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Efetuada:</span>
                {formData.reservaEfetuada ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Liquidada:</span>
                {formData.reservaLiquidada ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </div>
          )}
          {formData.observacoes && !isEditMode && (
            <div className="mt-3">
              <span className="text-gray-500 text-sm">Observações:</span>
              <p className="text-gray-700 text-sm mt-1">{formData.observacoes}</p>
            </div>
          )}
          {isEditMode && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">Observações</label>
              <textarea
                value={formData.observacoes || ''}
                onChange={(e) => handleParamChange('observacoes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
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
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
