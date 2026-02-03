import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { crossRepository, clienteRepository } from '../../services/repositories';
import { crossSchema, type Cross, type CrossInput, type Cliente } from '../../domain/types';
import { formatCurrency, calcularTotalCross, calcularComissaoCross } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

const categoriaOptions = [
  { value: 'seguros', label: 'Seguros' },
  { value: 'previdencia', label: 'Previdência' },
  { value: 'cambio', label: 'Câmbio' },
  { value: 'credito', label: 'Crédito' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'outros', label: 'Outros' },
];

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function CrossPage() {
  const { user } = useAuth();
  const [crosses, setCrosses] = useState<Cross[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCross, setSelectedCross] = useState<Cross | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrossInput>({
    resolver: zodResolver(crossSchema),
    defaultValues: {
      categoria: 'outros',
      status: 'pendente',
      valor: 0,
      comissao: 0,
    },
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [crossData, clienteData] = await Promise.all([
          crossRepository.getAll(user.uid),
          clienteRepository.getAll(user.uid),
        ]);
        setCrosses(crossData);
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

  const openModal = (cross?: Cross) => {
    if (cross) {
      setSelectedCross(cross);
      reset(cross);
    } else {
      setSelectedCross(null);
      reset({
        clienteId: '',
        produto: '',
        categoria: 'outros',
        status: 'pendente',
        valor: 0,
        comissao: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: CrossInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = crossSchema.parse(data);

      // Adicionar nome do cliente
      const cliente = clientes.find((c) => c.id === parsed.clienteId);
      const dataWithCliente = {
        ...parsed,
        clienteNome: cliente?.nome || '',
      };

      if (selectedCross?.id) {
        const updated = await crossRepository.update(selectedCross.id, dataWithCliente, user.uid);
        if (updated) {
          setCrosses((prev) =>
            prev.map((c) => (c.id === selectedCross.id ? updated : c))
          );
          toast.success('Cross atualizado com sucesso!');
        }
      } else {
        const created = await crossRepository.create(dataWithCliente, user.uid);
        setCrosses((prev) => [...prev, created]);
        toast.success('Cross criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar cross:', error);
      toast.error('Erro ao salvar cross');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedCross?.id) return;

    try {
      setSaving(true);
      await crossRepository.delete(selectedCross.id, user.uid);
      setCrosses((prev) => prev.filter((c) => c.id !== selectedCross.id));
      toast.success('Cross excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedCross(null);
    } catch (error) {
      console.error('Erro ao excluir cross:', error);
      toast.error('Erro ao excluir cross');
    } finally {
      setSaving(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'concluido':
        return 'success';
      case 'cancelado':
        return 'danger';
      case 'em_andamento':
        return 'warning';
      default:
        return 'default';
    }
  };

  const columns = useMemo<ColumnDef<Cross>[]>(
    () => [
      {
        accessorKey: 'clienteNome',
        header: 'Cliente',
        cell: (info) => <span className="font-medium">{(info.getValue() as string) || '-'}</span>,
      },
      {
        accessorKey: 'produto',
        header: 'Produto',
      },
      {
        accessorKey: 'categoria',
        header: 'Categoria',
        cell: (info) => {
          const cat = info.getValue() as string;
          const option = categoriaOptions.find((c) => c.value === cat);
          return option?.label || cat;
        },
      },
      {
        accessorKey: 'valor',
        header: 'Valor',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'comissao',
        header: 'Comissão',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'dataVenda',
        header: 'Data',
        cell: (info) => {
          const data = info.getValue() as string;
          return data ? new Date(data).toLocaleDateString('pt-BR') : '-';
        },
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
              setSelectedCross(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [clientes]
  );

  const totais = useMemo(() => {
    return {
      total: crosses.length,
      concluidos: crosses.filter((c) => c.status === 'concluido').length,
      valorTotal: calcularTotalCross(crosses),
      comissaoTotal: calcularComissaoCross(crosses),
    };
  }, [crosses]);

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
          <h1 className="text-2xl font-bold text-gray-900">Cross Selling</h1>
          <p className="text-gray-600">Vendas cruzadas de produtos</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cross
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total de Vendas</p>
          <p className="text-2xl font-bold text-gray-900">{totais.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Concluídos</p>
          <p className="text-2xl font-bold text-green-600">{totais.concluidos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Valor Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.valorTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Comissão Total</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totais.comissaoTotal)}</p>
        </div>
      </div>

      <DataTable
        data={crosses}
        columns={columns}
        searchPlaceholder="Buscar vendas..."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCross ? 'Editar Cross' : 'Novo Cross'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Cliente *"
              options={clienteOptions}
              {...register('clienteId')}
              error={errors.clienteId?.message}
            />
            <Input
              label="Produto *"
              {...register('produto')}
              error={errors.produto?.message}
            />
            <Select
              label="Categoria"
              options={categoriaOptions}
              {...register('categoria')}
              error={errors.categoria?.message}
            />
            <Select
              label="Status"
              options={statusOptions}
              {...register('status')}
              error={errors.status?.message}
            />
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              {...register('valor', { valueAsNumber: true })}
              error={errors.valor?.message}
            />
            <Input
              label="Comissão (R$)"
              type="number"
              step="0.01"
              {...register('comissao', { valueAsNumber: true })}
              error={errors.comissao?.message}
            />
            <Input
              label="Data da Venda"
              type="date"
              {...register('dataVenda')}
              error={errors.dataVenda?.message}
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedCross ? 'Atualizar' : 'Criar'}
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
