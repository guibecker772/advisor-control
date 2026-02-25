import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { planoReceitasRepository, custodiaReceitaRepository, captacaoLancamentoRepository, crossRepository } from '../../services/repositories';
import { planoReceitasSchema, type PlanoReceitas, type PlanoReceitasInput, type CustodiaReceita, type CaptacaoLancamento, type Cross } from '../../domain/types';
import {
  formatCurrency,
  formatPercent,
  calcularMetaReceitaTotal,
  calcularReceitaTotal,
  calcularAtingimento,
  getNomeMes,
  gerarRealizadoMensal,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, TextArea } from '../../components/shared/FormFields';

export default function PlanoReceitasPage() {
  const { user } = useAuth();
  const [planos, setPlanos] = useState<PlanoReceitas[]>([]);
  const [realizados, setRealizados] = useState<CustodiaReceita[]>([]);
  const [captacoes, setCaptacoes] = useState<CaptacaoLancamento[]>([]);
  const [crosses, setCrosses] = useState<Cross[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoFilling, setAutoFilling] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<PlanoReceitas | null>(null);
  const [saving, setSaving] = useState(false);

  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PlanoReceitasInput>({
    resolver: zodResolver(planoReceitasSchema),
    defaultValues: {
      mes: new Date().getMonth() + 1,
      ano: anoFiltro,
      metaCustodia: 0,
      metaCaptacao: 0,
      metaReceitaRV: 0,
      metaReceitaRF: 0,
      metaReceitaCOE: 0,
      metaReceitaFundos: 0,
      metaReceitaPrevidencia: 0,
      metaReceitaOutros: 0,
      metaReceitaTotal: 0,
      metaCross: 0,
    },
  });

  const watchedValues = watch();
  const metaReceitaCalc = useMemo(() => {
    return (
      (watchedValues.metaReceitaRV || 0) +
      (watchedValues.metaReceitaRF || 0) +
      (watchedValues.metaReceitaCOE || 0) +
      (watchedValues.metaReceitaFundos || 0) +
      (watchedValues.metaReceitaPrevidencia || 0) +
      (watchedValues.metaReceitaOutros || 0)
    );
  }, [watchedValues]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [planoData, realizadoData, captacaoData, crossData] = await Promise.all([
          planoReceitasRepository.getByYear(user.uid, anoFiltro),
          custodiaReceitaRepository.getByYear(user.uid, anoFiltro),
          captacaoLancamentoRepository.getByYear(user.uid, anoFiltro),
          crossRepository.getAll(user.uid),
        ]);
        setPlanos(planoData);
        setRealizados(realizadoData);
        setCaptacoes(captacaoData);
        // Filtrar crosses do ano
        setCrosses(crossData.filter(c => {
          // Usar mes/ano se disponível
          if (c.ano) {
            return c.ano === anoFiltro;
          }
          // Fallback: usar dataVenda
          if (!c.dataVenda) return false;
          const year = new Date(c.dataVenda).getFullYear();
          return year === anoFiltro;
        }));
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, anoFiltro]);

  const openModal = (plano?: PlanoReceitas) => {
    if (plano) {
      setSelectedPlano(plano);
      reset(plano);
    } else {
      setSelectedPlano(null);
      reset({
        mes: new Date().getMonth() + 1,
        ano: anoFiltro,
        metaCustodia: 0,
        metaCaptacao: 0,
        metaReceitaRV: 0,
        metaReceitaRF: 0,
        metaReceitaCOE: 0,
        metaReceitaFundos: 0,
        metaReceitaPrevidencia: 0,
        metaReceitaOutros: 0,
        metaReceitaTotal: 0,
        metaCross: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: PlanoReceitasInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = planoReceitasSchema.parse(data);

      // Calcular meta de receita total
      const dataWithTotal = {
        ...parsed,
        metaReceitaTotal: calcularMetaReceitaTotal(parsed),
      };

      if (selectedPlano?.id) {
        const updated = await planoReceitasRepository.update(selectedPlano.id, dataWithTotal, user.uid);
        if (updated) {
          setPlanos((prev) =>
            prev.map((p) => (p.id === selectedPlano.id ? updated : p))
          );
          toast.success('Plano atualizado com sucesso!');
        }
      } else {
        const created = await planoReceitasRepository.create(dataWithTotal, user.uid);
        setPlanos((prev) => [...prev, created]);
        toast.success('Plano criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      toast.error('Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedPlano?.id) return;

    try {
      setSaving(true);
      await planoReceitasRepository.delete(selectedPlano.id, user.uid);
      setPlanos((prev) => prev.filter((p) => p.id !== selectedPlano.id));
      toast.success('Plano excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedPlano(null);
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      toast.error('Erro ao excluir plano');
    } finally {
      setSaving(false);
    }
  };

  // Auto-preencher Realizado a partir de Custódia x Receita, Captações e Cross
  const handleAutoPreencherRealizado = async () => {
    if (!user) return;
    if (planos.length === 0) {
      toast.error('Nenhum plano cadastrado para auto-preencher');
      return;
    }

    try {
      setAutoFilling(true);
      
      // Verificar se há dados de Custódia x Receita
      if (realizados.length === 0) {
        toast('Nenhum registro de Custódia x Receita encontrado para o ano', { icon: '⚠️' });
      }

      let updated = 0;
      const updatedPlanos: PlanoReceitas[] = [];

      for (const plano of planos) {
        if (!plano.id) continue;

        // Gerar dados realizados para o mês
        const realizadoData = gerarRealizadoMensal(
          realizados,
          captacoes,
          crosses,
          plano.mes,
          plano.ano
        );

        // Atualizar apenas os campos realizados, mantendo metas (planejado) intactas
        const planoAtualizado: PlanoReceitas = {
          ...plano,
          ...realizadoData,
          realizadoReceitaTotal: realizadoData.realizadoReceitaRV +
            realizadoData.realizadoReceitaRF +
            realizadoData.realizadoReceitaCOE +
            realizadoData.realizadoReceitaFundos +
            realizadoData.realizadoReceitaPrevidencia +
            realizadoData.realizadoReceitaOutros,
        };

        const result = await planoReceitasRepository.update(plano.id, planoAtualizado, user.uid);
        if (result) {
          updatedPlanos.push(result);
          updated++;
        }
      }

      // Atualizar estado local
      setPlanos(prev => prev.map(p => {
        const updatedPlano = updatedPlanos.find(up => up.id === p.id);
        return updatedPlano || p;
      }));

      toast.success(`${updated} plano(s) atualizado(s) com valores realizados!`);
    } catch (error) {
      console.error('Erro ao auto-preencher:', error);
      toast.error('Erro ao auto-preencher dados realizados');
    } finally {
      setAutoFilling(false);
    }
  };

  // Calcular realizado por mês (agora usando dados persistidos ou calculando na hora)
  const getRealizadoMes = (plano: PlanoReceitas): number => {
    // Se já tem realizado persistido, usar
    if (plano.realizadoReceitaTotal && plano.realizadoReceitaTotal > 0) {
      return plano.realizadoReceitaTotal;
    }
    // Fallback: calcular na hora
    const registrosMes = realizados.filter((r) => r.mes === plano.mes);
    return calcularReceitaTotal(registrosMes);
  };

  const columns = useMemo<ColumnDef<PlanoReceitas>[]>(
    () => [
      {
        accessorKey: 'mes',
        header: 'Mês',
        cell: (info) => getNomeMes(info.getValue() as number),
      },
      {
        accessorKey: 'metaCustodia',
        header: 'Meta Custódia',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'realizadoCustodia',
        header: 'Real. Custódia',
        cell: (info) => <CurrencyCell value={info.row.original.realizadoCustodia || 0} />,
      },
      {
        accessorKey: 'metaCaptacao',
        header: 'Meta Captação',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'realizadoCaptacao',
        header: 'Real. Captação',
        cell: (info) => {
          const val = info.row.original.realizadoCaptacao || 0;
          return <CurrencyCell value={val} />;
        },
      },
      {
        id: 'metaReceita',
        header: 'Meta Receita',
        cell: (info) => <CurrencyCell value={calcularMetaReceitaTotal(info.row.original)} />,
      },
      {
        id: 'realizado',
        header: 'Real. Receita',
        cell: (info) => {
          const realizado = getRealizadoMes(info.row.original);
          return <CurrencyCell value={realizado} />;
        },
      },
      {
        id: 'atingimento',
        header: 'Atingimento',
        cell: (info) => {
          const meta = calcularMetaReceitaTotal(info.row.original);
          const realizado = getRealizadoMes(info.row.original);
          const atingimento = calcularAtingimento(meta, realizado);
          return (
            <span className={`font-medium ${atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(atingimento)}
            </span>
          );
        },
      },
      {
        id: 'gap',
        header: 'GAP',
        cell: (info) => {
          const meta = calcularMetaReceitaTotal(info.row.original);
          const realizado = getRealizadoMes(info.row.original);
          const gap = realizado - meta;
          return <CurrencyCell value={gap} />;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedPlano(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    [realizados, captacoes, crosses]
  );

  const totais = useMemo(() => {
    const metaTotal = planos.reduce((sum, p) => sum + calcularMetaReceitaTotal(p), 0);
    // Usar realizadoReceitaTotal persistido ou calcular na hora
    const realizadoTotal = planos.reduce((sum, p) => sum + getRealizadoMes(p), 0);
    const atingimento = calcularAtingimento(metaTotal, realizadoTotal);
    const gap = realizadoTotal - metaTotal;

    return {
      planos: planos.length,
      metaTotal,
      realizadoTotal,
      atingimento,
      gap,
    };
  }, [planos, realizados]);

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
          <h1 className="text-2xl font-bold text-gray-900">Plano de Receitas</h1>
          <p className="text-gray-600">Metas e acompanhamento - {anoFiltro}</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {[2024, 2025, 2026, 2027].map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
          <button
            onClick={handleAutoPreencherRealizado}
            disabled={autoFilling || planos.length === 0}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Preenche automaticamente os valores realizados a partir de Custódia x Receita, Captações e Cross"
          >
            <Zap className="w-5 h-5 mr-2" />
            {autoFilling ? 'Preenchendo...' : 'Auto-preencher Realizado'}
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Meta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Meses Planejados</p>
          <p className="text-2xl font-bold text-gray-900">{totais.planos}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Meta Anual</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.metaTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Realizado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.realizadoTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Atingimento</p>
          <p className={`text-2xl font-bold ${totais.atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(totais.atingimento)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">GAP</p>
          <p className={`text-2xl font-bold ${totais.gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totais.gap)}
          </p>
        </div>
      </div>

      <DataTable
        data={planos}
        columns={columns}
        searchPlaceholder="Buscar planos..."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedPlano ? 'Editar Meta' : 'Nova Meta'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Mês"
              type="number"
              min="1"
              max="12"
              {...register('mes', { valueAsNumber: true })}
              error={errors.mes?.message}
            />
            <Input
              label="Ano"
              type="number"
              min="2020"
              max="2100"
              {...register('ano', { valueAsNumber: true })}
              error={errors.ano?.message}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Metas Gerais</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Meta Custódia"
                type="number"
                step="0.01"
                {...register('metaCustodia', { valueAsNumber: true })}
                error={errors.metaCustodia?.message}
              />
              <Input
                label="Meta Captação"
                type="number"
                step="0.01"
                {...register('metaCaptacao', { valueAsNumber: true })}
                error={errors.metaCaptacao?.message}
              />
              <Input
                label="Meta Cross"
                type="number"
                step="0.01"
                {...register('metaCross', { valueAsNumber: true })}
                error={errors.metaCross?.message}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Metas de Receita (Total: {formatCurrency(metaReceitaCalc)})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Renda Variável"
                type="number"
                step="0.01"
                {...register('metaReceitaRV', { valueAsNumber: true })}
                error={errors.metaReceitaRV?.message}
              />
              <Input
                label="Renda Fixa"
                type="number"
                step="0.01"
                {...register('metaReceitaRF', { valueAsNumber: true })}
                error={errors.metaReceitaRF?.message}
              />
              <Input
                label="COE"
                type="number"
                step="0.01"
                {...register('metaReceitaCOE', { valueAsNumber: true })}
                error={errors.metaReceitaCOE?.message}
              />
              <Input
                label="Fundos"
                type="number"
                step="0.01"
                {...register('metaReceitaFundos', { valueAsNumber: true })}
                error={errors.metaReceitaFundos?.message}
              />
              <Input
                label="Previdência"
                type="number"
                step="0.01"
                {...register('metaReceitaPrevidencia', { valueAsNumber: true })}
                error={errors.metaReceitaPrevidencia?.message}
              />
              <Input
                label="Outros"
                type="number"
                step="0.01"
                {...register('metaReceitaOutros', { valueAsNumber: true })}
                error={errors.metaReceitaOutros?.message}
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
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedPlano ? 'Atualizar' : 'Criar'}
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
