import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { salarioRepository, custodiaReceitaRepository, crossRepository } from '../../services/repositories';
import { salarioSchema, type Salario, type SalarioInput, type CustodiaReceita, type Cross } from '../../domain/types';
import {
  formatCurrency,
  calcularSalarioCompleto,
  calcularReceitaTotal,
  calcularComissaoCross,
  getNomeMes,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, TextArea } from '../../components/shared/FormFields';

export default function SalarioPage() {
  const { user } = useAuth();
  const [salarios, setSalarios] = useState<Salario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSalario, setSelectedSalario] = useState<Salario | null>(null);
  const [saving, setSaving] = useState(false);

  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SalarioInput>({
    resolver: zodResolver(salarioSchema),
    defaultValues: {
      mes: new Date().getMonth() + 1,
      ano: anoFiltro,
      receitaTotal: 0,
      receitaCross: 0,
      percentualComissao: 30,
      percentualCross: 50,
      bonusFixo: 0,
      bonusMeta: 0,
      adiantamentos: 0,
      descontos: 0,
      irrf: 0,
    },
  });

  const watchedValues = watch();
  const salarioCalc = useMemo(() => {
    return calcularSalarioCompleto(watchedValues as Salario);
  }, [watchedValues]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const data = await salarioRepository.getByYear(user.uid, anoFiltro);
        setSalarios(data);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, anoFiltro]);

  // Buscar dados reais do mês para preencher automaticamente
  const fetchDadosMes = async (mes: number, ano: number) => {
    if (!user) return;

    try {
      const [custodiaData, crossData] = await Promise.all([
        custodiaReceitaRepository.getByMonth(user.uid, mes, ano),
        crossRepository.getAll(user.uid),
      ]) as [CustodiaReceita[], Cross[]];

      const receitaTotal = calcularReceitaTotal(custodiaData);
      const crossesMes = crossData.filter((c) => {
        if (!c.dataVenda) return false;
        const data = new Date(c.dataVenda);
        return data.getMonth() + 1 === mes && data.getFullYear() === ano;
      });
      const receitaCross = calcularComissaoCross(crossesMes);

      setValue('receitaTotal', receitaTotal);
      setValue('receitaCross', receitaCross);

      toast.success('Dados do mês carregados!');
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados do mês');
    }
  };

  const openModal = (salario?: Salario) => {
    if (salario) {
      setSelectedSalario(salario);
      reset(salario);
    } else {
      setSelectedSalario(null);
      reset({
        mes: new Date().getMonth() + 1,
        ano: anoFiltro,
        receitaTotal: 0,
        receitaCross: 0,
        percentualComissao: 30,
        percentualCross: 50,
        bonusFixo: 0,
        bonusMeta: 0,
        adiantamentos: 0,
        descontos: 0,
        irrf: 0,
        observacoes: '',
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: SalarioInput) => {
    if (!user) return;

    try {
      setSaving(true);
      const parsed = salarioSchema.parse(data);

      if (selectedSalario?.id) {
        const updated = await salarioRepository.update(selectedSalario.id, parsed, user.uid);
        if (updated) {
          setSalarios((prev) =>
            prev.map((s) => (s.id === selectedSalario.id ? updated : s))
          );
          toast.success('Salário atualizado com sucesso!');
        }
      } else {
        const created = await salarioRepository.create(parsed, user.uid);
        setSalarios((prev) => [...prev, created]);
        toast.success('Salário criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar salário:', error);
      toast.error('Erro ao salvar salário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedSalario?.id) return;

    try {
      setSaving(true);
      await salarioRepository.delete(selectedSalario.id, user.uid);
      setSalarios((prev) => prev.filter((s) => s.id !== selectedSalario.id));
      toast.success('Salário excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedSalario(null);
    } catch (error) {
      console.error('Erro ao excluir salário:', error);
      toast.error('Erro ao excluir salário');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Salario>[]>(
    () => [
      {
        accessorKey: 'mes',
        header: 'Mês',
        cell: (info) => getNomeMes(info.getValue() as number),
      },
      {
        accessorKey: 'receitaTotal',
        header: 'Receita Base',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'receitaCross',
        header: 'Receita Cross',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'comissaoReceita',
        header: 'Comissão Receita',
        cell: (info) => {
          const calc = calcularSalarioCompleto(info.row.original);
          return <CurrencyCell value={calc.comissaoReceita} />;
        },
      },
      {
        id: 'comissaoCross',
        header: 'Comissão Cross',
        cell: (info) => {
          const calc = calcularSalarioCompleto(info.row.original);
          return <CurrencyCell value={calc.comissaoCross} />;
        },
      },
      {
        id: 'bruto',
        header: 'Bruto',
        cell: (info) => {
          const calc = calcularSalarioCompleto(info.row.original);
          return <span className="font-medium text-green-600">{formatCurrency(calc.bruto)}</span>;
        },
      },
      {
        id: 'deducoes',
        header: 'Deduções',
        cell: (info) => {
          const calc = calcularSalarioCompleto(info.row.original);
          return <span className="text-red-600">{formatCurrency(calc.deducoes)}</span>;
        },
      },
      {
        id: 'liquido',
        header: 'Líquido',
        cell: (info) => {
          const calc = calcularSalarioCompleto(info.row.original);
          return <span className="font-bold text-blue-600">{formatCurrency(calc.liquido)}</span>;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedSalario(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    []
  );

  const totais = useMemo(() => {
    const brutoTotal = salarios.reduce((sum, s) => sum + calcularSalarioCompleto(s).bruto, 0);
    const liquidoTotal = salarios.reduce((sum, s) => sum + calcularSalarioCompleto(s).liquido, 0);
    const receitaTotal = salarios.reduce((sum, s) => sum + (s.receitaTotal || 0), 0);
    const crossTotal = salarios.reduce((sum, s) => sum + (s.receitaCross || 0), 0);

    return {
      meses: salarios.length,
      receitaTotal,
      crossTotal,
      brutoTotal,
      liquidoTotal,
    };
  }, [salarios]);

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
          <h1 className="text-2xl font-bold text-gray-900">Salário</h1>
          <p className="text-gray-600">Cálculo de comissões e salário - {anoFiltro}</p>
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
            className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Mês
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Meses Lançados</p>
          <p className="text-2xl font-bold text-gray-900">{totais.meses}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Receita Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.receitaTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Cross Total</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(totais.crossTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Bruto Acumulado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.brutoTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Líquido Acumulado</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totais.liquidoTotal)}</p>
        </div>
      </div>

      <DataTable
        data={salarios}
        columns={columns}
        searchPlaceholder="Buscar..."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedSalario ? 'Editar Salário' : 'Novo Salário'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => fetchDadosMes(watchedValues.mes, watchedValues.ano)}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Buscar Dados
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Receitas Base</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Receita Total (Base)"
                type="number"
                step="0.01"
                {...register('receitaTotal', { valueAsNumber: true })}
                error={errors.receitaTotal?.message}
              />
              <Input
                label="Receita Cross"
                type="number"
                step="0.01"
                {...register('receitaCross', { valueAsNumber: true })}
                error={errors.receitaCross?.message}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Percentuais de Comissão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="% Comissão Receita"
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('percentualComissao', { valueAsNumber: true })}
                error={errors.percentualComissao?.message}
              />
              <Input
                label="% Comissão Cross"
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('percentualCross', { valueAsNumber: true })}
                error={errors.percentualCross?.message}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Bônus e Deduções</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Bônus Fixo"
                type="number"
                step="0.01"
                {...register('bonusFixo', { valueAsNumber: true })}
                error={errors.bonusFixo?.message}
              />
              <Input
                label="Bônus Meta"
                type="number"
                step="0.01"
                {...register('bonusMeta', { valueAsNumber: true })}
                error={errors.bonusMeta?.message}
              />
              <Input
                label="IRRF"
                type="number"
                step="0.01"
                {...register('irrf', { valueAsNumber: true })}
                error={errors.irrf?.message}
              />
              <Input
                label="Adiantamentos"
                type="number"
                step="0.01"
                {...register('adiantamentos', { valueAsNumber: true })}
                error={errors.adiantamentos?.message}
              />
              <Input
                label="Descontos"
                type="number"
                step="0.01"
                {...register('descontos', { valueAsNumber: true })}
                error={errors.descontos?.message}
              />
            </div>
          </div>

          {/* Resumo do cálculo */}
          <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Resumo do Cálculo</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Comissão Receita:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalc.comissaoReceita)}</span>
              </div>
              <div>
                <span className="text-gray-500">Comissão Cross:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalc.comissaoCross)}</span>
              </div>
              <div>
                <span className="text-gray-500">Bônus:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalc.bonusTotal)}</span>
              </div>
              <div>
                <span className="text-gray-500">Bruto:</span>
                <span className="ml-2 font-bold text-green-600">{formatCurrency(salarioCalc.bruto)}</span>
              </div>
              <div>
                <span className="text-gray-500">Deduções:</span>
                <span className="ml-2 font-medium text-red-600">{formatCurrency(salarioCalc.deducoes)}</span>
              </div>
              <div>
                <span className="text-gray-500">Líquido:</span>
                <span className="ml-2 font-bold text-blue-600 text-lg">{formatCurrency(salarioCalc.liquido)}</span>
              </div>
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
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedSalario ? 'Atualizar' : 'Criar'}
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
