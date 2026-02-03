import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { planoReceitasRepository, custodiaReceitaRepository } from '../../services/repositories';
import { planoReceitasSchema, type PlanoReceitas, type PlanoReceitasInput, type CustodiaReceita } from '../../domain/types';
import {
  formatCurrency,
  formatPercent,
  calcularMetaReceitaTotal,
  calcularReceitaTotal,
  calcularAtingimento,
  getNomeMes,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, TextArea } from '../../components/shared/FormFields';

export default function PlanoReceitasPage() {
  const { user } = useAuth();
  const [planos, setPlanos] = useState<PlanoReceitas[]>([]);
  const [realizados, setRealizados] = useState<CustodiaReceita[]>([]);
  const [loading, setLoading] = useState(true);
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
        const [planoData, realizadoData] = await Promise.all([
          planoReceitasRepository.getByYear(user.uid, anoFiltro),
          custodiaReceitaRepository.getByYear(user.uid, anoFiltro),
        ]);
        setPlanos(planoData);
        setRealizados(realizadoData);
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

  // Calcular realizado por mês
  const getRealizadoMes = (mes: number): number => {
    const registrosMes = realizados.filter((r) => r.mes === mes);
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
        accessorKey: 'metaCaptacao',
        header: 'Meta Captação',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'metaReceita',
        header: 'Meta Receita',
        cell: (info) => <CurrencyCell value={calcularMetaReceitaTotal(info.row.original)} />,
      },
      {
        id: 'realizado',
        header: 'Realizado',
        cell: (info) => {
          const realizado = getRealizadoMes(info.row.original.mes);
          return <CurrencyCell value={realizado} />;
        },
      },
      {
        id: 'atingimento',
        header: 'Atingimento',
        cell: (info) => {
          const meta = calcularMetaReceitaTotal(info.row.original);
          const realizado = getRealizadoMes(info.row.original.mes);
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
          const realizado = getRealizadoMes(info.row.original.mes);
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
    [realizados]
  );

  const totais = useMemo(() => {
    const metaTotal = planos.reduce((sum, p) => sum + calcularMetaReceitaTotal(p), 0);
    const realizadoTotal = calcularReceitaTotal(realizados);
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
