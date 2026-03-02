import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { KpiCard, PageContainer, PageHeader, PageSkeleton, SectionCard } from '../../components/ui';
import { EvolucaoPatrimonialChart } from './components/EvolucaoPatrimonialChart';
import { AlertasEOportunidades } from './components/AlertasEOportunidades';
import { AtividadeRecente } from './components/AtividadeRecente';
import { MetaPeriodoCard } from './components/MetaPeriodoCard';
import { HojeWidget } from './components/HojeWidget';
import { FunilProspects } from './components/FunilProspects';
import { Top5ClientesCustodia, Top5Captacoes } from './components/Top5Widgets';
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

export default function DashboardPage() {
  const { user } = useAuth();
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

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const loadData = useCallback(async () => {
    if (!user) return;
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
        clienteRepository.getAll(user.uid),
        prospectRepository.getAll(user.uid),
        custodiaReceitaRepository.getByMonth(user.uid, mesAtual, anoAtual),
        monthlyGoalsRepository.getAll(user.uid),
        captacaoLancamentoRepository.getAll(user.uid),
        offerReservationRepository.getAll(user.uid),
        crossRepository.getAll(user.uid),
        clienteReuniaoRepository.getByMonth(user.uid, mesAtual, anoAtual),
        calendarEventRepository.getAll(user.uid),
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
  }, [user, mesAtual, anoAtual]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshSeq]);

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

    const captacaoProgress =
      monthlyGoal && Number(monthlyGoal.metaCaptacaoLiquida) > 0
        ? (realizadosMes.captacaoLiquida / Number(monthlyGoal.metaCaptacaoLiquida)) * 100
        : null;

    const receitaProgress =
      monthlyGoal && Number(monthlyGoal.metaReceita) > 0
        ? (realizadosMes.receita / Number(monthlyGoal.metaReceita)) * 100
        : null;

    const transferenciaProgress =
      monthlyGoal && Number(monthlyGoal.metaTransferenciaXp) > 0
        ? (realizadosMes.transferenciaXp / Number(monthlyGoal.metaTransferenciaXp)) * 100
        : null;

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
        value: formatCurrency(realizadosMes.captacaoLiquida),
        subtitle: getNomeMes(mesAtual),
        icon: TrendingUp,
        accentColor: 'info' as const,
        trend: getTrend(realizadosMes.captacaoLiquida),
        trendValue: getTrendText(realizadosMes.captacaoLiquida),
        progress: captacaoProgress,
        progressLabel: 'vs meta',
      },
      {
        id: 'transferencia-xp',
        title: 'Transferência XP (Mês)',
        value: formatCurrency(realizadosMes.transferenciaXp),
        subtitle: getNomeMes(mesAtual),
        icon: Repeat,
        accentColor: 'warning' as const,
        trend: getTrend(realizadosMes.transferenciaXp),
        trendValue: getTrendText(realizadosMes.transferenciaXp),
        progress: transferenciaProgress,
        progressLabel: 'vs meta',
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
        progress: receitaProgress,
        progressLabel: 'vs meta',
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
    realizadosMes.captacaoLiquida,
    realizadosMes.transferenciaXp,
    realizadosMes.receita,
    roaMensal,
    mesAtual,
    monthlyGoal,
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
      />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
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
              progress={kpi.progress}
              progressLabel={kpi.progressLabel}
            />
          );
        })}
      </div>

      {/* ── Main grid: content (8 col) + sticky rail (4 col) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-5">

        {/* ── Left: main content ── */}
        <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
          {/* Hoje widget (mobile-first priority) */}
          <div className="block lg:hidden">
            <HojeWidget prospects={prospects} calendarEvents={calendarEvents} />
          </div>

          {/* Alertas & Oportunidades */}
          <AlertasEOportunidades
            clientes={clientes}
            prospects={prospects}
            offers={offers}
            monthlyGoal={monthlyGoal}
            reunioesMes={reunioesMes}
            calendarEvents={calendarEvents}
          />

          {/* Chart */}
          <EvolucaoPatrimonialChart
            lancamentos={captacaoLancamentos}
            anoAtual={anoAtual}
            captacaoRoute="/captacao"
          />

          {/* Quick actions */}
          <SectionCard title="Ações rápidas" subtitle="Atalhos estratégicos">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="rounded-lg border p-2.5 transition-colors hover:bg-[var(--color-surface-3)] focus-gold text-center"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      borderColor: 'var(--color-border-subtle)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center mx-auto mb-1.5"
                      style={{ backgroundColor: action.iconBackground }}
                    >
                      <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                      {action.label}
                    </p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          {/* Meta período */}
          <MetaPeriodoCard
            goals={monthlyGoals}
            lancamentos={captacaoLancamentos}
            mesAtual={mesAtual}
            anoAtual={anoAtual}
          />

          {/* Top 5 row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Top5ClientesCustodia clientes={clientes} />
            <Top5Captacoes lancamentos={captacaoLancamentos} />
          </div>

          {/* Activity feed */}
          <AtividadeRecente
            clientes={clientes}
            prospects={prospects}
            lancamentosCaptacao={captacaoLancamentos}
            offers={offers}
            crosses={crosses}
            calendarEvents={calendarEvents}
          />
        </div>

        {/* ── Right: sticky rail ── */}
        <div className="lg:col-span-4 flex flex-col gap-5 lg:sticky lg:top-[80px] h-fit">
          {/* Hoje widget (desktop only — already shown above on mobile) */}
          <div className="hidden lg:block">
            <HojeWidget prospects={prospects} calendarEvents={calendarEvents} />
          </div>

          {/* Funil de prospects */}
          <FunilProspects prospects={prospects} />

          {/* Metas não configuradas alert */}
          {!monthlyGoal && (
            <SectionCard title="Metas do mês" subtitle="Defina objetivos">
              <div className="py-3 text-center">
                <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Metas não configuradas para este mês.
                </p>
                <Link
                  to="/metas"
                  className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus-gold transition-colors"
                  style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
                >
                  Definir metas
                </Link>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </PageContainer>
  );
}


