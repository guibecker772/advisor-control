import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { reservaRepository, clienteRepository } from '../../services/repositories';
import { reservaSchema, type Reserva, type ReservaInput, type Cliente } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';
import { ConfirmDialog, PageHeader, PageSkeleton } from '../../components/ui';
import { toastSuccess, toastError } from '../../lib/toast';

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
        toastError('Erro ao carregar dados');
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
          toastSuccess('Reserva atualizada com sucesso!');
        }
      } else {
        const created = await reservaRepository.create(dataWithCliente, user.uid);
        setReservas((prev) => [...prev, created]);
        toastSuccess('Reserva criada com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toastError('Erro ao salvar reserva');
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
      toastSuccess('Reserva excluída com sucesso!');
      setDeleteModalOpen(false);
      setSelectedReserva(null);
    } catch (error) {
      console.error('Erro ao excluir reserva:', error);
      toastError('Erro ao excluir reserva');
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
      return 'var(--color-success)';
    }
    return 'var(--color-danger)';
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
          return <span style={{ color: getTipoColor(tipo) }}>{option?.label || tipo}</span>;
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
    return <PageSkeleton showKpis kpiCount={5} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        subtitle="Aportes, resgates e transferências"
        actions={
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 rounded-md transition-colors"
            style={{ backgroundColor: 'var(--color-gold)', color: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-gold-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-gold)')}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Reserva
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{totais.total}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pendentes</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{totais.pendentes}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aportes</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatCurrency(totais.aportes)}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Resgates</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatCurrency(totais.resgates)}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Saldo</p>
          <p className="text-2xl font-bold" style={{ color: totais.saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
              className="px-4 py-2 text-sm font-medium rounded-md border transition-colors"
              style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--color-gold)', color: 'white' }}
            >
              {saving ? 'Salvando...' : selectedReserva ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Reserva"
        message="Tem certeza que deseja excluir esta reserva? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
}
