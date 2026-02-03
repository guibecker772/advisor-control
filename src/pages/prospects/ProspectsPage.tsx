import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { prospectRepository } from '../../services/repositories';
import { prospectSchema, type Prospect, type ProspectInput } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, StatusBadge, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

const statusOptions = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_contato', label: 'Em Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
];

const origemOptions = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'evento', label: 'Evento' },
  { value: 'site', label: 'Site' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'outros', label: 'Outros' },
];

export default function ProspectsPage() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProspectInput>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      status: 'novo',
      potencial: 0,
      probabilidade: 50,
    },
  });

  useEffect(() => {
    if (!user) return;

    const loadProspects = async () => {
      try {
        setLoading(true);
        const data = await prospectRepository.getAll(user.uid);
        setProspects(data);
      } catch (error) {
        console.error('Erro ao carregar prospects:', error);
        toast.error('Erro ao carregar prospects');
      } finally {
        setLoading(false);
      }
    };

    loadProspects();
  }, [user]);

  const openModal = (prospect?: Prospect) => {
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
        probabilidade: 50,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: ProspectInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = prospectSchema.parse(data);

      if (selectedProspect?.id) {
        const updated = await prospectRepository.update(selectedProspect.id, parsed, user.uid);
        if (updated) {
          setProspects((prev) =>
            prev.map((p) => (p.id === selectedProspect.id ? updated : p))
          );
          toast.success('Prospect atualizado com sucesso!');
        }
      } else {
        const created = await prospectRepository.create(parsed, user.uid);
        setProspects((prev) => [...prev, created]);
        toast.success('Prospect criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar prospect:', error);
      toast.error('Erro ao salvar prospect');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedProspect?.id) return;

    try {
      setSaving(true);
      await prospectRepository.delete(selectedProspect.id, user.uid);
      setProspects((prev) => prev.filter((p) => p.id !== selectedProspect.id));
      toast.success('Prospect excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedProspect(null);
    } catch (error) {
      console.error('Erro ao excluir prospect:', error);
      toast.error('Erro ao excluir prospect');
    } finally {
      setSaving(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
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
  };

  const columns = useMemo<ColumnDef<Prospect>[]>(
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
        accessorKey: 'potencial',
        header: 'Potencial',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'probabilidade',
        header: 'Probabilidade',
        cell: (info) => `${info.getValue()}%`,
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
              setSelectedProspect(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    []
  );

  const totais = useMemo(() => {
    const ativos = prospects.filter((p) => !['ganho', 'perdido'].includes(p.status));
    const potencialTotal = ativos.reduce((sum, p) => sum + (p.potencial || 0), 0);
    const potencialPonderado = ativos.reduce(
      (sum, p) => sum + ((p.potencial || 0) * (p.probabilidade || 0)) / 100,
      0
    );
    return {
      total: prospects.length,
      ativos: ativos.length,
      potencialTotal,
      potencialPonderado,
    };
  }, [prospects]);

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
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-600">Pipeline de potenciais clientes</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Prospect
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total de Prospects</p>
          <p className="text-2xl font-bold text-gray-900">{totais.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Prospects Ativos</p>
          <p className="text-2xl font-bold text-purple-600">{totais.ativos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Potencial Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.potencialTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Potencial Ponderado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.potencialPonderado)}</p>
        </div>
      </div>

      <DataTable
        data={prospects}
        columns={columns}
        searchPlaceholder="Buscar prospects..."
      />

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
              options={origemOptions}
              {...register('origem')}
              error={errors.origem?.message}
            />
            <Select
              label="Status"
              options={statusOptions}
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
              label="Próximo Contato"
              type="date"
              {...register('proximoContato')}
              error={errors.proximoContato?.message}
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
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedProspect ? 'Atualizar' : 'Criar'}
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
