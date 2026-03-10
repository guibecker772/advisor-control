/**
 * Client360Drawer — Visão 360° do cliente em panel lateral (Drawer).
 *
 * Seções:
 *   1. Resumo Financeiro (custódia, receita, ROA, fee fixo)
 *   2. Produtos contratados (ClientProduct cards)
 *   3. Relacionamento & Reunião (timeline, next meeting, meeting form)
 *   4. Movimentações recentes (ofertas do mês)
 *   5. Indicadores estratégicos (Opportunity Score + Smart Badges)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  DollarSign,
  Package,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import type { Cliente, ClienteReuniao, Cross, CustodiaReceita, OfferReservation } from '../../domain/types';
import type { ClientProduct } from '../../domain/types/clientProduct';
import {
  CLIENT_PRODUCT_TYPE_LABELS,
  CLIENT_PRODUCT_STATUS_LABELS,
} from '../../domain/types/clientProduct';
import {
  calcularResumoFinanceiro,
  calcularResumoRelacionamento,
  calcularMovimentacoesRecentes,
  calcularOpportunityScore,
  gerarSmartBadges,
  type ClientFinancialSummary,
  type ClientRelationshipSummary,
  type ClientMovement,
  type OpportunityScore,
  type SmartBadge,
} from '../../domain/calculations/clientIntelligence';
import { formatCurrency } from '../../domain/calculations';
import {
  clienteReuniaoRepository,
  clientProductRepository,
  offerReservationRepository,
  crossRepository,
  custodiaReceitaRepository,
} from '../../services/repositories';
import { resolveAccessCapabilities } from '../../lib/access';
import {
  getAdvisorClientLink,
} from '../../services/privateWealthIntegration';
import { openPrivateWealthInNewTab } from '../../services/privateWealthLauncher';
import ClientSummaryPanel from './ClientSummaryPanel';
import { Drawer } from '../ui';

// ============== PROPS ==============

interface Client360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  mes: number;
  ano: number;
  /** Reunião do período (mesa já carregada no ClientesPage) */
  reuniao?: ClienteReuniao;
  onReuniaoSaved: (r: ClienteReuniao) => void;
}

// ============== SUB-COMPONENTS ==============

function SectionTitle({ icon: Icon, label }: { icon: typeof Star; label: string }) {
  return (
    <h3
      className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'var(--color-gold)' }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </h3>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  variant = 'default',
}: {
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'gold' | 'success' | 'warning';
}) {
  const variantColor = {
    default: 'var(--color-text)',
    gold: 'var(--color-gold)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
  };

  return (
    <div
      className="p-3 rounded-lg"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-semibold" style={{ color: variantColor[variant] }}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {subValue}
        </p>
      )}
    </div>
  );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxScore }).map((_, i) => (
        <div
          key={`score-${i}`}
          className="h-2 flex-1 rounded-full"
          style={{
            backgroundColor:
              i < score
                ? score >= 4
                  ? 'var(--color-danger)'
                  : score >= 2
                    ? 'var(--color-warning)'
                    : 'var(--color-success)'
                : 'var(--color-surface-3)',
          }}
        />
      ))}
    </div>
  );
}

function SmartBadgeChip({ badge }: { badge: SmartBadge }) {
  const variantMap: Record<SmartBadge['variant'], string> = {
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    success: 'var(--color-success)',
    neutral: 'var(--color-text-muted)',
    gold: 'var(--color-gold)',
  };

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${variantMap[badge.variant]} 15%, transparent)`,
        color: variantMap[badge.variant],
        border: `1px solid color-mix(in srgb, ${variantMap[badge.variant]} 30%, transparent)`,
      }}
    >
      <span>{badge.emoji}</span>
      {badge.label}
    </span>
  );
}

// ============== MAIN COMPONENT ==============

export default function Client360Drawer({
  isOpen,
  onClose,
  cliente,
  mes,
  ano,
  reuniao,
  onReuniaoSaved,
}: Client360DrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ownerUid = user?.uid;

  // === Local state ===
  const [realizada, setRealizada] = useState(reuniao?.realizada || false);
  const [observacoes, setObservacoes] = useState(reuniao?.observacoes || '');
  const [saving, setSaving] = useState(false);
  const [openingPlanning, setOpeningPlanning] = useState(false);
  const [openingExport, setOpeningExport] = useState(false);
  const [hasPersistedLink, setHasPersistedLink] = useState(false);

  // === Data for intelligence ===
  const [clientProducts, setClientProducts] = useState<ClientProduct[]>([]);
  const [ofertas, setOfertas] = useState<OfferReservation[]>([]);
  const [crosses, setCrosses] = useState<Cross[]>([]);
  const [custodiaReceita, setCustodiaReceita] = useState<CustodiaReceita[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const access = useMemo(() => resolveAccessCapabilities(user), [user]);
  const canLinkNewClient = !access.readOnly;
  const canOpenPlanning = hasPersistedLink || canLinkNewClient;
  const canOpenExport = access.canExportPrivateWealthReport && (hasPersistedLink || canLinkNewClient);
  const canCreateEvent = access.canCreateEvent;
  const planningDisabledReason = !canOpenPlanning ? 'Sem permissão para vincular' : undefined;
  const exportDisabledReason = !access.canExportPrivateWealthReport
    ? 'Sem permissão para exportar'
    : !canOpenExport
      ? 'Sem permissão para vincular'
      : undefined;
  const createEventDisabledReason = canCreateEvent ? undefined : 'Sem permissão para criar evento';

  // Reset form state when client/period changes
  useEffect(() => {
    setRealizada(reuniao?.realizada || false);
    setObservacoes(reuniao?.observacoes || '');
  }, [reuniao, cliente.id, mes, ano]);

  // Check PW link status
  useEffect(() => {
    if (!isOpen || !user || !cliente.id) {
      setHasPersistedLink(false);
      return;
    }
    const existingLink = getAdvisorClientLink(cliente.id, user);
    setHasPersistedLink(Boolean(existingLink));
  }, [cliente.id, isOpen, user]);

  // Load intelligence data when drawer opens
  useEffect(() => {
    if (!isOpen || !ownerUid || !cliente.id) return;

    let cancelled = false;
    const loadIntelligenceData = async () => {
      try {
        setDataLoading(true);
        const [products, offers, crossData, custodiaData] = await Promise.all([
          clientProductRepository.getByCliente(ownerUid, cliente.id!),
          offerReservationRepository.getAll(ownerUid),
          crossRepository.getByCliente(ownerUid, cliente.id!),
          custodiaReceitaRepository.getByCliente(ownerUid, cliente.id!),
        ]);
        if (cancelled) return;
        setClientProducts(products);
        setOfertas(offers);
        setCrosses(crossData);
        setCustodiaReceita(custodiaData);
      } catch (error) {
        console.error('Erro ao carregar dados de inteligência:', error);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    loadIntelligenceData();
    return () => { cancelled = true; };
  }, [isOpen, ownerUid, cliente.id]);

  // === Calculations (memoized) ===
  const financeiro = useMemo<ClientFinancialSummary>(
    () => calcularResumoFinanceiro(cliente, ofertas, custodiaReceita, crosses, clientProducts, mes, ano),
    [cliente, ofertas, custodiaReceita, crosses, clientProducts, mes, ano],
  );

  const relacionamento = useMemo<ClientRelationshipSummary>(() => {
    // We only have current period reunião here; build a minimal array
    const reunioes: ClienteReuniao[] = reuniao ? [reuniao] : [];
    return calcularResumoRelacionamento(cliente.id ?? '', reunioes, mes, ano, cliente.nextMeetingAt);
  }, [cliente.id, cliente.nextMeetingAt, reuniao, mes, ano]);

  const movimentacoes = useMemo<ClientMovement[]>(
    () => calcularMovimentacoesRecentes(cliente.id ?? '', ofertas, mes, ano),
    [cliente.id, ofertas, mes, ano],
  );

  const opportunityScore = useMemo<OpportunityScore>(
    () => calcularOpportunityScore(cliente, clientProducts, relacionamento, financeiro),
    [cliente, clientProducts, relacionamento, financeiro],
  );

  const smartBadges = useMemo<SmartBadge[]>(
    () => gerarSmartBadges(cliente, clientProducts, relacionamento, financeiro, opportunityScore),
    [cliente, clientProducts, relacionamento, financeiro, opportunityScore],
  );

  // === Handlers ===
  const handleSaveReuniao = useCallback(async () => {
    if (!user || !cliente.id) return;
    try {
      setSaving(true);
      if (reuniao?.id) {
        const updated = await clienteReuniaoRepository.update(
          reuniao.id,
          { realizada, observacoes },
          user.uid,
        );
        if (updated) {
          onReuniaoSaved(updated);
          toast.success('Reunião atualizada!');
        }
      } else {
        const created = await clienteReuniaoRepository.create(
          { clienteId: cliente.id, mes, ano, realizada, observacoes },
          user.uid,
        );
        onReuniaoSaved(created);
        toast.success('Reunião salva!');
      }
    } catch (error) {
      console.error('Erro ao salvar Reunião:', error);
      toast.error('Erro ao salvar Reunião');
    } finally {
      setSaving(false);
    }
  }, [user, cliente.id, reuniao, realizada, observacoes, mes, ano, onReuniaoSaved]);

  const handleOpenPlanning = useCallback(async () => {
    if (!user || !cliente.id || !canOpenPlanning) return;
    try {
      setOpeningPlanning(true);
      const response = await openPrivateWealthInNewTab({
        acClientId: cliente.id,
        intent: 'open_planning',
        user,
      });
      toast.success(
        response.kind === 'linked'
          ? 'Abrindo planejamento no Private Wealth...'
          : 'Abra a nova aba para vincular o cliente e abrir o planejamento.',
      );
    } catch (error) {
      console.error('Erro ao abrir planejamento:', error);
      if (error instanceof Error && error.message === 'LINK_FORBIDDEN') {
        toast.error('Sem permissão para vincular este cliente.');
      } else {
        toast.error('Não foi possível abrir. Tente novamente.');
      }
    } finally {
      setOpeningPlanning(false);
    }
  }, [user, cliente.id, canOpenPlanning]);

  const handleOpenExport = useCallback(async () => {
    if (!user || !cliente.id || !canOpenExport) return;
    try {
      setOpeningExport(true);
      const response = await openPrivateWealthInNewTab({
        acClientId: cliente.id,
        intent: 'export_premium',
        user,
      });
      toast.success(
        response.kind === 'linked'
          ? 'Abrindo export premium no Private Wealth...'
          : 'Abra a nova aba para vincular e gerar o relatório premium.',
      );
    } catch (error) {
      console.error('Erro ao abrir export premium:', error);
      toast.error('Não foi possível abrir. Tente novamente.');
    } finally {
      setOpeningExport(false);
    }
  }, [user, cliente.id, canOpenExport]);

  const handleCreateEvent = useCallback(() => {
    if (!canCreateEvent) return;
    const params = new URLSearchParams({ quickCreate: '1' });
    if (cliente.id) params.set('clientId', cliente.id);
    navigate(`/agendas?${params.toString()}`);
  }, [canCreateEvent, cliente.id, navigate]);

  const handleViewAgendas = useCallback(() => {
    if (cliente.id) {
      navigate(`/agendas?clientId=${cliente.id}`);
      return;
    }
    navigate('/agendas');
  }, [cliente.id, navigate]);

  const mesNome = new Date(2000, mes - 1).toLocaleString('pt-BR', { month: 'long' });
  const activeProducts = clientProducts.filter(
    (p) => p.clienteId === cliente.id && p.status === 'ATIVO',
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={cliente.nome}
      subtitle={`${cliente.codigoConta || 'Sem código'} · ${cliente.status || 'ativo'}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Client Summary Panel — existing component with timeline */}
        <ClientSummaryPanel
          client={cliente}
          ownerUid={ownerUid}
          isPwLinked={hasPersistedLink}
          openingPlanning={openingPlanning}
          openingExport={openingExport}
          canOpenPlanning={canOpenPlanning}
          canOpenExport={canOpenExport}
          canCreateEvent={canCreateEvent}
          planningDisabledReason={planningDisabledReason}
          exportDisabledReason={exportDisabledReason}
          createEventDisabledReason={createEventDisabledReason}
          onLinkPw={handleOpenPlanning}
          onOpenPlanning={handleOpenPlanning}
          onOpenExport={handleOpenExport}
          onCreateEvent={handleCreateEvent}
          onViewAgendas={handleViewAgendas}
        />

        {/* ── Section 1: Resumo Financeiro ── */}
        <section>
          <SectionTitle icon={DollarSign} label="Resumo Financeiro" />
          {dataLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`fin-skel-${i}`} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-surface-2)' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Custódia Total"
                value={formatCurrency(financeiro.custodiaTotal)}
                variant="default"
              />
              <MetricCard
                label="Receita Realizada (mês)"
                value={formatCurrency(financeiro.receitaMes)}
                variant="success"
              />
              <MetricCard
                label="Receita Estimada (mês)"
                value={formatCurrency(financeiro.receitaEstimadaMes)}
                subValue={financeiro.receitaEstimadaMes > financeiro.receitaMes ? 'Pipeline ativo' : undefined}
                variant="warning"
              />
              <MetricCard
                label="ROA Mensal"
                value={`${(financeiro.roaMedio * 100).toFixed(3)}%`}
                subValue={financeiro.hasFixedFee ? `Fee: ${formatCurrency(financeiro.feeFixoMensal)}/mês` : undefined}
                variant="gold"
              />
            </div>
          )}
        </section>

        {/* ── Section 2: Produtos Contratados ── */}
        <section>
          <SectionTitle icon={Package} label="Produtos Contratados" />
          {dataLoading ? (
            <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-surface-2)' }} />
          ) : activeProducts.length === 0 ? (
            <div
              className="p-4 rounded-lg text-center text-sm"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              Nenhum produto ativo cadastrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-3 rounded-lg flex items-start gap-3"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
                    }}
                  >
                    {product.type === 'SEGURO_VIDA' ? (
                      <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    ) : product.type === 'FEE_FIXO' ? (
                      <Briefcase className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    ) : (
                      <Package className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {product.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {CLIENT_PRODUCT_TYPE_LABELS[product.type]} ·{' '}
                      {CLIENT_PRODUCT_STATUS_LABELS[product.status]}
                    </p>
                    {product.valor > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatCurrency(product.valor)}
                        {product.valorMensal && product.valorMensal > 0
                          ? ` (${formatCurrency(product.valorMensal)}/mês)`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3: Relacionamento & Reunião ── */}
        <section>
          <SectionTitle icon={Users} label="Relacionamento" />

          {/* Quick relationship stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard
              label="Última Reunião"
              value={
                relacionamento.ultimaReuniao
                  ? new Date(relacionamento.ultimaReuniao).toLocaleDateString('pt-BR', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Sem registro'
              }
              subValue={
                relacionamento.diasSemContato !== null
                  ? `${relacionamento.diasSemContato} dias atrás`
                  : undefined
              }
              variant={
                relacionamento.diasSemContato !== null && relacionamento.diasSemContato >= 90
                  ? 'warning'
                  : 'default'
              }
            />
            <MetricCard
              label="Reunião do Período"
              value={relacionamento.reuniaoPeriodoRealizada ? 'Realizada ✓' : 'Pendente'}
              variant={relacionamento.reuniaoPeriodoRealizada ? 'success' : 'warning'}
            />
          </div>

          {/* Meeting form */}
          <div
            className="p-4 rounded-lg space-y-3"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Reunião de {mesNome} {ano}
            </h4>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={realizada}
                onChange={(e) => setRealizada(e.target.checked)}
                className="w-5 h-5 rounded"
                style={{ accentColor: 'var(--color-gold)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Reunião realizada
              </span>
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md text-sm focus-gold"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              placeholder="Anotações sobre a reunião..."
            />
            <button
              onClick={handleSaveReuniao}
              disabled={saving}
              className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              style={{
                backgroundColor: 'var(--color-gold)',
                color: 'var(--color-text-inverse)',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Reunião'}
            </button>
          </div>
        </section>

        {/* ── Section 4: Movimentações Recentes ── */}
        <section>
          <SectionTitle icon={TrendingUp} label="Movimentações Recentes" />
          {dataLoading ? (
            <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-surface-2)' }} />
          ) : movimentacoes.length === 0 ? (
            <div
              className="p-4 rounded-lg text-center text-sm"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              Nenhuma movimentação no período.
            </div>
          ) : (
            <div className="space-y-2">
              {movimentacoes.map((mov, i) => (
                <div
                  key={`mov-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {mov.offerName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {mov.status} · {formatCurrency(mov.valor)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                      {formatCurrency(mov.receita)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>receita</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 5: Indicadores Estratégicos ── */}
        <section>
          <SectionTitle icon={BarChart3} label="Indicadores Estratégicos" />

          {/* Opportunity Score */}
          <div
            className="p-4 rounded-lg mb-4"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Opportunity Score
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {opportunityScore.label}
                </p>
              </div>
              <span
                className="text-2xl font-bold"
                style={{
                  color:
                    opportunityScore.level === 'high'
                      ? 'var(--color-danger)'
                      : opportunityScore.level === 'medium'
                        ? 'var(--color-warning)'
                        : 'var(--color-success)',
                }}
              >
                {opportunityScore.score}/{opportunityScore.maxScore}
              </span>
            </div>
            <ScoreBar score={opportunityScore.score} maxScore={opportunityScore.maxScore} />
            {opportunityScore.reasons.length > 0 && (
              <ul className="mt-3 space-y-1">
                {opportunityScore.reasons.map((reason, i) => (
                  <li
                    key={`reason-${i}`}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <CalendarCheck className="w-3 h-3 shrink-0" style={{ color: 'var(--color-warning)' }} />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Smart Badges */}
          {smartBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {smartBadges.map((badge) => (
                <SmartBadgeChip key={badge.id} badge={badge} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
