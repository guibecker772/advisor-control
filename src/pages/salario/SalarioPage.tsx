import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Zap, AlertTriangle } from 'lucide-react';
import { toastSuccess, toastError, toastWarning } from '../../lib/toast';
import { subscribeDataInvalidation } from '../../lib/dataInvalidation';

import { useAuth } from '../../contexts/AuthContext';
import { salarioRepository, crossRepository } from '../../services/repositories';
import { listOffersByCompetenceMonth } from '../../services/offerReservationService';
import { salarioSchema, type Salario, type SalarioInput, type Cross, type SalarioClasse, type OfferReservation } from '../../domain/types';
import {
  formatCurrency,
  formatPercent,
  calcularSalarioCompletoV2,
  getNomeMes,
  normalizarPercentual,
  CLASSES_SALARIO,
  mapearOfertasParaClasses,
  calcularReceitaCrossMensal,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDialog, PageHeader, PageSkeleton } from '../../components/ui';
import { Input, TextArea } from '../../components/shared/FormFields';
import {
  type OfferStatus,
  competenceMonthToMonthYear,
  getCurrentCompetenceMonth,
} from '../../domain/offers';

const SALARY_SYNC_OFFER_STATUSES: OfferStatus[] = ['PENDENTE', 'RESERVADA', 'LIQUIDADA'];
const MONEY_TOLERANCE = 0.01;
const PERCENT_TOLERANCE = 0.000001;

function isClose(a: number | undefined, b: number | undefined, tolerance = MONEY_TOLERANCE): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) <= tolerance;
}

function areClassesEquivalent(current: SalarioClasse[] = [], next: SalarioClasse[] = []): boolean {
  if (current.length !== next.length) return false;

  const currentSorted = [...current].sort((a, b) => a.classe.localeCompare(b.classe));
  const nextSorted = [...next].sort((a, b) => a.classe.localeCompare(b.classe));

  return currentSorted.every((currentClass, index) => {
    const nextClass = nextSorted[index];
    return (
      currentClass.classe === nextClass.classe
      && isClose(currentClass.receita, nextClass.receita)
      && isClose(currentClass.repassePercent, nextClass.repassePercent, PERCENT_TOLERANCE)
      && isClose(currentClass.majoracaoPercent, nextClass.majoracaoPercent, PERCENT_TOLERANCE)
    );
  });
}

function buildSalarioDefaults(
  mes: number,
  ano: number,
  classes: SalarioClasse[],
  receitaTotal: number,
  receitaCross: number,
): Omit<Salario, 'id'> {
  return {
    mes,
    ano,
    classes,
    receitaTotal,
    receitaCross,
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
  };
}

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

  const [competenceMonthFiltro, setCompetenceMonthFiltro] = useState<string>(getCurrentCompetenceMonth());

  const monthYear = useMemo(() => competenceMonthToMonthYear(competenceMonthFiltro), [competenceMonthFiltro]);
  const anoFiltro = monthYear?.ano ?? new Date().getFullYear();
  const mesFiltro = monthYear?.mes ?? new Date().getMonth() + 1;

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
  
  const loadSalarios = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await salarioRepository.getByYear(user.uid, anoFiltro);
      setSalarios(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toastError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user, anoFiltro]);

  const syncSalarioByCompetencia = useCallback(async () => {
    if (!user) return;

    const periodo = competenceMonthToMonthYear(competenceMonthFiltro);
    if (!periodo) return;

    try {
      const { mes, ano } = periodo;
      const [ofertasMes, crossData, salariosMes] = await Promise.all([
        listOffersByCompetenceMonth(user.uid, competenceMonthFiltro, SALARY_SYNC_OFFER_STATUSES),
        crossRepository.getAll(user.uid),
        salarioRepository.getByMonth(user.uid, mes, ano),
      ]) as [OfferReservation[], Cross[], Salario[]];

      const salarioExistente = salariosMes[0] ?? null;
      const classesSincronizadas = mapearOfertasParaClasses(ofertasMes, salarioExistente?.classes || []);
      const receitaTotalSincronizada = classesSincronizadas.reduce((sum, classe) => sum + (classe.receita || 0), 0);
      const receitaCrossSincronizada = calcularReceitaCrossMensal(crossData, mes, ano);

      if (salarioExistente?.id) {
        const shouldUpdate = !areClassesEquivalent(salarioExistente.classes || [], classesSincronizadas)
          || !isClose(salarioExistente.receitaTotal, receitaTotalSincronizada)
          || !isClose(salarioExistente.receitaCross, receitaCrossSincronizada);

        if (!shouldUpdate) return;

        const updated = await salarioRepository.update(
          salarioExistente.id,
          {
            classes: classesSincronizadas,
            receitaTotal: receitaTotalSincronizada,
            receitaCross: receitaCrossSincronizada,
          },
          user.uid,
        );

        if (updated) {
          await loadSalarios();
        }
        return;
      }

      const created = await salarioRepository.create(
        buildSalarioDefaults(mes, ano, classesSincronizadas, receitaTotalSincronizada, receitaCrossSincronizada),
        user.uid,
      );
      if (created) {
        await loadSalarios();
      }
    } catch (error) {
      console.error('Erro ao sincronizar salário por competência:', error);
      toastError('Erro ao sincronizar salário por competência');
    }
  }, [user, competenceMonthFiltro, loadSalarios]);

  useEffect(() => {
    void loadSalarios();
  }, [loadSalarios]);

  useEffect(() => {
    void syncSalarioByCompetencia();
  }, [syncSalarioByCompetencia]);

  useEffect(() => {
    return subscribeDataInvalidation(['offers', 'salary'], async () => {
      await syncSalarioByCompetencia();
      await loadSalarios();
    });
  }, [loadSalarios, syncSalarioByCompetencia]);

  // Buscar dados reais do mês para preencher automaticamente (Auto-preencher)
  const fetchDadosMes = async (competenceMonth: string) => {
    if (!user) return;

    try {
      setAutoFilling(true);
      const [ofertasMes, crossData] = await Promise.all([
        listOffersByCompetenceMonth(user.uid, competenceMonth, ['LIQUIDADA']),
        crossRepository.getAll(user.uid),
      ]) as [OfferReservation[], Cross[]];
      const period = competenceMonthToMonthYear(competenceMonth);
      const mes = period?.mes ?? mesFiltro;
      const ano = period?.ano ?? anoFiltro;
      
      if (ofertasMes.length === 0) {
        toastWarning('Nenhuma oferta liquidada encontrada para esta competência.');
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
      toastSuccess(`Receitas carregadas! ${mensagem}`);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toastError('Erro ao buscar dados do mês');
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

  const openModal = useCallback((salario?: Salario) => {
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
  }, [reset, mesFiltro, anoFiltro]);

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
          toastSuccess('Salário atualizado com sucesso!');
        }
      } else {
        const created = await salarioRepository.create(parsed, user.uid);
        setSalarios((prev) => [...prev, created]);
        toastSuccess('Salário criado com sucesso!');
      }

      setModalOpen(false);
      reset();
      setClasses([]);
    } catch (error) {
      console.error('Erro ao salvar salário:', error);
      toastError('Erro ao salvar salário');
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
      toastSuccess('Salário excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedSalario(null);
    } catch (error) {
      console.error('Erro ao excluir salário:', error);
      toastError('Erro ao excluir salário');
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
          return <span className="font-medium" style={{ color: 'var(--color-success)' }}>{formatCurrency(calc.salarioBruto)}</span>;
        },
      },
      {
        id: 'ir',
        header: 'IR',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(calc.irValue)}</span>;
        },
      },
      {
        id: 'liquido',
        header: 'Líquido',
        cell: (info) => {
          const calc = calcularSalarioCompletoV2(info.row.original);
          return <span className="font-bold" style={{ color: 'var(--color-info)' }}>{formatCurrency(calc.salarioLiquido)}</span>;
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
    [openModal]
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
    return <PageSkeleton showKpis kpiCount={5} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salário"
        subtitle={`Cálculo de comissões e salário - ${anoFiltro}`}
        actions={
          <>
            <input
              type="month"
              value={competenceMonthFiltro}
              onChange={(event) => setCompetenceMonthFiltro(event.target.value || getCurrentCompetenceMonth())}
              className="px-3 py-2 rounded-lg text-sm focus-gold"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              aria-label="Competência"
            />
            <button
              onClick={() => openModal()}
              className="flex items-center px-4 py-2 rounded-lg text-sm font-medium hover:brightness-110 transition-all"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Mês
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Meses Lançados</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{totais.meses}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Receita Total</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-info)' }}>{formatCurrency(totais.receitaTotal)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Bruto Acumulado</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatCurrency(totais.brutoTotal)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>IR Total</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatCurrency(totais.irTotal)}</p>
        </div>
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Líquido Acumulado</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatCurrency(totais.liquidoTotal)}</p>
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
                onClick={() => fetchDadosMes(`${watchedValues.ano}-${String(watchedValues.mes).padStart(2, '0')}`)}
                disabled={autoFilling}
                className="flex items-center px-4 py-2 rounded-lg disabled:opacity-50 hover:brightness-110 transition-all w-full justify-center text-sm font-medium"
                style={{ backgroundColor: 'var(--color-success)', color: 'var(--color-text-inverse)' }}
              >
                <Zap className="w-4 h-4 mr-2" />
                {autoFilling ? 'Carregando...' : 'Auto-preencher Receitas do Mês'}
              </button>
            </div>
          </div>

          {/* Tabela de Classes */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-medium mb-3 flex items-center" style={{ color: 'var(--color-text-secondary)' }}>
              Receitas por Classe
              {classes.length === 0 && (
                <span className="ml-2 text-xs flex items-center" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Clique em "Auto-preencher" para carregar
                </span>
              )}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-surface-2)' }}>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Classe</th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Receita</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-secondary)' }}>Repasse %</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-secondary)' }}>Majoração %</th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Repasse R$</th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Major. R$</th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bruto</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {classes.map((classe, idx) => {
                    const def = CLASSES_SALARIO.find(c => c.id === classe.classe);
                    const repasseVal = classe.receita * classe.repassePercent;
                    const majorVal = classe.receita * classe.majoracaoPercent;
                    const bruto = repasseVal + majorVal;
                    return (
                      <tr key={classe.classe} style={{ backgroundColor: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
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
                            className="w-16 px-2 py-1 text-center rounded text-sm"
                            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
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
                            className="w-16 px-2 py-1 text-center rounded text-sm"
                            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                          />
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: 'var(--color-success)' }}>{formatCurrency(repasseVal)}</td>
                        <td className="px-3 py-2 text-right" style={{ color: 'var(--color-info)' }}>{formatCurrency(majorVal)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(bruto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {classes.length > 0 && (
                  <tfoot className="font-medium" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <tr>
                      <td className="px-3 py-2">Total Classes</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(salarioCalcV2.receitaTotalClasses)}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right" style={{ color: 'var(--color-success)' }}>{formatCurrency(salarioCalcV2.repasseTotalClasses)}</td>
                      <td className="px-3 py-2 text-right" style={{ color: 'var(--color-info)' }}>{formatCurrency(salarioCalcV2.majoracaoTotalClasses)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(salarioCalcV2.brutoClasses)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Cross Selling (legado) */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Cross Selling</h3>
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
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>IR e Premiação</h3>
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
          <div className="border-t pt-4 -mx-6 px-6 py-4 mt-4" style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Resumo do Cálculo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Repasse Classes:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.repasseTotalClasses)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Majoração:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.majoracaoTotalClasses)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Cross:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.comissaoCross)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Premiação + Ajuste:</span>
                <span className="ml-2 font-medium">{formatCurrency(salarioCalcV2.premiacao + salarioCalcV2.ajuste)}</span>
              </div>
              <div className="md:col-span-2">
                <span style={{ color: 'var(--color-text-muted)' }}>Bruto:</span>
                <span className="ml-2 font-bold text-lg" style={{ color: 'var(--color-success)' }}>{formatCurrency(salarioCalcV2.salarioBruto)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>IR ({formatPercent(salarioCalcV2.irPercent * 100)}):</span>
                <span className="ml-2 font-medium" style={{ color: 'var(--color-danger)' }}>{formatCurrency(salarioCalcV2.irValue)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Líquido:</span>
                <span className="ml-2 font-bold text-xl" style={{ color: 'var(--color-info)' }}>{formatCurrency(salarioCalcV2.salarioLiquido)}</span>
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
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              {saving ? 'Salvando...' : selectedSalario ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Salário"
        message="Tem certeza que deseja excluir este registro de salário? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}

