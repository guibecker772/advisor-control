import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { reservaRepository, clienteRepository } from '../../services/repositories';
import { reservaSchema, type Reserva, type ReservaInput, type Cliente } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

const tipoOptions = [
  { value: 'aporte', label: 'Aporte' },
  { value: 'resgate', label: 'Resgate' },
  { value: 'transferencia_entrada', label: 'Transferência Entrada' },
  { value: 'transferencia_saida', label: 'Transferência Saída' },
];

const statusOptions = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'efetivada', label: 'Efetivada' },
  { value: 'cancelada', label: 'Cancelada' },
];

export default function ReservasPage() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReservaInput>({
    resolver: zodResolver(reservaSchema),
    defaultValues: {
      tipo: 'aporte',
      status: 'agendada',
      valor: 0,
    },
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [reservaData, clienteData] = await Promise.all([
          reservaRepository.getAll(user.uid),
          clienteRepository.getAll(user.uid),
        ]);
        setReservas(reservaData);
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
    () => clientes.map((c) => ({ value: c.id || '', label: c.nome })),
    [clientes]
  );

  const openModal = (reserva?: Reserva) => {
    if (reserva) {
      setSelectedReserva(reserva);
      reset(reserva);
    } else {
      setSelectedReserva(null);
      reset({
        clienteId: '',
        tipo: 'aporte',
        status: 'agendada',
        valor: 0,
        dataAgendada: '',
        produto: '',
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: ReservaInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = reservaSchema.parse(data);

      const cliente = clientes.find((c) => c.id === parsed.clienteId);
      const dataWithCliente = {
        ...parsed,
        clienteNome: cliente?.nome || '',
      };

      if (selectedReserva?.id) {
        const updated = await reservaRepository.update(selectedReserva.id, dataWithCliente, user.uid);
        if (updated) {
          setReservas((prev) =>
            prev.map((r) => (r.id === selectedReserva.id ? updated : r))
          );
          toast.success('Reserva atualizada com sucesso!');
        }
      } else {
        const created = await reservaRepository.create(dataWithCliente, user.uid);
        setReservas((prev) => [...prev, created]);
        toast.success('Reserva criada com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toast.error('Erro ao salvar reserva');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedReserva?.id) return;

    try {
      setSaving(true);
      await reservaRepository.delete(selectedReserva.id, user.uid);
      setReservas((prev) => prev.filter((r) => r.id !== selectedReserva.id));
      toast.success('Reserva excluída com sucesso!');
      setDeleteModalOpen(false);
      setSelectedReserva(null);
    } catch (error) {
      console.error('Erro ao excluir reserva:', error);
      toast.error('Erro ao excluir reserva');
    } finally {
      setSaving(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'efetivada':
        return 'success';
      case 'cancelada':
        return 'danger';
      case 'confirmada':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTipoColor = (tipo: string): string => {
    if (tipo === 'aporte' || tipo === 'transferencia_entrada') {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  const columns = useMemo<ColumnDef<Reserva>[]>(
    () => [
      {
        accessorKey: 'clienteNome',
        header: 'Cliente',
        cell: (info) => <span className="font-medium">{(info.getValue() as string) || '-'}</span>,
      },
      {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: (info) => {
          const tipo = info.getValue() as string;
          const option = tipoOptions.find((t) => t.value === tipo);
          return <span className={getTipoColor(tipo)}>{option?.label || tipo}</span>;
        },
      },
      {
        accessorKey: 'valor',
        header: 'Valor',
        cell: (info) => {
          const row = info.row.original;
          const isNegative = row.tipo === 'resgate' || row.tipo === 'transferencia_saida';
          return <CurrencyCell value={isNegative ? -(info.getValue() as number) : (info.getValue() as number)} />;
        },
      },
      {
        accessorKey: 'dataAgendada',
        header: 'Data Agendada',
        cell: (info) => {
          const data = info.getValue() as string;
          return data ? new Date(data).toLocaleDateString('pt-BR') : '-';
        },
      },
      {
        accessorKey: 'produto',
        header: 'Produto',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as string;
          const option = statusOptions.find((s) => s.value === status);
          return <StatusBadge status={option?.label || status} variant={getStatusVariant(status)} />;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedReserva(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [clientes]
  );

  const totais = useMemo(() => {
    const aportes = reservas
      .filter((r) => r.status !== 'cancelada' && (r.tipo === 'aporte' || r.tipo === 'transferencia_entrada'))
      .reduce((sum, r) => sum + (r.valor || 0), 0);
    const resgates = reservas
      .filter((r) => r.status !== 'cancelada' && (r.tipo === 'resgate' || r.tipo === 'transferencia_saida'))
      .reduce((sum, r) => sum + (r.valor || 0), 0);
    
    return {
      total: reservas.length,
      pendentes: reservas.filter((r) => r.status === 'agendada' || r.status === 'confirmada').length,
      aportes,
      resgates,
      saldo: aportes - resgates,
    };
  }, [reservas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-600">Aportes, resgates e transferências</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Reserva
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totais.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{totais.pendentes}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Aportes</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.aportes)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Resgates</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totais.resgates)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Saldo</p>
          <p className={`text-2xl font-bold ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totais.saldo)}
          </p>
        </div>
      </div>

      <DataTable
        data={reservas}
        columns={columns}
        searchPlaceholder="Buscar reservas..."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedReserva ? 'Editar Reserva' : 'Nova Reserva'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Cliente"
              options={clienteOptions}
              {...register('clienteId')}
              error={errors.clienteId?.message}
            />
            <Select
              label="Tipo *"
              options={tipoOptions}
              {...register('tipo')}
              error={errors.tipo?.message}
            />
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              {...register('valor', { valueAsNumber: true })}
              error={errors.valor?.message}
            />
            <Select
              label="Status"
              options={statusOptions}
              {...register('status')}
              error={errors.status?.message}
            />
            <Input
              label="Data Agendada *"
              type="date"
              {...register('dataAgendada')}
              error={errors.dataAgendada?.message}
            />
            <Input
              label="Data Efetivada"
              type="date"
              {...register('dataEfetivada')}
              error={errors.dataEfetivada?.message}
            />
            <Input
              label="Produto"
              {...register('produto')}
              error={errors.produto?.message}
            />
          </div>

          <TextArea
            label="Observações"
            {...register('observacoes')}
            error={errors.observacoes?.message}
          />

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
              {saving ? 'Salvando...' : selectedReserva ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDelete
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        loading={saving}
      />
    </div>
  );
}
