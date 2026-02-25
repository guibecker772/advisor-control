import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { toastSuccess, toastError } from '../../lib/toast';
import { PageHeader, PageSkeleton } from '../../components/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TrendingUp,
  ArrowDownUp,
  Repeat,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  monthlyGoalsRepository,
  custodiaReceitaRepository,
  captacaoLancamentoRepository,
  offerReservationRepository,
  crossRepository,
} from '../../services/repositories';
import { subscribeDataInvalidation } from '../../lib/dataInvalidation';
import {
  formatCurrency,
  calcularRealizadosMensal,
  calcularPercentAtingido,
  getNomeMes,
} from '../../domain/calculations';
import { monthlyGoalsSchema, type MonthlyGoals, type MonthlyGoalsInput } from '../../domain/types';

export default function MetasPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingGoal, setExistingGoal] = useState<MonthlyGoals | null>(null);
  
  // Filtro mês/ano
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  
  // Realizados calculados automaticamente
  const [realizados, setRealizados] = useState({
    receita: 0,
    captacaoLiquida: 0,
    transferenciaXp: 0,
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<MonthlyGoalsInput>({
    resolver: zodResolver(monthlyGoalsSchema),
    defaultValues: {
      mes: mesFiltro,
      ano: anoFiltro,
      metaReceita: 0,
      metaCaptacaoLiquida: 0,
      metaTransferenciaXp: 0,
      observacoes: '',
    },
  });

  // Carregar dados do mês
  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setExistingGoal(null);
      setRealizados({
        receita: 0,
        captacaoLiquida: 0,
        transferenciaXp: 0,
      });
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Carregar metas do mês
      const goals = await monthlyGoalsRepository.getByMonth(ownerUid, mesFiltro, anoFiltro);
      const goal = goals.length > 0 ? goals[0] : null;
      setExistingGoal(goal);
      
      if (goal) {
        reset({
          mes: goal.mes,
          ano: goal.ano,
          metaReceita: goal.metaReceita || 0,
          metaCaptacaoLiquida: goal.metaCaptacaoLiquida || 0,
          metaTransferenciaXp: goal.metaTransferenciaXp || 0,
          observacoes: goal.observacoes || '',
        });
      } else {
        reset({
          mes: mesFiltro,
          ano: anoFiltro,
          metaReceita: 0,
          metaCaptacaoLiquida: 0,
          metaTransferenciaXp: 0,
          observacoes: '',
        });
      }
      
      // Carregar dados para cálculo de realizados
      // Cross usa getAll pois o filtro por mês/ano é feito em calcularCrossRealizadoMensal usando dataVenda
      const [custodiaReceita, captacoes, ofertas, crosses] = await Promise.all([
        custodiaReceitaRepository.getByMonth(ownerUid, mesFiltro, anoFiltro),
        captacaoLancamentoRepository.getByMonth(ownerUid, mesFiltro, anoFiltro),
        offerReservationRepository.getAll(ownerUid),
        crossRepository.getAll(ownerUid),
      ]);

      // Calcular realizados (inclui Custódia + Ofertas + Cross + Captação persistida)
      const realizadosMes = calcularRealizadosMensal(custodiaReceita, captacoes, mesFiltro, anoFiltro, ofertas, crosses);
      setRealizados(realizadosMes);
      
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      toastError('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, [anoFiltro, authLoading, mesFiltro, ownerUid, reset]);

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData]);

  useEffect(() => {
    if (authLoading || !ownerUid) return;
    return subscribeDataInvalidation(['metas', 'captacao', 'prospects'], async () => {
      await loadData();
    });
  }, [authLoading, loadData, ownerUid]);

  // Valores do form para cálculo de percentuais
  const formValues = watch();
  
  // Percentuais calculados
  const percentuais = useMemo(() => ({
    receita: calcularPercentAtingido(formValues.metaReceita || 0, realizados.receita),
    captacaoLiquida: calcularPercentAtingido(formValues.metaCaptacaoLiquida || 0, realizados.captacaoLiquida),
    transferenciaXp: calcularPercentAtingido(formValues.metaTransferenciaXp || 0, realizados.transferenciaXp),
  }), [formValues, realizados]);

  // Salvar metas
  const onSubmit = async (data: MonthlyGoalsInput) => {
    if (!ownerUid) return;
    
    try {
      setSaving(true);
      
      const payload = {
        mes: mesFiltro,
        ano: anoFiltro,
        metaReceita: data.metaReceita ?? 0,
        metaCaptacaoLiquida: data.metaCaptacaoLiquida ?? 0,
        metaTransferenciaXp: data.metaTransferenciaXp ?? 0,
        observacoes: data.observacoes || '',
      };
      
      if (existingGoal?.id) {
        await monthlyGoalsRepository.update(existingGoal.id, payload, ownerUid);
      } else {
        const created = await monthlyGoalsRepository.create(payload, ownerUid);
        setExistingGoal(created);
      }
      
      // Recarregar para garantir sincronização
      await loadData();
      toastSuccess('Metas salvas com sucesso!');
      
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      toastError('Erro ao salvar metas');
    } finally {
      setSaving(false);
    }
  };

  // Formatar percentual para exibição
  const formatPercent = (value: number | null): string => {
    if (value === null) return '—';
    const sign = value >= 0 ? '' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Cor do progresso baseado no valor
  const getProgressColor = (percent: number | null): string => {
    if (percent === null) return 'var(--color-text-muted)';
    if (percent >= 100) return 'var(--color-success)';
    if (percent >= 75) return 'var(--color-info)';
    if (percent >= 50) return 'var(--color-warning)';
    if (percent >= 0) return 'var(--color-gold)';
    return 'var(--color-danger)';
  };

  // Largura da barra de progresso (clamp em 0-100 visual, mas mostra valor real)
  const getProgressWidth = (percent: number | null): number => {
    if (percent === null) return 0;
    if (percent < 0) return 0;
    return Math.min(percent, 100);
  };

  if (loading) {
    return <PageSkeleton showKpis kpiCount={3} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Metas"
        subtitle="Defina e acompanhe suas metas mensais"
        actions={
          <button
            onClick={loadData}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            title="Atualizar dados"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        }
        controls={
          <>
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm focus-gold"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {getNomeMes(m)}
                </option>
              ))}
            </select>
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm focus-gold"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Cards de Progresso */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meta de Receita */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-success-bg)' }}>
              <TrendingUp className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Receita</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Meta de receita do mês</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Realizado:</span>
              <span className="font-semibold" style={{ color: realizados.receita >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(realizados.receita)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Meta:</span>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(formValues.metaReceita || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Atingimento:</span>
              <span className="font-bold" style={{ color:
                percentuais.receita !== null && percentuais.receita >= 100 
                  ? 'var(--color-success)' 
                  : percentuais.receita !== null && percentuais.receita < 0
                    ? 'var(--color-danger)'
                    : 'var(--color-info)'
              }}>
                {formatPercent(percentuais.receita)}
              </span>
            </div>
            
            {/* Barra de progresso */}
            <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <div
                className="h-3 rounded-full transition-all"
                style={{ width: `${getProgressWidth(percentuais.receita)}%`, backgroundColor: getProgressColor(percentuais.receita) }}
              ></div>
            </div>
          </div>
        </div>

        {/* Meta de Captação Líquida */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-info-bg)' }}>
              <ArrowDownUp className="w-6 h-6" style={{ color: 'var(--color-info)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Captação Líquida</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Entradas - Saídas</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Realizado:</span>
              <span className="font-semibold" style={{ color: realizados.captacaoLiquida >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(realizados.captacaoLiquida)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Meta:</span>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(formValues.metaCaptacaoLiquida || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Atingimento:</span>
              <span className="font-bold" style={{ color:
                percentuais.captacaoLiquida !== null && percentuais.captacaoLiquida >= 100 
                  ? 'var(--color-success)' 
                  : percentuais.captacaoLiquida !== null && percentuais.captacaoLiquida < 0
                    ? 'var(--color-danger)'
                    : 'var(--color-info)'
              }}>
                {formatPercent(percentuais.captacaoLiquida)}
              </span>
            </div>
            
            <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <div
                className="h-3 rounded-full transition-all"
                style={{ width: `${getProgressWidth(percentuais.captacaoLiquida)}%`, backgroundColor: getProgressColor(percentuais.captacaoLiquida) }}
              ></div>
            </div>
          </div>
        </div>

        {/* Meta de Transferência XP */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-info-bg)' }}>
              <Repeat className="w-6 h-6" style={{ color: 'var(--color-chart-4)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Transferência XP</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Saldo de transferências</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Realizado:</span>
              <span className="font-semibold" style={{ color: realizados.transferenciaXp >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(realizados.transferenciaXp)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Meta:</span>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(formValues.metaTransferenciaXp || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Atingimento:</span>
              <span className="font-bold" style={{ color:
                percentuais.transferenciaXp !== null && percentuais.transferenciaXp >= 100 
                  ? 'var(--color-success)' 
                  : percentuais.transferenciaXp !== null && percentuais.transferenciaXp < 0
                    ? 'var(--color-danger)'
                    : 'var(--color-info)'
              }}>
                {formatPercent(percentuais.transferenciaXp)}
              </span>
            </div>
            
            <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <div
                className="h-3 rounded-full transition-all"
                style={{ width: `${getProgressWidth(percentuais.transferenciaXp)}%`, backgroundColor: getProgressColor(percentuais.transferenciaXp) }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de Metas */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Definir Metas para {getNomeMes(mesFiltro)} de {anoFiltro}
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Meta de Receita */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Meta de Receita (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaReceita', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                placeholder="0,00"
              />
              {errors.metaReceita && (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.metaReceita.message}</p>
              )}
            </div>

            {/* Meta de Captação Líquida */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Meta de Captação Líquida (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaCaptacaoLiquida', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                placeholder="0,00"
              />
              {errors.metaCaptacaoLiquida && (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.metaCaptacaoLiquida.message}</p>
              )}
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Pode ser negativa (objetivo de redução)</p>
            </div>

            {/* Meta de Transferência XP */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Meta de Transferência XP (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaTransferenciaXp', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                placeholder="0,00"
              />
              {errors.metaTransferenciaXp && (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.metaTransferenciaXp.message}</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Observações
            </label>
            <textarea
              {...register('observacoes')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg focus-gold"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              placeholder="Anotações sobre as metas do mês..."
            />
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--color-text-inverse)' }}></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {existingGoal ? 'Atualizar Metas' : 'Salvar Metas'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info de atualização automática */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-info-bg)', border: '1px solid var(--color-info)' }}>
        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 mt-0.5" style={{ color: 'var(--color-info)' }} />
          <div>
            <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>Atualização Automática</h4>
            <p className="text-sm mt-1" style={{ color: 'var(--color-info)' }}>
              Os valores realizados são calculados automaticamente com base nos lançamentos de receita e captação do mês.
              Ao adicionar novos lançamentos em outras telas, os valores serão atualizados aqui.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
