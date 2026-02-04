import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { clienteRepository, clienteReuniaoRepository } from '../../services/repositories';
import { clienteSchema, type Cliente, type ClienteInput, type ClienteReuniao } from '../../domain/types';
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

const perfilOptions = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Qualificado', label: 'Qualificado' },
  { value: 'Profissional', label: 'Profissional' },
];

const perfilColors: Record<string, string> = {
  Regular: 'bg-gray-100 text-gray-800',
  Qualificado: 'bg-blue-100 text-blue-800',
  Profissional: 'bg-purple-100 text-purple-800',
};

export default function ClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [reunioes, setReunioes] = useState<ClienteReuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  
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
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [clientesData, reunioesData] = await Promise.all([
          clienteRepository.getAll(user.uid),
          clienteReuniaoRepository.getByMonth(user.uid, mesFiltro, anoFiltro),
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
  }, [user, mesFiltro, anoFiltro]);

  // Mapa de reuniões por clienteId
  const reunioesMap = useMemo(() => {
    const map: Record<string, ClienteReuniao> = {};
    reunioes.forEach(r => { if (r.clienteId) map[r.clienteId] = r; });
    return map;
  }, [reunioes]);

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
        cell: (info) => (
          <button
            onClick={() => { setSelectedCliente(info.row.original); setDetalhesModalOpen(true); }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
          >
            {info.getValue() as string}
          </button>
        ),
      },
      {
        accessorKey: 'codigoConta',
        header: 'Cód. Conta',
        cell: (info) => <span className="font-mono text-sm">{(info.getValue() as string) || '—'}</span>,
      },
      {
        accessorKey: 'perfilInvestidor',
        header: 'Perfil',
        cell: (info) => {
          const perfil = (info.getValue() as string) || 'Regular';
          return <span className={`px-2 py-1 rounded-full text-xs font-medium ${perfilColors[perfil] || perfilColors.Regular}`}>{perfil}</span>;
        },
      },
      {
        id: 'reuniao',
        header: 'Reunião',
        cell: (info) => {
          const clienteId = info.row.original.id;
          const reuniao = clienteId ? reunioesMap[clienteId] : undefined;
          return reuniao?.realizada ? (
            <span className="flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" />Sim</span>
          ) : (
            <span className="flex items-center text-gray-400 text-sm"><XCircle className="w-4 h-4 mr-1" />Não</span>
          );
        },
      },
      {
        accessorKey: 'custodiaAtual',
        header: 'Custódia',
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
    [reunioesMap]
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
        <div className="flex items-center space-x-4">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
          </select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            {[2024, 2025, 2026, 2027].map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Cliente
          </button>
        </div>
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

      {/* Modal de Detalhes do Cliente */}
      {selectedCliente && (
        <ClienteDetalhesModal
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
    </div>
  );
}

// ============== COMPONENTE MODAL DETALHES ==============
interface DetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  mes: number;
  ano: number;
  reuniao?: ClienteReuniao;
  onReuniaoSaved: (r: ClienteReuniao) => void;
}

function ClienteDetalhesModal({ isOpen, onClose, cliente, mes, ano, reuniao, onReuniaoSaved }: DetalhesModalProps) {
  const { user } = useAuth();
  const [realizada, setRealizada] = useState(reuniao?.realizada || false);
  const [observacoes, setObservacoes] = useState(reuniao?.observacoes || '');
  const [saving, setSaving] = useState(false);

  // Reset ao trocar cliente ou período
  useEffect(() => {
    setRealizada(reuniao?.realizada || false);
    setObservacoes(reuniao?.observacoes || '');
  }, [reuniao, cliente.id, mes, ano]);

  const mesNome = new Date(2000, mes - 1).toLocaleString('pt-BR', { month: 'long' });
  const perfilColor = perfilColors[(cliente.perfilInvestidor as string) || 'Regular'] || perfilColors.Regular;

  const handleSaveReuniao = async () => {
    if (!user || !cliente.id) return;
    try {
      setSaving(true);
      if (reuniao?.id) {
        const updated = await clienteReuniaoRepository.update(reuniao.id, { realizada, observacoes }, user.uid);
        if (updated) { onReuniaoSaved(updated); toast.success('Reunião atualizada!'); }
      } else {
        const created = await clienteReuniaoRepository.create({ clienteId: cliente.id, mes, ano, realizada, observacoes }, user.uid);
        onReuniaoSaved(created); toast.success('Reunião salva!');
      }
    } catch (error) {
      console.error('Erro ao salvar reunião:', error);
      toast.error('Erro ao salvar reunião');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Cliente" size="lg">
      <div className="space-y-6">
        {/* Info do Cliente */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h3 className="font-semibold text-lg text-gray-900">{cliente.nome}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Código da Conta:</span> <span className="font-mono font-medium">{cliente.codigoConta || '—'}</span></div>
            <div><span className="text-gray-500">Perfil:</span> <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${perfilColor}`}>{cliente.perfilInvestidor || 'Regular'}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="font-medium">{cliente.status || '—'}</span></div>
            <div><span className="text-gray-500">Custódia:</span> <span className="font-medium">{formatCurrency(cliente.custodiaAtual || 0)}</span></div>
          </div>
        </div>

        {/* Reunião do período */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-900 mb-3">Reunião de {mesNome} {ano}</h4>
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" checked={realizada} onChange={(e) => setRealizada(e.target.checked)} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <span className="text-gray-700">Reunião realizada</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações da reunião</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="Anotações sobre a reunião..." />
            </div>
            <button onClick={handleSaveReuniao} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Reunião'}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Fechar</button>
        </div>
      </div>
    </Modal>
  );
}
