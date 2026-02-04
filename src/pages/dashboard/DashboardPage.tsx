import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  UserPlus,
  TrendingUp,
  DollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
} from 'lucide-react';
import { 
  clienteRepository, 
  prospectRepository, 
  custodiaReceitaRepository, 
  monthlyGoalsRepository,
  captacaoLancamentoRepository,
  offerReservationRepository,
  crossRepository,
} from '../../services/repositories';
import {
  calcularCustodiaTotal,
  calcularROA,
  formatCurrency,
  formatPercent,
  getNomeMes,
  calcularRealizadosMensal,
  calcularPercentAtingido,
} from '../../domain/calculations';
import type { Cliente, Prospect, CustodiaReceita, MonthlyGoals, CaptacaoLancamento, OfferReservation, Cross } from '../../domain/types';

interface KPI {
  title: string;
  value: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [comparativo, setComparativo] = useState<{
    receita: { meta: number; realizado: number; atingimento: number | null };
    captacaoLiquida: { meta: number; realizado: number; atingimento: number | null };
    transferenciaXp: { meta: number; realizado: number; atingimento: number | null };
  } | null>(null);

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Carregar dados
        // Cross usa getAll pois o filtro por mês/ano é feito em calcularCrossRealizadoMensal usando dataVenda
        const [clientes, prospects, custodiaReceita, metas, captacoes, ofertas, crosses] = await Promise.all([
          clienteRepository.getAll(user.uid),
          prospectRepository.getAll(user.uid),
          custodiaReceitaRepository.getByMonth(user.uid, mesAtual, anoAtual),
          monthlyGoalsRepository.getByMonth(user.uid, mesAtual, anoAtual),
          captacaoLancamentoRepository.getByMonth(user.uid, mesAtual, anoAtual),
          offerReservationRepository.getAll(user.uid),
          crossRepository.getAll(user.uid),
        ]) as [Cliente[], Prospect[], CustodiaReceita[], MonthlyGoals[], CaptacaoLancamento[], OfferReservation[], Cross[]];

        // Cálculos de custódia
        const custodiaTotal = calcularCustodiaTotal(clientes);
        
        // Derivar lançamentos de prospects realizados no mês (mesma lógica do CaptacaoPage/MetasPage)
        const sourceRefsExistentes = new Set(captacoes.filter(l => l.sourceRef).map(l => l.sourceRef));
        const derivadosProspects: CaptacaoLancamento[] = prospects
          .filter((p) => {
            if (!p.realizadoData || !p.realizadoValor) return false;
            const d = new Date(p.realizadoData + 'T00:00:00');
            return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
          })
          .filter((p) => !sourceRefsExistentes.has(`prospect:${p.id}`))
          .map((p): CaptacaoLancamento => ({
            id: `derived-${p.id}`,
            data: p.realizadoData!,
            mes: mesAtual,
            ano: anoAtual,
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
        
        // Realizados automáticos (puxada centralizada incluindo Prospect Auto)
        const realizados = calcularRealizadosMensal(custodiaReceita, captacoesConsolidadas, mesAtual, anoAtual, ofertas, crosses);
        
        // ROA
        const custodiaMedia = custodiaTotal > 0 ? custodiaTotal : 1;
        const roa = calcularROA(realizados.receita, custodiaMedia);

        // KPIs
        setKpis([
          {
            title: 'Clientes Ativos',
            value: String(clientes.filter((c) => c.status === 'ativo').length),
            icon: Users,
            color: 'bg-blue-500',
          },
          {
            title: 'Prospects',
            value: String(prospects.filter((p) => p.status !== 'perdido' && p.status !== 'ganho').length),
            icon: UserPlus,
            color: 'bg-purple-500',
          },
          {
            title: 'Custódia Total',
            value: formatCurrency(custodiaTotal),
            icon: TrendingUp,
            color: 'bg-green-500',
          },
          {
            title: 'Receita do Mês',
            value: formatCurrency(realizados.receita),
            icon: DollarSign,
            color: 'bg-yellow-500',
          },
          {
            title: 'Captação Líquida',
            value: formatCurrency(realizados.captacaoLiquida),
            change: realizados.captacaoLiquida,
            icon: Target,
            color: 'bg-indigo-500',
          },
          {
            title: 'Transferência XP',
            value: formatCurrency(realizados.transferenciaXp),
            change: realizados.transferenciaXp,
            icon: Repeat,
            color: 'bg-cyan-500',
          },
          {
            title: 'ROA Mensal',
            value: formatPercent(roa),
            icon: TrendingUp,
            color: 'bg-pink-500',
          },
        ]);

        // Comparativo com metas (apenas Receita, Captação Líquida, Transferência XP)
        const meta = metas.length > 0 ? metas[0] : null;
        if (meta) {
          setComparativo({
            receita: {
              meta: meta.metaReceita || 0,
              realizado: realizados.receita,
              atingimento: calcularPercentAtingido(meta.metaReceita || 0, realizados.receita),
            },
            captacaoLiquida: {
              meta: meta.metaCaptacaoLiquida || 0,
              realizado: realizados.captacaoLiquida,
              atingimento: calcularPercentAtingido(meta.metaCaptacaoLiquida || 0, realizados.captacaoLiquida),
            },
            transferenciaXp: {
              meta: meta.metaTransferenciaXp || 0,
              realizado: realizados.transferenciaXp,
              atingimento: calcularPercentAtingido(meta.metaTransferenciaXp || 0, realizados.transferenciaXp),
            },
          });
        } else {
          setComparativo(null);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, mesAtual, anoAtual]);

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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            {getNomeMes(mesAtual)} de {anoAtual}
          </p>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow p-6 flex items-center space-x-4"
          >
            <div className={`p-3 rounded-full ${kpi.color}`}>
              <kpi.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              {kpi.change !== undefined && (
                <div className={`flex items-center text-sm ${kpi.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.change >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>{kpi.change >= 0 ? 'Positivo' : 'Negativo'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comparativo Metas */}
      {comparativo && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Comparativo com Metas - {getNomeMes(mesAtual)}/{anoAtual}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Receita */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Receita</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.receita.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className="font-medium">{formatCurrency(comparativo.receita.realizado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${
                    comparativo.receita.atingimento === null ? 'text-gray-500' :
                    comparativo.receita.atingimento >= 100 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {comparativo.receita.atingimento === null ? '—' : formatPercent(comparativo.receita.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      comparativo.receita.atingimento === null ? 'bg-gray-300' :
                      comparativo.receita.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(Math.max(comparativo.receita.atingimento || 0, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Captação Líquida */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Captação Líquida</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.captacaoLiquida.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className={`font-medium ${comparativo.captacaoLiquida.realizado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(comparativo.captacaoLiquida.realizado)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${
                    comparativo.captacaoLiquida.atingimento === null ? 'text-gray-500' :
                    comparativo.captacaoLiquida.atingimento >= 100 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {comparativo.captacaoLiquida.atingimento === null ? '—' : formatPercent(comparativo.captacaoLiquida.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      comparativo.captacaoLiquida.atingimento === null ? 'bg-gray-300' :
                      comparativo.captacaoLiquida.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(Math.max(comparativo.captacaoLiquida.atingimento || 0, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Transferência XP */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Transferência XP</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.transferenciaXp.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className={`font-medium ${comparativo.transferenciaXp.realizado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(comparativo.transferenciaXp.realizado)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${
                    comparativo.transferenciaXp.atingimento === null ? 'text-gray-500' :
                    comparativo.transferenciaXp.atingimento >= 100 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {comparativo.transferenciaXp.atingimento === null ? '—' : formatPercent(comparativo.transferenciaXp.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      comparativo.transferenciaXp.atingimento === null ? 'bg-gray-300' :
                      comparativo.transferenciaXp.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(Math.max(comparativo.transferenciaXp.atingimento || 0, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/clientes"
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Novo Cliente</span>
          </a>
          <a
            href="/prospects"
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <UserPlus className="w-8 h-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Novo Prospect</span>
          </a>
          <a
            href="/metas"
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Target className="w-8 h-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Ver Metas</span>
          </a>
          <a
            href="/salario"
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <DollarSign className="w-8 h-8 text-yellow-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Ver Salário</span>
          </a>
        </div>
      </div>
    </div>
  );
}
