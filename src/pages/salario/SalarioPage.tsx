import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Zap, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { salarioRepository, offerReservationRepository, crossRepository } from '../../services/repositories';
import { salarioSchema, type Salario, type SalarioInput, type Cross, type SalarioClasse, type OfferReservation } from '../../domain/types';
import {
  formatCurrency,
  formatPercent,
  calcularSalarioCompletoV2,
  getNomeMes,
  normalizarPercentual,
  CLASSES_SALARIO,
  filtrarOfertasPorMesAno,
  mapearOfertasParaClasses,
  calcularReceitaCrossMensal,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, TextArea } from '../../components/shared/FormFields';

export default function SalarioPage() {
  const { user } = useAuth();
  const [salarios, setSalarios] = useState<Salario[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoFilling, setAutoFilling] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSalario, setSelectedSalario] = useState<Salario | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Classes editáveis no modal
  const [classes, setClasses] = useState<SalarioClasse[]>([]);

  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);

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
      classes: [],
      receitaTotal: 0,
      receitaCross: 0,
      percentualComissao: 30,
      percentualCross: 50,
      irPercent: 0,
      premiacao: 0,
      ajuste: 0,
      bonusFixo: 0,
      bonusMeta: 0,
      adiantamentos: 0,
      descontos: 0,
      irrf: 0,
    },
  });

  const watchedValues = watch();
  
  // Cálculo usando novo modelo V2 (por classes)
  const salarioCalcV2 = useMemo(() => {
    const salarioTemp: Salario = {
      ...watchedValues as Salario,
      classes: classes,
    };
    return calcularSalarioCompletoV2(salarioTemp);
  }, [watchedValues, classes]);
  


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

  // Buscar dados reais do mês para preencher automaticamente (Auto-preencher)
  const fetchDadosMes = async (mes: number, ano: number) => {
    if (!user) return;

    try {
      setAutoFilling(true);
      const [ofertasData, crossData] = await Promise.all([
        offerReservationRepository.getAll(user.uid),
        crossRepository.getAll(user.uid),
      ]) as [OfferReservation[], Cross[]];

      // Filtrar ofertas do mês/ano (por dataReserva + efetuadas)
      const ofertasMes = filtrarOfertasPorMesAno(ofertasData, mes, ano);
      
      if (ofertasMes.length === 0) {
        toast('Nenhuma oferta efetuada encontrada para este mês. Verifique se há ofertas com Data Reserva neste período.', { icon: '⚠️' });
        // Mesmo sem ofertas, permitir continuar para preencher Cross se houver
      }

      // Mapear ofertas para classes preservando percentuais existentes
      const novasClasses = mapearOfertasParaClasses(ofertasMes, classes);
      setClasses(novasClasses);
      
      // Calcular receita total para campo legado
      const receitaTotal = novasClasses.reduce((s, c) => s + c.receita, 0);
      
      // Cross Concluídos do mês
      const receitaCross = calcularReceitaCrossMensal(crossData, mes, ano);

      setValue('receitaTotal', receitaTotal);
      setValue('receitaCross', receitaCross);

      // Mensagem de sucesso com resumo
      const mensagem = [
        `Ofertas: ${ofertasMes.length} (R$ ${receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
        `Cross: R$ ${receitaCross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ].join(' | ');
      toast.success(`Receitas carregadas! ${mensagem}`);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados do mês');
    } finally {
      setAutoFilling(false);
    }
  };
  
  // Atualizar percentual de uma classe
  const updateClassePercent = (classeId: string, field: 'repassePercent' | 'majoracaoPercent', value: number) => {
    setClasses(prev => prev.map(c => {
      if (c.classe === classeId) {
        return { ...c, [field]: normalizarPercentual(value) };
      }
      return c;
    }));
  };

  const openModal = (salario?: Salario) => {
    if (salario) {
      setSelectedSalario(salario);
      setClasses(salario.classes || []);
      reset(salario);
    } else {
      setSelectedSalario(null);
      // Inicializar classes vazias
      setClasses(CLASSES_SALARIO.map(def => ({
        classe: def.id,
        receita: 0,
        repassePercent: 0.25,
        majoracaoPercent: 0,
      })));
      reset({
        mes: mesFiltro,
        ano: anoFiltro,
        classes: [],
        receitaTotal: 0,
        receitaCross: 0,
        percentualComissao: 30,
        percentualCross: 50,
        irPercent: 0,
        premiacao: 0,
        ajuste: 0,
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
      
      // Incluir classes no dado a salvar
      const dataWithClasses = {
        ...data,
        classes: classes,
        // Normalizar IR se digitado como inteiro
        irPercent: normalizarPercentual(data.irPercent || 0),
      };
      
      const parsed = salarioSchema.parse(dataWithClasses);

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
      setClasses([]);
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
        id: 'receitaTotal',
        header: 'Receita Total',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <CurrencyCell value={calc.receitaTotalClasses} />;
        },
      },
      {
        id: 'repasse',
        header: 'Repasse',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <CurrencyCell value={calc.repasseTotalClasses} />;
        },
      },
      {
        id: 'majoracao',
        header: 'Majoração',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <CurrencyCell value={calc.majoracaoTotalClasses} />;
        },
      },
      {
        id: 'cross',
        header: 'Cross',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <CurrencyCell value={calc.comissaoCross} />;
        },
      },
      {
        id: 'bruto',
        header: 'Bruto',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <span className="font-medium text-green-600">{formatCurrency(calc.salarioBruto)}</span>;
        },
      },
      {
        id: 'ir',
        header: 'IR',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <span className="text-red-600">{formatCurrency(calc.irValue)}</span>;
        },
      },
      {
        id: 'liquido',
        header: 'Líquido',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <span className="font-bold text-blue-600">{formatCurrency(calc.salarioLiquido)}</span>;
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
    const calcs = salarios.map(s => calcularSalarioCompletoV2(s));
    const receitaTotal = calcs.reduce((sum, c) => sum + c.receitaTotalClasses, 0);
    const brutoTotal = calcs.reduce((sum, c) => sum + c.salarioBruto, 0);
    const irTotal = calcs.reduce((sum, c) => sum + c.irValue, 0);
    const liquidoTotal = calcs.reduce((sum, c) => sum + c.salarioLiquido, 0);

    return {
      meses: salarios.length,
      receitaTotal,
      brutoTotal,
      irTotal,
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
            value={mesFiltro}
            onChange={(e) => setMesFiltro(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
              <option key={mes} value={mes}>
                {getNomeMes(mes)}
              </option>
            ))}
          </select>
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
          <p className="text-sm text-gray-600">Bruto Acumulado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.brutoTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">IR Total</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totais.irTotal)}</p>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Mês/Ano + Auto-preencher */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="flex items-end md:col-span-2">
              <button
                type="button"
                onClick={() => fetchDadosMes(watchedValues.mes, watchedValues.ano)}
                disabled={autoFilling}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors w-full justify-center"
              >
                <Zap className="w-4 h-4 mr-2" />
                {autoFilling ? 'Carregando...' : 'Auto-preencher Receitas do Mês'}
              </button>
            </div>
          </div>

          {/* Tabela de Classes */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              Receitas por Classe
              {classes.length === 0 && (
                <span className="ml-2 text-xs text-amber-600 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Clique em "Auto-preencher" para carregar
                </span>
              )}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Classe</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Receita</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">Repasse %</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">Majoração %</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Repasse R$</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Major. R$</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Bruto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {classes.map((classe, idx) => {
                    const def = CLASSES_SALARIO.find(c => c.id === classe.classe);
                    const repasseVal = classe.receita * classe.repassePercent;
                    const majorVal = classe.receita * classe.majoracaoPercent;
                    const bruto = repasseVal + majorVal;
                    return (
                      <tr key={classe.classe} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 font-medium">{def?.label || classe.classe}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(classe.receita)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={Math.round(classe.repassePercent * 100)}
                            onChange={(e) => updateClassePercent(classe.classe, 'repassePercent', Number(e.target.value) / 100)}
                            className="w-16 px-2 py-1 text-center border rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={Math.round(classe.majoracaoPercent * 100)}
                            onChange={(e) => updateClassePercent(classe.classe, 'majoracaoPercent', Number(e.target.value) / 100)}
                            className="w-16 px-2 py-1 text-center border rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">{formatCurrency(repasseVal)}</td>
                        <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(majorVal)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(bruto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {classes.length > 0 && (
                  <tfoot className="bg-gray-100 font-medium">
                    <tr>
                      <td className="px-3 py-2">Total Classes</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(salarioCalcV2.receitaTotalClasses)}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right text-green-600">{formatCurrency(salarioCalcV2.repasseTotalClasses)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(salarioCalcV2.majoracaoTotalClasses)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(salarioCalcV2.brutoClasses)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Cross Selling (legado) */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Cross Selling</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Receita Cross"
                type="number"
                step="0.01"
                {...register('receitaCross', { valueAsNumber: true })}
                error={errors.receitaCross?.message}
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

          {/* IR e Premiação */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">IR e Premiação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="IR % (sobre bruto)"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Ex: 19 para 19%"
                {...register('irPercent', { valueAsNumber: true })}
                error={errors.irPercent?.message}
              />
              <Input
                label="Premiação/Campanha"
                type="number"
                step="0.01"
                {...register('premiacao', { valueAsNumber: true })}
                error={errors.premiacao?.message}
              />
              <Input
                label="Ajuste (+/-)"
                type="number"
                step="0.01"
                {...register('ajuste', { valueAsNumber: true })}
                error={errors.ajuste?.message}
              />
            </div>
          </div>

          {/* Resumo do cálculo */}
          <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Resumo do Cálculo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Repasse Classes:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.repasseTotalClasses)}</span>
              </div>
              <div>
                <span className="text-gray-500">Majoração:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.majoracaoTotalClasses)}</span>
              </div>
              <div>
                <span className="text-gray-500">Cross:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.comissaoCross)}</span>
              </div>
              <div>
                <span className="text-gray-500">Premiação + Ajuste:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.premiacao + salarioCalcV2.ajuste)}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-500">Bruto:</span>
                <span className="ml-2 font-bold text-green-600 text-lg">{formatCurrency(salarioCalcV2.salarioBruto)}</span>
              </div>
              <div>
                <span className="text-gray-500">IR ({formatPercent(salarioCalcV2.irPercent * 100)}):</span>
                <span className="ml-2 font-medium text-red-600">{formatCurrency(salarioCalcV2.irValue)}</span>
              </div>
              <div>
                <span className="text-gray-500">Líquido:</span>
                <span className="ml-2 font-bold text-blue-600 text-xl">{formatCurrency(salarioCalcV2.salarioLiquido)}</span>
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
