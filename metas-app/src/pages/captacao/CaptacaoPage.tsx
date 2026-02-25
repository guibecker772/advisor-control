import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, ArrowUpCircle, ArrowDownCircle, UserCheck } from 'lucide-react';
import { toastSuccess, toastError } from '../../lib/toast';
import { subscribeDataInvalidation } from '../../lib/dataInvalidation';

import { useAuth } from '../../contexts/AuthContext';
import { captacaoLancamentoRepository, clienteRepository, prospectRepository } from '../../services/repositories';
import { captacaoLancamentoSchema, type CaptacaoLancamento, type CaptacaoLancamentoInput, type Cliente, type Prospect } from '../../domain/types';
import { formatCurrency } from '../../domain/calculations';
import { getCaptacaoResumoPeriodo } from '../../domain/calculations/captacaoPeriodo';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDialog, PageHeader, PageSkeleton } from '../../components/ui';
import { Input, Select, TextArea } from '../../components/shared/FormFields';
import ClientSelect from '../../components/clientes/ClientSelect';

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

const bucketOptions = [
  { value: 'onshore', label: 'OnShore' },
  { value: 'offshore', label: 'OffShore' },
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
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
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
  const selectedClientId = watch('referenciaId') || '';
  const clientSelectOptions = useMemo(
    () => clientes
      .filter((cliente) => Boolean(cliente.id))
      .map((cliente) => ({
        value: cliente.id || '',
        label: cliente.nome,
        hint: [cliente.cpfCnpj, cliente.codigoConta, cliente.email, cliente.telefone].filter(Boolean).join(' | '),
        searchText: [cliente.nome, cliente.cpfCnpj, cliente.codigoConta, cliente.email, cliente.telefone].filter(Boolean).join(' '),
      })),
    [clientes],
  );

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setLancamentos([]);
      setClientes([]);
      setProspects([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [lancData, clienteData, prospectData] = await Promise.all([
        captacaoLancamentoRepository.getAll(ownerUid),
        clienteRepository.getAll(ownerUid),
        prospectRepository.getAll(ownerUid),
      ]);
      const resumoPeriodo = getCaptacaoResumoPeriodo(lancData, mesFiltro, anoFiltro);
      setLancamentos(resumoPeriodo.lancamentosPeriodo);
      setClientes(clienteData);
      setProspects(prospectData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toastError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [anoFiltro, authLoading, mesFiltro, ownerUid]);

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData]);

  useEffect(() => {
    if (authLoading || !ownerUid) return;
    return subscribeDataInvalidation(['captacao', 'prospects', 'clients'], async () => {
      await loadData();
    });
  }, [authLoading, loadData, ownerUid]);

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
        bucket: undefined,
        valor: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  // Função para atualizar custódia do cliente (Etapa 7)
  // delta > 0 = soma na custódia, delta < 0 = subtrai
  const atualizarCustodiaCliente = async (clienteId: string, delta: number, bucket: 'onshore' | 'offshore') => {
    if (!ownerUid || !clienteId) return;
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    // Atualizar bucket específico
    const novoOnShore = (cliente.custodiaOnShore || 0) + (bucket === 'onshore' ? delta : 0);
    const novoOffShore = (cliente.custodiaOffShore || 0) + (bucket === 'offshore' ? delta : 0);
    
    // CORREÇÃO: somar delta à custodiaAtual existente (não recalcular somando buckets)
    // Isso evita o bug quando cliente tem custodiaAtual preenchida mas buckets zerados
    const novaCustodiaAtual = (cliente.custodiaAtual || 0) + delta;

    await clienteRepository.update(clienteId, {
      custodiaOnShore: novoOnShore,
      custodiaOffShore: novoOffShore,
      custodiaAtual: novaCustodiaAtual,
    }, ownerUid);

    // Atualizar estado local de clientes
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, custodiaOnShore: novoOnShore, custodiaOffShore: novoOffShore, custodiaAtual: novaCustodiaAtual } : c));
  };

  // Calcula delta com sinal correto: entrada = +, saída = -
  const calcularDelta = (direcao: 'entrada' | 'saida', valor: number): number => {
    return direcao === 'entrada' ? valor : -valor;
  };

  const bucketWatch = watch('bucket');

  const onSubmit = async (data: CaptacaoLancamentoInput) => {
    if (!ownerUid) return;

    // Validar bucket obrigatório para origem=cliente
    if (data.origem === 'cliente' && !data.bucket) {
      toastError('Selecione OnShore ou OffShore para lançamentos de cliente');
      return;
    }

    try {
      setSaving(true);
      const dataDate = new Date(data.data + 'T00:00:00');
      const parsed = captacaoLancamentoSchema.parse({
        ...data,
        mes: dataDate.getMonth() + 1,
        ano: dataDate.getFullYear(),
      });

      if (selectedLancamento?.id) {
        // EDIÇÃO: reverter delta antigo e aplicar novo
        const antigo = selectedLancamento;
        const antigoDelta = antigo.origem === 'cliente' && antigo.referenciaId && antigo.bucket
          ? calcularDelta(antigo.direcao, antigo.valor)
          : 0;
        const novoDelta = parsed.origem === 'cliente' && parsed.referenciaId && parsed.bucket
          ? calcularDelta(parsed.direcao, parsed.valor)
          : 0;

        const updated = await captacaoLancamentoRepository.update(selectedLancamento.id, parsed, ownerUid);
        if (updated) {

          // Reverter custódia antiga (se havia cliente vinculado)
          if (antigo.origem === 'cliente' && antigo.referenciaId && antigo.bucket) {
            await atualizarCustodiaCliente(antigo.referenciaId, -antigoDelta, antigo.bucket);
          }
          // Aplicar custódia nova (se há cliente vinculado)
          if (parsed.origem === 'cliente' && parsed.referenciaId && parsed.bucket) {
            await atualizarCustodiaCliente(parsed.referenciaId, novoDelta, parsed.bucket);
          }

          await loadData();
          toastSuccess('Lançamento atualizado!');
        }
      } else {
        // CRIAÇÃO: aplicar delta na custódia do cliente
        await captacaoLancamentoRepository.create(parsed, ownerUid);

        // Atualizar custódia do cliente SOMENTE se origem=cliente
        if (parsed.origem === 'cliente' && parsed.referenciaId && parsed.bucket) {
          const delta = calcularDelta(parsed.direcao, parsed.valor);
          await atualizarCustodiaCliente(parsed.referenciaId, delta, parsed.bucket);
        }

        await loadData();
        toastSuccess('Lançamento criado!');
      }
      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toastError('Erro ao salvar lançamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ownerUid || !selectedLancamento?.id) return;
    try {
      setSaving(true);

      // Reverter custódia ANTES de excluir (se origem=cliente)
      const lanc = selectedLancamento;
      if (lanc.origem === 'cliente' && lanc.referenciaId && lanc.bucket) {
        const deltaOriginal = calcularDelta(lanc.direcao, lanc.valor);
        // Reverter = aplicar o inverso
        await atualizarCustodiaCliente(lanc.referenciaId, -deltaOriginal, lanc.bucket);
      }

      await captacaoLancamentoRepository.delete(selectedLancamento.id, ownerUid);
      await loadData();
      toastSuccess('Lançamento excluído!');
      setDeleteModalOpen(false);
      setSelectedLancamento(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toastError('Erro ao excluir');
    } finally {
      setSaving(false);
    }
  };

  const kpis = useMemo(() => {
    const resumo = getCaptacaoResumoPeriodo(lancamentos, mesFiltro, anoFiltro);
    return {
      entradas: resumo.entradas,
      saidas: resumo.saidas,
      saldo: resumo.entradas - resumo.saidas,
      captacaoLiquida: resumo.captacaoLiquida,
      transferenciaXP: resumo.transferenciaXp,
    };
  }, [anoFiltro, lancamentos, mesFiltro]);

  const columns = useMemo<ColumnDef<CaptacaoLancamento>[]>(() => [
    { accessorKey: 'data', header: 'Data', cell: (info) => info.getValue() },
    {
      accessorKey: 'direcao',
      header: 'Direção',
      cell: (info) => {
        const v = info.getValue() as string;
        return v === 'entrada' ? (
          <span className="flex items-center" style={{ color: 'var(--color-success)' }}><ArrowUpCircle className="w-4 h-4 mr-1" /> Entrada</span>
        ) : (
          <span className="flex items-center" style={{ color: 'var(--color-danger)' }}><ArrowDownCircle className="w-4 h-4 mr-1" /> Saída</span>
        );
      },
    },
    { accessorKey: 'tipo', header: 'Tipo', cell: (info) => tipoLabels[info.getValue() as string] || info.getValue() },
    { 
      accessorKey: 'origem', 
      header: 'Origem', 
      cell: (info) => {
        const row = info.row.original;
        const val = info.getValue() as string;
        const isDerivado = row.id?.startsWith('derived-');
        return (
          <span className="flex items-center gap-1">
            {isDerivado && <UserCheck className="w-4 h-4" style={{ color: 'var(--color-chart-4)' }} />}
            {origemLabels[val] || val}
            {isDerivado && <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--chart-4)' }}>Auto</span>}
          </span>
        );
      } 
    },
    { accessorKey: 'referenciaNome', header: 'Referência', cell: (info) => info.getValue() || '-' },
    { accessorKey: 'bucket', header: 'Bucket', cell: (info) => { const v = info.getValue() as string; return v ? (v === 'onshore' ? 'OnShore' : 'OffShore') : '-'; } },
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
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captação"
        subtitle="Lançamentos de entradas e saídas"
        actions={
          <div className="flex items-center space-x-4">
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(Number(e.target.value))}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
            </select>
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(Number(e.target.value))}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {[2024, 2025, 2026, 2027].map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
            <button
              onClick={() => openModal()}
              className="flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all hover:brightness-110"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              <Plus className="w-5 h-5 mr-2" /> Novo Lançamento
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Entradas</p><p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatCurrency(kpis.entradas)}</p></div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Saídas</p><p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatCurrency(kpis.saidas)}</p></div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Saldo do Mês</p><p className="text-2xl font-bold" style={{ color: kpis.saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatCurrency(kpis.saldo)}</p></div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Captação Líquida</p><p className="text-2xl font-bold" style={{ color: 'var(--color-info)' }}>{formatCurrency(kpis.captacaoLiquida)}</p></div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Transferência XP</p><p className="text-2xl font-bold" style={{ color: 'var(--color-chart-4)' }}>{formatCurrency(kpis.transferenciaXP)}</p></div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ClientSelect
                label="Cliente *"
                value={selectedClientId}
                options={clientSelectOptions}
                loading={loading}
                onChange={(nextValue) => {
                  const sel = clientes.find((c) => c.id === nextValue);
                  setValue('referenciaId', nextValue, { shouldDirty: true, shouldValidate: true });
                  setValue('referenciaNome', sel?.nome || '');
                }}
                error={errors.referenciaId?.message}
                placeholder="Selecione o cliente"
              />
              <Select
                label="Bucket *"
                options={[{ value: '', label: 'Selecione OnShore ou OffShore' }, ...bucketOptions]}
                {...register('bucket')}
                error={origemWatch === 'cliente' && !bucketWatch ? 'Bucket é obrigatório para cliente' : undefined}
              />
            </div>
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
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium rounded-md transition-colors hover:brightness-95" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md transition-all hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}>{saving ? 'Salvando...' : selectedLancamento ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Lançamento"
        message="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
