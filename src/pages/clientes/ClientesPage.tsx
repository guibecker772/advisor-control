import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { clienteRepository } from '../../services/repositories';
import { clienteSchema, type Cliente, type ClienteInput } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

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

export default function ClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Carregar clientes
  useEffect(() => {
    if (!user) return;

    const loadClientes = async () => {
      try {
        setLoading(true);
        const data = await clienteRepository.getAll(user.uid);
        setClientes(data);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        toast.error('Erro ao carregar clientes');
      } finally {
        setLoading(false);
      }
    };

    loadClientes();
  }, [user]);

  // Abrir modal para criar/editar
  const openModal = (cliente?: Cliente) => {
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
        status: 'ativo',
        origem: '',
        custodiaInicial: 0,
        custodiaAtual: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  // Salvar cliente
  const onSubmit = async (data: ClienteInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = clienteSchema.parse(data);

      if (selectedCliente?.id) {
        const updated = await clienteRepository.update(selectedCliente.id, parsed, user.uid);
        if (updated) {
          setClientes((prev) =>
            prev.map((c) => (c.id === selectedCliente.id ? updated : c))
          );
          toast.success('Cliente atualizado com sucesso!');
        }
      } else {
        const created = await clienteRepository.create(parsed, user.uid);
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
    if (!user || !selectedCliente?.id) return;

    try {
      setSaving(true);
      await clienteRepository.delete(selectedCliente.id, user.uid);
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
        cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'telefone',
        header: 'Telefone',
      },
      {
        accessorKey: 'origem',
        header: 'Origem',
        cell: (info) => {
          const origem = info.getValue() as string;
          const option = origemOptions.find((o) => o.value === origem);
          return option?.label || origem || '-';
        },
      },
      {
        accessorKey: 'custodiaAtual',
        header: 'Custódia Atual',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
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
    []
  );

  // Calcular totais
  const totais = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === 'ativo');
    const custodiaTotal = clientes.reduce((sum, c) => sum + (c.custodiaAtual || 0), 0);
    return {
      total: clientes.length,
      ativos: ativos.length,
      custodiaTotal,
    };
  }, [clientes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gerencie sua carteira de clientes</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total de Clientes</p>
          <p className="text-2xl font-bold text-gray-900">{totais.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Clientes Ativos</p>
          <p className="text-2xl font-bold text-green-600">{totais.ativos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Custódia Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.custodiaTotal)}</p>
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        data={clientes}
        columns={columns}
        searchPlaceholder="Buscar clientes..."
      />

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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedCliente ? 'Atualizar' : 'Criar'}
            </button>
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
    </div>
  );
}
