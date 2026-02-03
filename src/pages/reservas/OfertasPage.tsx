import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Users, CheckCircle, Circle, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { offerReservationRepository, clienteRepository } from '../../services/repositories';
import {
  offerReservationSchema,
  calcOfferReservationTotals,
  type OfferReservation,
  type OfferReservationInput,
  type Cliente,
} from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

const commissionModeOptions = [
  { value: 'ROA_PERCENT', label: 'ROA (% sobre alocação)' },
  { value: 'FIXED_REVENUE', label: 'Receita Fixa (R$)' },
];

export default function OfertasPage() {
  const { user } = useAuth();
  const [ofertas, setOfertas] = useState<OfferReservation[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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
  } = useForm<OfferReservationInput>({
    resolver: zodResolver(offerReservationSchema),
    defaultValues: {
      commissionMode: 'ROA_PERCENT',
      roaPercent: 0.02,
      revenueFixed: 0,
      repassePercent: 0.25,
      irPercent: 0.19,
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
          clientes: oferta.clientes || [],
        });
      } else {
        setSelectedOferta(null);
        reset({
          nomeAtivo: '',
          commissionMode: 'ROA_PERCENT',
          roaPercent: 0.02,
          revenueFixed: 0,
          repassePercent: 0.25,
          irPercent: 0.19,
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

  const onSubmit = async (data: OfferReservationInput) => {
    if (!user) return;
    try {
      setSaving(true);
      const parsed = offerReservationSchema.parse(data);

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
        cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Nome do Ativo *" {...register('nomeAtivo')} error={errors.nomeAtivo?.message} />
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
              {...register('repassePercent', { valueAsNumber: true })}
              error={errors.repassePercent?.message}
            />
            <Input
              label="IR (%)"
              type="number"
              step="0.01"
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
    </div>
  );
}

// Componente para preview de cálculos
function CalculoPreview({ control, commissionMode }: { control: any; commissionMode?: string }) {
  const mode = commissionMode || 'ROA_PERCENT';
  const clientes = control._formValues?.clientes || [];
  const roaPercent = control._formValues?.roaPercent || 0;
  const revenueFixed = control._formValues?.revenueFixed || 0;
  const repassePercent = control._formValues?.repassePercent || 0.25;
  const irPercent = control._formValues?.irPercent || 0.19;

  const totalAlocado = clientes.reduce((sum: number, c: any) => sum + (c.allocatedValue || 0), 0);
  const receitaCasa = mode === 'ROA_PERCENT' ? totalAlocado * roaPercent : revenueFixed;
  const repasseBruto = receitaCasa * repassePercent;
  const ir = repasseBruto * irPercent;
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
        <span className="text-gray-600">IR ({(irPercent * 100).toFixed(0)}%):</span>
        <p className="font-semibold text-red-500">-{formatCurrency(ir)}</p>
      </div>
      <div>
        <span className="text-gray-600">Líquido:</span>
        <p className="font-semibold text-green-600">{formatCurrency(liquido)}</p>
      </div>
    </div>
  );
}
