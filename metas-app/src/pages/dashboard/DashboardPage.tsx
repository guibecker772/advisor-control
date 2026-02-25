import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChangeEvent } from 'react';
import {
  DollarSign,
  Package,
  Repeat,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import {
  clienteRepository,
  clienteReuniaoRepository,
  prospectRepository,
  custodiaReceitaRepository,
  monthlyGoalsRepository,
  captacaoLancamentoRepository,
  offerReservationRepository,
  crossRepository,
  calendarEventRepository,
} from '../../services/repositories';
import {
  calcularCustodiaTotal,
  calcularROA,
  calcularRealizadosMensal,
  formatCurrency,
  formatPercent,
  getNomeMes,
} from '../../domain/calculations';
import { getCaptacaoResumoPeriodo } from '../../domain/calculations/captacaoPeriodo';
import {
  competenceMonthToMonthYear,
  getCurrentCompetenceMonth,
  normalizeCompetenceMonth,
} from '../../domain/offers';
import type {
  CaptacaoLancamento,
  Cliente,
  ClienteReuniao,
  Cross,
  CustodiaReceita,
  MonthlyGoals,
  OfferReservation,
  Prospect,
} from '../../domain/types';
import type { CalendarEvent } from '../../domain/types/calendar';
import { subscribeDataInvalidation } from '../../lib/dataInvalidation';
import { EmptyState, KpiCard, PageContainer, PageHeader, PageSkeleton, SectionCard } from '../../components/ui';
import { EvolucaoPatrimonialChart } from './components/EvolucaoPatrimonialChart';
import { AlertasEOportunidades } from './components/AlertasEOportunidades';
import { AtividadeRecente } from './components/AtividadeRecente';
import { MetaPeriodoCard } from './components/MetaPeriodoCard';
import { OffersOperationalPanel } from './components/OffersOperationalPanel';
import { useAuth } from '../../contexts/AuthContext';

interface QuickAction {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  iconColor: string;
  iconBackground: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Clientes',
    description: 'Gestão de carteira',
    to: '/clientes',
    icon: Users,
    iconColor: 'var(--color-info)',
    iconBackground: 'var(--color-info-bg)',
  },
  {
    label: 'Prospects',
    description: 'Pipeline comercial',
    to: '/prospects',
    icon: UserPlus,
    iconColor: 'var(--color-warning)',
    iconBackground: 'var(--color-warning-bg)',
  },
  {
    label: 'Captação',
    description: 'Entradas e saídas',
    to: '/captacao',
    icon: TrendingUp,
    iconColor: 'var(--chart-1)',
    iconBackground: 'var(--color-info-bg)',
  },
  {
    label: 'Metas',
    description: 'Planejamento mensal',
    to: '/metas',
    icon: Target,
    iconColor: 'var(--color-success)',
    iconBackground: 'var(--color-success-bg)',
  },
  {
    label: 'Salário',
    description: 'Comissões e ajustes',
    to: '/salario',
    icon: DollarSign,
    iconColor: 'var(--color-gold)',
    iconBackground: 'var(--color-gold-bg)',
  },
  {
    label: 'Ofertas/Ativos',
    description: 'Book de ofertas',
    to: '/ofertas',
    icon: Package,
    iconColor: 'var(--chart-5)',
    iconBackground: 'var(--color-info-bg)',
  },
];

const DASHBOARD_COMPETENCE_MONTH_STORAGE_KEY = 'advisor_dashboard_competence_v1';

function readInitialCompetenceMonth(): string {
  if (typeof window === 'undefined') return getCurrentCompetenceMonth();
  const stored = window.localStorage.getItem(DASHBOARD_COMPETENCE_MONTH_STORAGE_KEY);
  return normalizeCompetenceMonth(stored, new Date().toISOString());
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRequestIdRef = useRef(0);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [custodiaReceita, setCustodiaReceita] = useState<CustodiaReceita[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoals[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoals | null>(null);
  const [captacaoLancamentos, setCaptacaoLancamentos] = useState<CaptacaoLancamento[]>([]);
  const [offers, setOffers] = useState<OfferReservation[]>([]);
  const [crosses, setCrosses] = useState<Cross[]>([]);
  const [reunioesMes, setReunioesMes] = useState<ClienteReuniao[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [competenceMonth, setCompetenceMonth] = useState<string>(readInitialCompetenceMonth);

  const normalizedCompetenceMonth = useMemo(() => {
    return normalizeCompetenceMonth(competenceMonth, new Date().toISOString());
  }, [competenceMonth]);

  const periodoSelecionado = useMemo(() => {
    const parsed = competenceMonthToMonthYear(normalizedCompetenceMonth);
    if (parsed) return parsed;

    const fallback = competenceMonthToMonthYear(getCurrentCompetenceMonth());
    if (fallback) return fallback;

    const now = new Date();
    return { mes: now.getMonth() + 1, ano: now.getFullYear() };
  }, [normalizedCompetenceMonth]);

  const mesAtual = periodoSelecionado.mes;
  const anoAtual = periodoSelecionado.ano;

  const handleCompetenceMonthChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeCompetenceMonth(event.target.value, new Date().toISOString());
    setCompetenceMonth(nextValue);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_COMPETENCE_MONTH_STORAGE_KEY, normalizedCompetenceMonth);
  }, [normalizedCompetenceMonth]);

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setClientes([]);
      setProspects([]);
      setCustodiaReceita([]);
      setMonthlyGoals([]);
      setMonthlyGoal(null);
      setCaptacaoLancamentos([]);
      setOffers([]);
      setCrosses([]);
      setReunioesMes([]);
      setCalendarEvents([]);
      setLoading(false);
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      setLoading(true);

      const [
        clientesData,
        prospectsData,
        custodiaData,
        monthlyGoalsData,
        captacoesData,
        ofertasData,
        crossData,
        reunioesData,
        calendarData,
      ] = await Promise.all([
        clienteRepository.getAll(ownerUid),
        prospectRepository.getAll(ownerUid),
        custodiaReceitaRepository.getByMonth(ownerUid, mesAtual, anoAtual),
        monthlyGoalsRepository.getAll(ownerUid),
        captacaoLancamentoRepository.getAll(ownerUid),
        offerReservationRepository.getAll(ownerUid),
        crossRepository.getAll(ownerUid),
        clienteReuniaoRepository.getByMonth(ownerUid, mesAtual, anoAtual),
        calendarEventRepository.getAll(ownerUid),
      ]) as [
        Cliente[],
        Prospect[],
        CustodiaReceita[],
        MonthlyGoals[],
        CaptacaoLancamento[],
        OfferReservation[],
        Cross[],
        ClienteReuniao[],
        CalendarEvent[],
      ];

      if (requestId !== loadRequestIdRef.current) return;

      setClientes(clientesData);
      setProspects(prospectsData);
      setCustodiaReceita(custodiaData);
      setMonthlyGoals(monthlyGoalsData);
      setMonthlyGoal(
        monthlyGoalsData.find((goal) => goal.mes === mesAtual && goal.ano === anoAtual) ?? null,
      );
      setCaptacaoLancamentos(captacoesData);
      setOffers(ofertasData);
      setCrosses(crossData);
      setReunioesMes(reunioesData);
      setCalendarEvents(calendarData);
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authLoading, ownerUid, mesAtual, anoAtual]);

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData, refreshSeq]);

  useEffect(() => {
    const unsubscribe = subscribeDataInvalidation(
      ['dashboard', 'captacao', 'clients', 'prospects', 'metas', 'offers', 'cross', 'agendas', 'salary'],
      () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = setTimeout(() => {
          setRefreshSeq((current) => current + 1);
        }, 200);
      },
    );

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      unsubscribe();
    };
  }, []);

  const clientesAtivos = useMemo(() => {
    return clientes.filter((cliente) => cliente.status === 'ativo');
  }, [clientes]);

  const custodiaTotal = useMemo(() => {
    return calcularCustodiaTotal(clientes);
  }, [clientes]);

  const realizadosMes = useMemo(() => {
    return calcularRealizadosMensal(
      custodiaReceita,
      captacaoLancamentos,
      mesAtual,
      anoAtual,
      offers,
      crosses,
    );
  }, [custodiaReceita, captacaoLancamentos, mesAtual, anoAtual, offers, crosses]);

  const captacaoResumoMes = useMemo(() => {
    return getCaptacaoResumoPeriodo(captacaoLancamentos, mesAtual, anoAtual);
  }, [captacaoLancamentos, mesAtual, anoAtual]);

  const roaMensal = useMemo(() => {
    const custodiaMedia = custodiaTotal > 0 ? custodiaTotal : 1;
    return calcularROA(realizadosMes.receita, custodiaMedia);
  }, [custodiaTotal, realizadosMes.receita]);

  const kpiCards = useMemo(() => {
    const getTrend = (value: number): 'up' | 'down' | 'neutral' => {
      if (value > 0) return 'up';
      if (value < 0) return 'down';
      return 'neutral';
    };

    const getTrendText = (value: number): string => {
      if (value > 0) return 'Positiva';
      if (value < 0) return 'Negativa';
      return 'Em linha';
    };

    return [
      {
        id: 'custodia-total',
        title: 'Custódia Total',
        value: formatCurrency(custodiaTotal),
        subtitle: 'Onshore + Offshore',
        icon: Wallet,
        accentColor: 'gold' as const,
      },
      {
        id: 'captacao-liquida',
        title: 'Captação Líquida (Mês)',
        value: formatCurrency(captacaoResumoMes.captacaoLiquida),
        subtitle: getNomeMes(mesAtual),
        icon: TrendingUp,
        accentColor: 'info' as const,
        trend: getTrend(captacaoResumoMes.captacaoLiquida),
        trendValue: getTrendText(captacaoResumoMes.captacaoLiquida),
      },
      {
        id: 'transferencia-xp',
        title: 'Transferência XP (Mês)',
        value: formatCurrency(captacaoResumoMes.transferenciaXp),
        subtitle: getNomeMes(mesAtual),
        icon: Repeat,
        accentColor: 'warning' as const,
        trend: getTrend(captacaoResumoMes.transferenciaXp),
        trendValue: getTrendText(captacaoResumoMes.transferenciaXp),
      },
      {
        id: 'receita-realizada',
        title: 'Receita Realizada (Mês)',
        value: formatCurrency(realizadosMes.receita),
        subtitle: 'Volume de receita do período',
        icon: DollarSign,
        accentColor: 'success' as const,
        trend: getTrend(realizadosMes.receita),
        trendValue: getTrendText(realizadosMes.receita),
      },
      {
        id: 'roa-mensal',
        title: 'ROA Mensal',
        value: formatPercent(roaMensal, 2),
        subtitle: 'Receita / Custódia média',
        icon: Target,
        accentColor: 'gold' as const,
      },
      {
        id: 'clientes-ativos',
        title: 'Clientes (Ativos)',
        value: clientesAtivos.length,
        subtitle: `Total (incl. inativos): ${clientes.length}`,
        icon: Users,
        accentColor: 'success' as const,
      },
    ];
  }, [
    clientes.length,
    clientesAtivos.length,
    custodiaTotal,
    captacaoResumoMes.captacaoLiquida,
    captacaoResumoMes.transferenciaXp,
    realizadosMes.receita,
    roaMensal,
    mesAtual,
  ]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(lastUpdatedAt);
  }, [lastUpdatedAt]);

  if (!user) return null;

  if (loading) {
    return (
      <PageContainer variant="wide">
        <PageSkeleton showKpis kpiCount={5} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide">
      <PageHeader
        title="Visão Geral"
        subtitle={`${getNomeMes(mesAtual)} de ${anoAtual}${lastUpdatedLabel ? ` • Atualizado em: ${lastUpdatedLabel}` : ''}`}
        controls={(
          <div className="flex items-center gap-2">
            <label
              htmlFor="dashboard-competence-month"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Competência
            </label>
            <input
              id="dashboard-competence-month"
              type="month"
              value={normalizedCompetenceMonth}
              onChange={handleCompetenceMonthChange}
              className="px-3 py-2 rounded-md text-sm focus-gold"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Selecionar competência do dashboard"
            />
          </div>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <KpiCard
              key={kpi.id}
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              icon={<Icon className="w-5 h-5" />}
              accentColor={kpi.accentColor}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
              layout="wide"
            />
          );
        })}
      </div>

      {!monthlyGoal && (
        <SectionCard title="Metas do mês" subtitle="Defina objetivos para acompanhar a performance">
          <EmptyState
            title="Metas não configuradas"
            description="Defina suas metas mensais para acompanhar o desempenho do período."
            action={(
              <Link
                to="/metas"
                className="rounded-lg px-4 py-2 text-sm font-medium focus-gold"
                style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
              >
                Definir metas
              </Link>
            )}
          />
        </SectionCard>
      )}

      <OffersOperationalPanel
        offers={offers}
        selectedCompetenceMonth={normalizedCompetenceMonth}
        offersRoute="/ofertas"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 self-start">
          <EvolucaoPatrimonialChart
            lancamentos={captacaoResumoMes.lancamentosPeriodo}
            mesAtual={mesAtual}
            anoAtual={anoAtual}
            captacaoRoute="/captacao"
          />
        </div>

        <div className="lg:col-span-4 self-start space-y-6">
          <SectionCard title="Ações rápidas" subtitle="Atalhos estratégicos">
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="rounded-lg border p-3 transition-colors hover:bg-[var(--color-surface-3)] focus-gold"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      borderColor: 'var(--color-border-subtle)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center mb-2"
                      style={{ backgroundColor: action.iconBackground }}
                    >
                      <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {action.label}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <MetaPeriodoCard
            goals={monthlyGoals}
            lancamentos={captacaoLancamentos}
            mesAtual={mesAtual}
            anoAtual={anoAtual}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <AlertasEOportunidades
            clientes={clientes}
            prospects={prospects}
            offers={offers}
            monthlyGoal={monthlyGoal}
            reunioesMes={reunioesMes}
            calendarEvents={calendarEvents}
          />
        </div>

        <div className="lg:col-span-8">
          <AtividadeRecente
            clientes={clientes}
            prospects={prospects}
            lancamentosCaptacao={captacaoLancamentos}
            offers={offers}
            crosses={crosses}
            calendarEvents={calendarEvents}
          />
        </div>
      </div>
    </PageContainer>
  );
}
