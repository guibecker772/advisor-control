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
} from 'lucide-react';
import { clienteRepository, prospectRepository, custodiaReceitaRepository, planoReceitasRepository } from '../../services/repositories';
import {
  calcularCustodiaTotal,
  calcularReceitaTotal,
  calcularCaptacaoTotal,
  calcularROA,
  formatCurrency,
  formatPercent,
  compararPlanoRealizado,
  getNomeMes,
} from '../../domain/calculations';
import type { Cliente, Prospect, CustodiaReceita, PlanoReceitas } from '../../domain/types';

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
  const [comparativo, setComparativo] = useState<ReturnType<typeof compararPlanoRealizado> | null>(null);

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Carregar dados
        const [clientes, prospects, custodiaReceita, planos] = await Promise.all([
          clienteRepository.getAll(user.uid),
          prospectRepository.getAll(user.uid),
          custodiaReceitaRepository.getByMonth(user.uid, mesAtual, anoAtual),
          planoReceitasRepository.getByMonth(user.uid, mesAtual, anoAtual),
        ]) as [Cliente[], Prospect[], CustodiaReceita[], PlanoReceitas[]];

        // Cálculos
        const custodiaTotal = calcularCustodiaTotal(clientes);
        const receitaTotal = calcularReceitaTotal(custodiaReceita);
        const captacaoTotal = calcularCaptacaoTotal(custodiaReceita);
        const custodiaMedia = custodiaTotal > 0 ? custodiaTotal : 1;
        const roa = calcularROA(receitaTotal, custodiaMedia);

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
            value: formatCurrency(receitaTotal),
            icon: DollarSign,
            color: 'bg-yellow-500',
          },
          {
            title: 'Captação Líquida',
            value: formatCurrency(captacaoTotal),
            change: captacaoTotal,
            icon: Target,
            color: 'bg-indigo-500',
          },
          {
            title: 'ROA Mensal',
            value: formatPercent(roa),
            icon: TrendingUp,
            color: 'bg-pink-500',
          },
        ]);

        // Comparativo com plano
        if (planos.length > 0) {
          const plano = planos[0];
          setComparativo(compararPlanoRealizado(plano, custodiaTotal, captacaoTotal, receitaTotal, 0));
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Custódia */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Custódia</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.custodia.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className="font-medium">{formatCurrency(comparativo.custodia.realizado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${comparativo.custodia.atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(comparativo.custodia.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${comparativo.custodia.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(comparativo.custodia.atingimento, 100)}%` }}
                  />
                </div>
              </div>

              {/* Captação */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Captação</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.captacao.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className="font-medium">{formatCurrency(comparativo.captacao.realizado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${comparativo.captacao.atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(comparativo.captacao.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${comparativo.captacao.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(Math.abs(comparativo.captacao.atingimento), 100)}%` }}
                  />
                </div>
              </div>

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
                  <span className={`font-medium ${comparativo.receita.atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(comparativo.receita.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${comparativo.receita.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(comparativo.receita.atingimento, 100)}%` }}
                  />
                </div>
              </div>

              {/* Cross */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Cross Selling</h3>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meta:</span>
                  <span className="font-medium">{formatCurrency(comparativo.cross.meta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Realizado:</span>
                  <span className="font-medium">{formatCurrency(comparativo.cross.realizado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Atingimento:</span>
                  <span className={`font-medium ${comparativo.cross.atingimento >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(comparativo.cross.atingimento)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${comparativo.cross.atingimento >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(comparativo.cross.atingimento, 100)}%` }}
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
            href="/custodia-receita"
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Lançar Receita</span>
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
