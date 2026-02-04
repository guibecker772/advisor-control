import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Goal,
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
  prospectRepository,
} from '../../services/repositories';
import {
  formatCurrency,
  calcularRealizadosMensal,
  calcularPercentAtingido,
  getNomeMes,
} from '../../domain/calculations';
import { monthlyGoalsSchema, type MonthlyGoals, type MonthlyGoalsInput, type Prospect, type CaptacaoLancamento } from '../../domain/types';

export default function MetasPage() {
  const { user } = useAuth();
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
  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Carregar metas do mês
      const goals = await monthlyGoalsRepository.getByMonth(user.uid, mesFiltro, anoFiltro);
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
      
      // Carregar dados para cálculo de realizados (incluindo prospects para derivar Prospect Auto)
      // Cross usa getAll pois o filtro por mês/ano é feito em calcularCrossRealizadoMensal usando dataVenda
      const [custodiaReceita, captacoes, ofertas, crosses, prospects] = await Promise.all([
        custodiaReceitaRepository.getByMonth(user.uid, mesFiltro, anoFiltro),
        captacaoLancamentoRepository.getByMonth(user.uid, mesFiltro, anoFiltro),
        offerReservationRepository.getAll(user.uid),
        crossRepository.getAll(user.uid),
        prospectRepository.getAll(user.uid),
      ]);
      
      // Derivar lançamentos de prospects realizados no mês (mesma lógica do CaptacaoPage)
      const sourceRefsExistentes = new Set(captacoes.filter(l => l.sourceRef).map(l => l.sourceRef));
      const derivadosProspects: CaptacaoLancamento[] = prospects
        .filter((p: Prospect) => {
          if (!p.realizadoData || !p.realizadoValor) return false;
          const d = new Date(p.realizadoData + 'T00:00:00');
          return d.getMonth() + 1 === mesFiltro && d.getFullYear() === anoFiltro;
        })
        .filter((p: Prospect) => !sourceRefsExistentes.has(`prospect:${p.id}`))
        .map((p: Prospect): CaptacaoLancamento => ({
          id: `derived-${p.id}`,
          data: p.realizadoData!,
          mes: mesFiltro,
          ano: anoFiltro,
          direcao: 'entrada',
          tipo: p.realizadoTipo || 'captacao_liquida',
          origem: 'prospect',
          referenciaId: p.id,
          referenciaNome: p.nome,
          sourceRef: `prospect:${p.id}`,
          valor: p.realizadoValor!,
          observacoes: 'Derivado de Prospect',
        }));
      
      // Combinar captações persistidas + derivadas de prospects
      const captacoesConsolidadas = [...captacoes, ...derivadosProspects];
      
      // Calcular realizados (inclui Custódia + Ofertas + Cross + Prospects)
      const realizadosMes = calcularRealizadosMensal(custodiaReceita, captacoesConsolidadas, mesFiltro, anoFiltro, ofertas, crosses);
      setRealizados(realizadosMes);
      
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mesFiltro, anoFiltro]);

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
    if (!user) return;
    
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
        await monthlyGoalsRepository.update(existingGoal.id, payload, user.uid);
      } else {
        const created = await monthlyGoalsRepository.create(payload, user.uid);
        setExistingGoal(created);
      }
      
      // Recarregar para garantir sincronização
      await loadData();
      
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
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
    if (percent === null) return 'bg-gray-300';
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-blue-500';
    if (percent >= 50) return 'bg-yellow-500';
    if (percent >= 0) return 'bg-orange-500';
    return 'bg-red-500'; // Negativo
  };

  // Largura da barra de progresso (clamp em 0-100 visual, mas mostra valor real)
  const getProgressWidth = (percent: number | null): number => {
    if (percent === null) return 0;
    if (percent < 0) return 0;
    return Math.min(percent, 100);
  };

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Goal className="w-7 h-7 text-blue-600" />
            Metas
          </h1>
          <p className="text-gray-600">
            Defina e acompanhe suas metas mensais
          </p>
        </div>
        
        {/* Filtro Mês/Ano */}
        <div className="flex items-center gap-4">
          <select
            value={mesFiltro}
            onChange={(e) => setMesFiltro(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cards de Progresso */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meta de Receita */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Receita</h3>
              <p className="text-sm text-gray-500">Meta de receita do mês</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Realizado:</span>
              <span className={`font-semibold ${realizados.receita >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(realizados.receita)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Meta:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(formValues.metaReceita || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Atingimento:</span>
              <span className={`font-bold ${
                percentuais.receita !== null && percentuais.receita >= 100 
                  ? 'text-green-600' 
                  : percentuais.receita !== null && percentuais.receita < 0
                    ? 'text-red-600'
                    : 'text-blue-600'
              }`}>
                {formatPercent(percentuais.receita)}
              </span>
            </div>
            
            {/* Barra de progresso */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getProgressColor(percentuais.receita)}`}
                style={{ width: `${getProgressWidth(percentuais.receita)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Meta de Captação Líquida */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ArrowDownUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Captação Líquida</h3>
              <p className="text-sm text-gray-500">Entradas - Saídas</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Realizado:</span>
              <span className={`font-semibold ${realizados.captacaoLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(realizados.captacaoLiquida)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Meta:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(formValues.metaCaptacaoLiquida || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Atingimento:</span>
              <span className={`font-bold ${
                percentuais.captacaoLiquida !== null && percentuais.captacaoLiquida >= 100 
                  ? 'text-green-600' 
                  : percentuais.captacaoLiquida !== null && percentuais.captacaoLiquida < 0
                    ? 'text-red-600'
                    : 'text-blue-600'
              }`}>
                {formatPercent(percentuais.captacaoLiquida)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getProgressColor(percentuais.captacaoLiquida)}`}
                style={{ width: `${getProgressWidth(percentuais.captacaoLiquida)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Meta de Transferência XP */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Repeat className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Transferência XP</h3>
              <p className="text-sm text-gray-500">Saldo de transferências</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Realizado:</span>
              <span className={`font-semibold ${realizados.transferenciaXp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(realizados.transferenciaXp)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Meta:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(formValues.metaTransferenciaXp || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Atingimento:</span>
              <span className={`font-bold ${
                percentuais.transferenciaXp !== null && percentuais.transferenciaXp >= 100 
                  ? 'text-green-600' 
                  : percentuais.transferenciaXp !== null && percentuais.transferenciaXp < 0
                    ? 'text-red-600'
                    : 'text-blue-600'
              }`}>
                {formatPercent(percentuais.transferenciaXp)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getProgressColor(percentuais.transferenciaXp)}`}
                style={{ width: `${getProgressWidth(percentuais.transferenciaXp)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de Metas */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Definir Metas para {getNomeMes(mesFiltro)} de {anoFiltro}
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Meta de Receita */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta de Receita (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaReceita', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0,00"
              />
              {errors.metaReceita && (
                <p className="mt-1 text-sm text-red-600">{errors.metaReceita.message}</p>
              )}
            </div>

            {/* Meta de Captação Líquida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta de Captação Líquida (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaCaptacaoLiquida', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0,00"
              />
              {errors.metaCaptacaoLiquida && (
                <p className="mt-1 text-sm text-red-600">{errors.metaCaptacaoLiquida.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Pode ser negativa (objetivo de redução)</p>
            </div>

            {/* Meta de Transferência XP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta de Transferência XP (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('metaTransferenciaXp', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0,00"
              />
              {errors.metaTransferenciaXp && (
                <p className="mt-1 text-sm text-red-600">{errors.metaTransferenciaXp.message}</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              {...register('observacoes')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Anotações sobre as metas do mês..."
            />
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Atualização Automática</h4>
            <p className="text-sm text-blue-700 mt-1">
              Os valores realizados são calculados automaticamente com base nos lançamentos de receita e captação do mês.
              Ao adicionar novos lançamentos em outras telas, os valores serão atualizados aqui.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
