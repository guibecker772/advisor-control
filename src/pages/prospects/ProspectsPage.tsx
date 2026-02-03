import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Bell, Phone, Mail, MessageSquare, Users, Calendar, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { prospectRepository, prospectInteracaoRepository } from '../../services/repositories';
import { prospectSchema, type Prospect, type ProspectInput, type ProspectInteracao } from '../../domain/types';
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
  { value: 'liberta', label: 'Liberta' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'evento', label: 'Evento' },
  { value: 'site', label: 'Site' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'outros', label: 'Outros' },
];

const tipoOptions = [
  { value: 'captacao_liquida', label: 'Captação Líquida' },
  { value: 'transferencia_xp', label: 'Transferência XP' },
];

const interacaoTipoOptions = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
  { value: 'outro', label: 'Outro' },
];

const interacaoIcons: Record<string, React.ReactNode> = {
  ligacao: <Phone className="w-4 h-4" />,
  reuniao: <Users className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  visita: <Calendar className="w-4 h-4" />,
  outro: <Bell className="w-4 h-4" />,
};

export default function ProspectsPage() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [interacoes, setInteracoes] = useState<ProspectInteracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
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

    const loadData = async () => {
      try {
        setLoading(true);
        const [prospectsData, interacoesData] = await Promise.all([
          prospectRepository.getAll(user.uid),
          prospectInteracaoRepository.getAll(user.uid),
        ]);
        setProspects(prospectsData);
        setInteracoes(interacoesData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Lembretes: prospects com próximo contato hoje ou atrasado
  const lembretes = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return prospects.filter((p) => p.proximoContato && p.proximoContato <= hoje && !['ganho', 'perdido'].includes(p.status));
  }, [prospects]);

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
        potencialTipo: 'captacao_liquida',
        probabilidade: 50,
        proximoContato: '',
        proximoContatoHora: '',
        realizadoValor: 0,
        realizadoTipo: 'captacao_liquida',
        realizadoData: '',
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
        cell: (info) => (
          <button
            onClick={() => { setSelectedProspect(info.row.original); setDetalhesModalOpen(true); }}
            className="font-medium text-purple-600 hover:text-purple-800 hover:underline text-left"
          >
            {info.getValue() as string}
          </button>
        ),
      },
      {
        accessorKey: 'origem',
        header: 'Origem',
        cell: (info) => {
          const origem = info.getValue() as string;
          const option = origemOptions.find((o) => o.value === origem);
          const isLiberta = origem === 'liberta';
          return <span className={isLiberta ? 'px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium' : ''}>{option?.label || origem || '-'}</span>;
        },
      },
      {
        accessorKey: 'proximoContato',
        header: 'Próx. Contato',
        cell: (info) => {
          const data = info.getValue() as string;
          if (!data) return <span className="text-gray-400">—</span>;
          const hoje = new Date().toISOString().split('T')[0];
          const atrasado = data < hoje;
          const ehHoje = data === hoje;
          const hora = info.row.original.proximoContatoHora || '';
          return (
            <span className={`flex items-center text-sm ${atrasado ? 'text-red-600 font-semibold' : ehHoje ? 'text-orange-600 font-semibold' : ''}`}>
              {atrasado && <AlertTriangle className="w-4 h-4 mr-1" />}
              {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')} {hora && `${hora}`}
            </span>
          );
        },
      },
      {
        accessorKey: 'potencial',
        header: 'Potencial (Pipe)',
        cell: (info) => {
          const tipo = info.row.original.potencialTipo || 'captacao_liquida';
          const label = tipo === 'transferencia_xp' ? 'TXP' : 'CL';
          return <span><CurrencyCell value={info.getValue() as number} /> <span className="text-xs text-gray-500">({label})</span></span>;
        },
      },
      {
        accessorKey: 'realizadoValor',
        header: 'Realizado',
        cell: (info) => {
          const val = info.getValue() as number;
          if (!val) return <span className="text-gray-400">—</span>;
          const tipo = info.row.original.realizadoTipo || 'captacao_liquida';
          const label = tipo === 'transferencia_xp' ? 'TXP' : 'CL';
          return <span className="text-green-600"><CurrencyCell value={val} /> <span className="text-xs">({label})</span></span>;
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
    // Pipe (potencial)
    const pipeCL = ativos.filter((p) => p.potencialTipo !== 'transferencia_xp').reduce((sum, p) => sum + (p.potencial || 0), 0);
    const pipeTXP = ativos.filter((p) => p.potencialTipo === 'transferencia_xp').reduce((sum, p) => sum + (p.potencial || 0), 0);
    // Realizado
    const realizadoCL = prospects.filter((p) => p.realizadoTipo !== 'transferencia_xp').reduce((sum, p) => sum + (p.realizadoValor || 0), 0);
    const realizadoTXP = prospects.filter((p) => p.realizadoTipo === 'transferencia_xp').reduce((sum, p) => sum + (p.realizadoValor || 0), 0);
    return {
      total: prospects.length,
      ativos: ativos.length,
      pipeCL,
      pipeTXP,
      pipeTotal: pipeCL + pipeTXP,
      realizadoCL,
      realizadoTXP,
      realizadoTotal: realizadoCL + realizadoTXP,
      lembretes: lembretes.length,
    };
  }, [prospects, lembretes]);

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

      {/* Lembretes */}
      {lembretes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center text-orange-700 font-semibold mb-2"><Bell className="w-5 h-5 mr-2" />Contatos pendentes ({lembretes.length})</div>
          <div className="flex flex-wrap gap-2">
            {lembretes.slice(0, 5).map((p) => (
              <button key={p.id} onClick={() => { setSelectedProspect(p); setDetalhesModalOpen(true); }} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm hover:bg-orange-200">{p.nome}</button>
            ))}
            {lembretes.length > 5 && <span className="text-orange-600 text-sm">+{lembretes.length - 5} mais</span>}
          </div>
        </div>
      )}

      {/* KPIs - Pipe x Realizado */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Ativos</p>
          <p className="text-2xl font-bold text-purple-600">{totais.ativos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pipe Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.pipeTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pipe CL</p>
          <p className="text-xl font-bold text-blue-500">{formatCurrency(totais.pipeCL)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Pipe TXP</p>
          <p className="text-xl font-bold text-indigo-500">{formatCurrency(totais.pipeTXP)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Realizado CL</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totais.realizadoCL)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Realizado TXP</p>
          <p className="text-xl font-bold text-teal-600">{formatCurrency(totais.realizadoTXP)}</p>
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
            <Select
              label="Tipo Potencial"
              options={tipoOptions}
              {...register('potencialTipo')}
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
            <Input
              label="Hora"
              type="time"
              {...register('proximoContatoHora')}
            />
          </div>

          {/* Realizado */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-gray-700 mb-3">Realizado (quando convertido)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Valor Realizado"
                type="number"
                step="0.01"
                {...register('realizadoValor', { valueAsNumber: true })}
              />
              <Select
                label="Tipo Realizado"
                options={tipoOptions}
                {...register('realizadoTipo')}
              />
              <Input
                label="Data Realizado"
                type="date"
                {...register('realizadoData')}
              />
            </div>
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

      {/* Modal de Detalhes do Prospect */}
      {selectedProspect && (
        <ProspectDetalhesModal
          isOpen={detalhesModalOpen}
          onClose={() => setDetalhesModalOpen(false)}
          prospect={selectedProspect}
          interacoes={interacoes.filter((i) => i.prospectId === selectedProspect.id)}
          onInteracaoSaved={(i) => setInteracoes((prev) => {
            const idx = prev.findIndex((x) => x.id === i.id);
            return idx >= 0 ? prev.map((x) => (x.id === i.id ? i : x)) : [...prev, i];
          })}
          onInteracaoDeleted={(id) => setInteracoes((prev) => prev.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}

// ============== MODAL DE DETALHES DO PROSPECT ==============
interface DetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: Prospect;
  interacoes: ProspectInteracao[];
  onInteracaoSaved: (i: ProspectInteracao) => void;
  onInteracaoDeleted: (id: string) => void;
}

function ProspectDetalhesModal({ isOpen, onClose, prospect, interacoes, onInteracaoSaved, onInteracaoDeleted }: DetalhesModalProps) {
  const { user } = useAuth();
  const [novaInteracao, setNovaInteracao] = useState({ tipo: 'ligacao', data: '', resumo: '' });
  const [saving, setSaving] = useState(false);

  const handleAddInteracao = async () => {
    if (!user || !prospect.id || !novaInteracao.data) return;
    try {
      setSaving(true);
      const created = await prospectInteracaoRepository.create({
        prospectId: prospect.id,
        tipo: novaInteracao.tipo as 'ligacao' | 'reuniao' | 'email' | 'whatsapp' | 'visita' | 'outro',
        data: novaInteracao.data,
        resumo: novaInteracao.resumo,
      }, user.uid);
      onInteracaoSaved(created);
      setNovaInteracao({ tipo: 'ligacao', data: '', resumo: '' });
      toast.success('Interação adicionada!');
    } catch (error) {
      toast.error('Erro ao adicionar interação');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInteracao = async (id: string) => {
    if (!user) return;
    try {
      await prospectInteracaoRepository.delete(id, user.uid);
      onInteracaoDeleted(id);
      toast.success('Interação excluída!');
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const sortedInteracoes = [...interacoes].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes: ${prospect.nome}`} size="lg">
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Origem:</span> <span className="font-medium">{origemOptions.find((o) => o.value === prospect.origem)?.label || prospect.origem || '—'}</span></div>
          <div><span className="text-gray-500">Status:</span> <span className="font-medium">{statusOptions.find((s) => s.value === prospect.status)?.label || prospect.status}</span></div>
          <div><span className="text-gray-500">Potencial:</span> <span className="font-medium">{formatCurrency(prospect.potencial || 0)} ({prospect.potencialTipo === 'transferencia_xp' ? 'TXP' : 'CL'})</span></div>
          <div><span className="text-gray-500">Realizado:</span> <span className="font-medium text-green-600">{formatCurrency(prospect.realizadoValor || 0)}</span></div>
          <div><span className="text-gray-500">Próx. Contato:</span> <span className="font-medium">{prospect.proximoContato ? new Date(prospect.proximoContato + 'T00:00:00').toLocaleDateString('pt-BR') : '—'} {prospect.proximoContatoHora || ''}</span></div>
          <div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{prospect.telefone || '—'}</span></div>
        </div>

        {/* Nova Interação */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-900 mb-3">Adicionar Interação</h4>
          <div className="flex flex-wrap gap-2 items-end">
            <select value={novaInteracao.tipo} onChange={(e) => setNovaInteracao({ ...novaInteracao, tipo: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
              {interacaoTipoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" value={novaInteracao.data} onChange={(e) => setNovaInteracao({ ...novaInteracao, data: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
            <input type="text" placeholder="Resumo" value={novaInteracao.resumo} onChange={(e) => setNovaInteracao({ ...novaInteracao, resumo: e.target.value })} className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md text-sm" />
            <button onClick={handleAddInteracao} disabled={saving || !novaInteracao.data} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm">
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>

        {/* Timeline de Interações */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-900 mb-3">Histórico de Contatos ({interacoes.length})</h4>
          {sortedInteracoes.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma interação registrada.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sortedInteracoes.map((i) => (
                <div key={i.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg group">
                  <div className="text-purple-600">{interacaoIcons[i.tipo] || <Bell className="w-4 h-4" />}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{interacaoTipoOptions.find((o) => o.value === i.tipo)?.label || i.tipo}</span>
                      <span className="text-xs text-gray-500">{new Date(i.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    {i.resumo && <p className="text-sm text-gray-600 mt-1">{i.resumo}</p>}
                  </div>
                  <button onClick={() => i.id && handleDeleteInteracao(i.id)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 text-xs">Excluir</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Fechar</button>
        </div>
      </div>
    </Modal>
  );
}
