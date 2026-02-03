import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { captacaoLancamentoRepository, clienteRepository, prospectRepository } from '../../services/repositories';
import { captacaoLancamentoSchema, type CaptacaoLancamento, type CaptacaoLancamentoInput, type Cliente, type Prospect } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, Select, TextArea } from '../../components/shared/FormFields';

const direcaoOptions = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
];

const tipoOptions = [
  { value: 'captacao_liquida', label: 'Captação Líquida' },
  { value: 'transferencia_xp', label: 'Transferência XP' },
  { value: 'troca_escritorio', label: 'Troca de Escritório' },
  { value: 'resgate', label: 'Resgate' },
  { value: 'outros', label: 'Outros' },
];

const origemOptions = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'manual', label: 'Manual' },
];

const tipoLabels: Record<string, string> = {
  captacao_liquida: 'Captação Líquida',
  transferencia_xp: 'Transferência XP',
  troca_escritorio: 'Troca de Escritório',
  resgate: 'Resgate',
  outros: 'Outros',
};

const origemLabels: Record<string, string> = {
  cliente: 'Cliente',
  prospect: 'Prospect',
  manual: 'Manual',
};

export default function CaptacaoPage() {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<CaptacaoLancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLancamento, setSelectedLancamento] = useState<CaptacaoLancamento | null>(null);
  const [saving, setSaving] = useState(false);

  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CaptacaoLancamentoInput>({
    resolver: zodResolver(captacaoLancamentoSchema),
    defaultValues: {
      direcao: 'entrada',
      tipo: 'captacao_liquida',
      origem: 'manual',
      valor: 0,
    },
  });

  const origemWatch = watch('origem');

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const [lancData, clienteData, prospectData] = await Promise.all([
          captacaoLancamentoRepository.getByMonth(user.uid, mesFiltro, anoFiltro),
          clienteRepository.getAll(user.uid),
          prospectRepository.getAll(user.uid),
        ]);
        setLancamentos(lancData);
        setClientes(clienteData);
        setProspects(prospectData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, mesFiltro, anoFiltro]);

  const openModal = (lanc?: CaptacaoLancamento) => {
    if (lanc) {
      setSelectedLancamento(lanc);
      reset(lanc);
    } else {
      setSelectedLancamento(null);
      reset({
        data: new Date().toISOString().split('T')[0],
        mes: mesFiltro,
        ano: anoFiltro,
        direcao: 'entrada',
        tipo: 'captacao_liquida',
        origem: 'manual',
        valor: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: CaptacaoLancamentoInput) => {
    if (!user) return;
    try {
      setSaving(true);
      const dataDate = new Date(data.data + 'T00:00:00');
      const parsed = captacaoLancamentoSchema.parse({
        ...data,
        mes: dataDate.getMonth() + 1,
        ano: dataDate.getFullYear(),
      });

      if (selectedLancamento?.id) {
        const updated = await captacaoLancamentoRepository.update(selectedLancamento.id, parsed, user.uid);
        if (updated) {
          setLancamentos((prev) => prev.map((l) => (l.id === selectedLancamento.id ? updated : l)));
          toast.success('Lançamento atualizado!');
        }
      } else {
        const created = await captacaoLancamentoRepository.create(parsed, user.uid);
        setLancamentos((prev) => [...prev, created]);
        toast.success('Lançamento criado!');
      }
      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar lançamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedLancamento?.id) return;
    try {
      setSaving(true);
      await captacaoLancamentoRepository.delete(selectedLancamento.id, user.uid);
      setLancamentos((prev) => prev.filter((l) => l.id !== selectedLancamento.id));
      toast.success('Lançamento excluído!');
      setDeleteModalOpen(false);
      setSelectedLancamento(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    } finally {
      setSaving(false);
    }
  };

  const kpis = useMemo(() => {
    const entradas = lancamentos.filter((l) => l.direcao === 'entrada').reduce((sum, l) => sum + (l.valor || 0), 0);
    const saidas = lancamentos.filter((l) => l.direcao === 'saida').reduce((sum, l) => sum + (l.valor || 0), 0);
    const captacaoLiquida = lancamentos.filter((l) => l.tipo === 'captacao_liquida')
      .reduce((sum, l) => sum + (l.direcao === 'entrada' ? l.valor : -l.valor), 0);
    const transferenciaXP = lancamentos.filter((l) => l.tipo === 'transferencia_xp')
      .reduce((sum, l) => sum + (l.direcao === 'entrada' ? l.valor : -l.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas, captacaoLiquida, transferenciaXP };
  }, [lancamentos]);

  const columns = useMemo<ColumnDef<CaptacaoLancamento>[]>(() => [
    { accessorKey: 'data', header: 'Data', cell: (info) => info.getValue() },
    {
      accessorKey: 'direcao',
      header: 'Direção',
      cell: (info) => {
        const v = info.getValue() as string;
        return v === 'entrada' ? (
          <span className="flex items-center text-green-600"><ArrowUpCircle className="w-4 h-4 mr-1" /> Entrada</span>
        ) : (
          <span className="flex items-center text-red-600"><ArrowDownCircle className="w-4 h-4 mr-1" /> Saída</span>
        );
      },
    },
    { accessorKey: 'tipo', header: 'Tipo', cell: (info) => tipoLabels[info.getValue() as string] || info.getValue() },
    { accessorKey: 'origem', header: 'Origem', cell: (info) => origemLabels[info.getValue() as string] || info.getValue() },
    { accessorKey: 'referenciaNome', header: 'Referência', cell: (info) => info.getValue() || '-' },
    { accessorKey: 'valor', header: 'Valor', cell: (info) => <CurrencyCell value={info.getValue() as number} /> },
    { accessorKey: 'observacoes', header: 'Obs', cell: (info) => info.getValue() || '-' },
    {
      id: 'actions',
      header: 'Ações',
      cell: (info) => (
        <ActionButtons
          onEdit={() => openModal(info.row.original)}
          onDelete={() => { setSelectedLancamento(info.row.original); setDeleteModalOpen(true); }}
        />
      ),
    },
  ], []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Captação</h1>
          <p className="text-gray-600">Lançamentos de entradas e saídas</p>
        </div>
        <div className="flex items-center space-x-4">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md">
            {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
          </select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-md">
            {[2024, 2025, 2026, 2027].map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
          <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Plus className="w-5 h-5 mr-2" /> Novo Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-600">Entradas</p><p className="text-2xl font-bold text-green-600">{formatCurrency(kpis.entradas)}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-600">Saídas</p><p className="text-2xl font-bold text-red-600">{formatCurrency(kpis.saidas)}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-600">Saldo do Mês</p><p className={`text-2xl font-bold ${kpis.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(kpis.saldo)}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-600">Captação Líquida</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(kpis.captacaoLiquida)}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-600">Transferência XP</p><p className="text-2xl font-bold text-purple-600">{formatCurrency(kpis.transferenciaXP)}</p></div>
      </div>

      <DataTable data={lancamentos} columns={columns} searchPlaceholder="Buscar lançamentos..." />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedLancamento ? 'Editar Lançamento' : 'Novo Lançamento'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Data" type="date" {...register('data')} error={errors.data?.message} />
            <Select label="Direção" options={direcaoOptions} {...register('direcao')} error={errors.direcao?.message} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Tipo" options={tipoOptions} {...register('tipo')} error={errors.tipo?.message} />
            <Select label="Origem" options={origemOptions} {...register('origem')} error={errors.origem?.message} />
          </div>
          {origemWatch === 'cliente' && (
            <Select
              label="Cliente"
              options={clientes.map((c) => ({ value: c.id!, label: c.nome }))}
              {...register('referenciaId')}
              onChange={(e) => {
                const sel = clientes.find((c) => c.id === e.target.value);
                setValue('referenciaNome', sel?.nome || '');
              }}
            />
          )}
          {origemWatch === 'prospect' && (
            <Select
              label="Prospect"
              options={prospects.map((p) => ({ value: p.id!, label: p.nome }))}
              {...register('referenciaId')}
              onChange={(e) => {
                const sel = prospects.find((p) => p.id === e.target.value);
                setValue('referenciaNome', sel?.nome || '');
              }}
            />
          )}
          <Input label="Valor" type="number" step="0.01" {...register('valor', { valueAsNumber: true })} error={errors.valor?.message} />
          <TextArea label="Observações" {...register('observacoes')} />
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Salvando...' : selectedLancamento ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDelete isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDelete} loading={saving} />
    </div>
  );
}
