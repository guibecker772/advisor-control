import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { crossRepository, clienteRepository } from '../../services/repositories';
import { crossSchema, type Cross, type CrossInput, type Cliente } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
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

  // Filtros
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [statusFiltro, setStatusFiltro] = useState<string>('');

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
      pipeValue: 0,
      realizedValue: 0,
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
        pipeValue: 0,
        realizedValue: 0,
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
        header: 'Área',
        cell: (info) => {
          const cat = info.getValue() as string;
          const option = categoriaOptions.find((c) => c.value === cat);
          return <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">{option?.label || cat}</span>;
        },
      },
      {
        accessorKey: 'pipeValue',
        header: 'Pipe (R$)',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'realizedValue',
        header: 'Realizado (R$)',
        cell: (info) => {
          const val = info.getValue() as number;
          return <span className={val > 0 ? 'text-green-600 font-medium' : ''}><CurrencyCell value={val} /></span>;
        },
      },
      {
        id: 'saldo',
        header: 'Saldo',
        cell: (info) => {
          const pipe = info.row.original.pipeValue || 0;
          const realized = info.row.original.realizedValue || 0;
          const saldo = pipe - realized;
          return <span className={saldo < 0 ? 'text-red-600' : 'text-gray-600'}><CurrencyCell value={saldo} /></span>;
        },
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

  // Filtrar crosses
  const crossesFiltrados = useMemo(() => {
    return crosses.filter((c) => {
      // Filtro por mês/ano (usando dataVenda)
      if (c.dataVenda) {
        const dataDate = new Date(c.dataVenda + 'T00:00:00');
        const mes = dataDate.getMonth() + 1;
        const ano = dataDate.getFullYear();
        if (mes !== mesFiltro || ano !== anoFiltro) return false;
      }
      // Filtro por categoria
      if (categoriaFiltro && c.categoria !== categoriaFiltro) return false;
      // Filtro por status
      if (statusFiltro && c.status !== statusFiltro) return false;
      return true;
    });
  }, [crosses, mesFiltro, anoFiltro, categoriaFiltro, statusFiltro]);

  // KPIs totais
  const totais = useMemo(() => {
    const pipeTotal = crossesFiltrados.reduce((sum, c) => sum + (c.pipeValue || 0), 0);
    const realizedTotal = crossesFiltrados.reduce((sum, c) => sum + (c.realizedValue || 0), 0);
    return {
      total: crossesFiltrados.length,
      concluidos: crossesFiltrados.filter((c) => c.status === 'concluido').length,
      pipeTotal,
      realizedTotal,
      saldo: pipeTotal - realizedTotal,
    };
  }, [crossesFiltrados]);

  // KPIs por área (categoria)
  const kpisPorArea = useMemo(() => {
    const mapa: Record<string, { pipe: number; realized: number; count: number }> = {};
    crossesFiltrados.forEach((c) => {
      const cat = c.categoria || 'outros';
      if (!mapa[cat]) mapa[cat] = { pipe: 0, realized: 0, count: 0 };
      mapa[cat].pipe += c.pipeValue || 0;
      mapa[cat].realized += c.realizedValue || 0;
      mapa[cat].count += 1;
    });
    return Object.entries(mapa)
      .map(([cat, vals]) => ({ categoria: cat, ...vals }))
      .sort((a, b) => b.pipe - a.pipe);
  }, [crossesFiltrados]);

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
          <p className="text-gray-600">Vendas cruzadas de produtos — Pipe x Realizado</p>
        </div>
        <div className="flex items-center space-x-4">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
          </select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            {[2024, 2025, 2026, 2027].map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">Todas Áreas</option>
            {categoriaOptions.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </select>
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">Todos Status</option>
            {statusOptions.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Cross
          </button>
        </div>
      </div>

      {/* KPIs Totais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Registros</p>
          <p className="text-2xl font-bold text-gray-900">{totais.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Concluídos</p>
          <p className="text-2xl font-bold text-green-600">{totais.concluidos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Pipe</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.pipeTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Realizado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.realizedTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Saldo (Aberto)</p>
          <p className={`text-2xl font-bold ${totais.saldo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatCurrency(totais.saldo)}</p>
        </div>
      </div>

      {/* KPIs por Área */}
      {kpisPorArea.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-900 mb-3">Pipe x Realizado por Área</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpisPorArea.map((area) => {
              const catLabel = categoriaOptions.find((c) => c.value === area.categoria)?.label || area.categoria;
              return (
                <div key={area.categoria} className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-semibold text-indigo-700 uppercase">{catLabel}</p>
                  <p className="text-sm text-gray-600">Pipe: <span className="font-bold text-blue-600">{formatCurrency(area.pipe)}</span></p>
                  <p className="text-sm text-gray-600">Real: <span className="font-bold text-green-600">{formatCurrency(area.realized)}</span></p>
                  <p className="text-xs text-gray-400">{area.count} registro(s)</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DataTable
        data={crossesFiltrados}
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
              label="Área/Categoria"
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
              label="Pipe (R$)"
              type="number"
              step="0.01"
              {...register('pipeValue', { valueAsNumber: true })}
              error={errors.pipeValue?.message}
            />
            <Input
              label="Realizado (R$)"
              type="number"
              step="0.01"
              {...register('realizedValue', { valueAsNumber: true })}
              error={errors.realizedValue?.message}
            />
            <Input
              label="Valor Produto (R$)"
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
