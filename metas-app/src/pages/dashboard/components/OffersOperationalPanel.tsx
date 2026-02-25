import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatCurrency,
  formatPercent,
} from '../../../domain/calculations';
import {
  formatCompetenceMonthPtBr,
  getOfferStatusLabel,
  normalizeCompetenceMonth,
  normalizeOfferStatus,
  type OfferStatus,
} from '../../../domain/offers';
import { calcOfferReservationTotals, type OfferReservation } from '../../../domain/types';
import { Badge, InlineEmpty, SectionCard } from '../../../components/ui';

interface OffersOperationalPanelProps {
  offers: OfferReservation[];
  selectedCompetenceMonth: string;
  offersRoute?: string;
}

type LiquidationWindowDays = 15 | 30;

interface UpcomingLiquidationItem {
  offer: OfferReservation;
  status: OfferStatus;
  liquidationDate: Date;
  revenueHouse: number;
}

function getStatusVariant(status: OfferStatus): 'neutral' | 'warning' | 'success' | 'danger' {
  if (status === 'LIQUIDADA') return 'success';
  if (status === 'CANCELADA') return 'danger';
  if (status === 'RESERVADA') return 'warning';
  return 'neutral';
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDatePtBr(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export function OffersOperationalPanel({
  offers,
  selectedCompetenceMonth,
  offersRoute = '/ofertas',
}: OffersOperationalPanelProps) {
  const [liquidationWindowDays, setLiquidationWindowDays] = useState<LiquidationWindowDays>(15);

  const pipelineOffers = useMemo(() => {
    return offers
      .map((offer) => {
        const status = normalizeOfferStatus(offer.status, {
          reservaEfetuada: offer.reservaEfetuada,
          reservaLiquidada: offer.reservaLiquidada,
        });
        const competenceMonth = normalizeCompetenceMonth(
          offer.competenceMonth,
          offer.dataReserva || offer.createdAt,
        );
        const { totalAllocated, revenueHouse } = calcOfferReservationTotals(offer);
        return {
          offer,
          status,
          competenceMonth,
          totalAllocated,
          revenueHouse,
        };
      })
      .filter((item) => {
        if (item.competenceMonth !== selectedCompetenceMonth) return false;
        return item.status === 'PENDENTE' || item.status === 'RESERVADA';
      })
      .sort((a, b) => {
        if (b.totalAllocated !== a.totalAllocated) return b.totalAllocated - a.totalAllocated;
        return b.revenueHouse - a.revenueHouse;
      });
  }, [offers, selectedCompetenceMonth]);

  const pipelineTotals = useMemo(() => {
    return pipelineOffers.reduce((acc, item) => {
      acc.totalAllocated += item.totalAllocated;
      acc.totalRevenue += item.revenueHouse;
      return acc;
    }, { totalAllocated: 0, totalRevenue: 0 });
  }, [pipelineOffers]);

  const upcomingLiquidations = useMemo(() => {
    const today = startOfDay(new Date());
    const limit = addDays(today, liquidationWindowDays);
    const items: UpcomingLiquidationItem[] = [];

    for (const offer of offers) {
      const status = normalizeOfferStatus(offer.status, {
        reservaEfetuada: offer.reservaEfetuada,
        reservaLiquidada: offer.reservaLiquidada,
      });
      if (status === 'CANCELADA') continue;

      const liquidationRaw = offer.liquidationDate || offer.dataLiquidacao;
      const liquidationDate = parseDateOnly(liquidationRaw);
      if (!liquidationDate) continue;

      const normalizedDate = startOfDay(liquidationDate);
      if (normalizedDate < today || normalizedDate > limit) continue;

      const { revenueHouse } = calcOfferReservationTotals(offer);
      items.push({
        offer,
        status,
        liquidationDate: normalizedDate,
        revenueHouse,
      });
    }

    return items
      .sort((a, b) => a.liquidationDate.getTime() - b.liquidationDate.getTime())
      .slice(0, 12);
  }, [offers, liquidationWindowDays]);

  const offersRouteWithCompetence = `${offersRoute}?competenceMonth=${encodeURIComponent(selectedCompetenceMonth)}`;

  const handleWindowChange = useCallback((days: LiquidationWindowDays) => {
    setLiquidationWindowDays(days);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8">
        <SectionCard
          title="Pipeline de Ofertas"
          subtitle={`Competência ${formatCompetenceMonthPtBr(selectedCompetenceMonth)}`}
          action={(
            <Link
              to={offersRouteWithCompetence}
              className="text-sm font-medium hover:underline focus-gold"
              style={{ color: 'var(--color-info)' }}
            >
              Ir para Ofertas/Ativos
            </Link>
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pendentes</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{pipelineOffers.length}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Volume total</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(pipelineTotals.totalAllocated)}
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Receita estimada</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(pipelineTotals.totalRevenue)}
              </p>
            </div>
          </div>

          {pipelineOffers.length === 0 ? (
            <InlineEmpty message="Sem ofertas pendentes/reservadas para a competência selecionada." />
          ) : (
            <div className="space-y-2">
              {pipelineOffers.slice(0, 8).map((item) => {
                const roaValue = item.offer.roaPercent ?? 0;
                const roaPercent = roaValue > 1 ? roaValue : roaValue * 100;

                return (
                  <div
                    key={item.offer.id || `${item.offer.nomeAtivo}-${item.offer.createdAt || item.offer.dataReserva || ''}`}
                    className="rounded-lg border p-3"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      borderColor: 'var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                          {item.offer.nomeAtivo}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={getStatusVariant(item.status)}>
                            {getOfferStatusLabel(item.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <p>Alocação: <span className="font-medium">{formatCurrency(item.totalAllocated)}</span></p>
                        <p>Receita: <span className="font-medium">{formatCurrency(item.revenueHouse)}</span></p>
                        <p>ROA: <span className="font-medium">{formatPercent(roaPercent, 2)}</span></p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="lg:col-span-4">
        <SectionCard
          title="Próximas Liquidações"
          subtitle={`Próximos ${liquidationWindowDays} dias`}
          action={(
            <div className="inline-flex rounded-md border" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {[15, 30].map((days) => {
                const selected = liquidationWindowDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleWindowChange(days as LiquidationWindowDays)}
                    aria-pressed={selected}
                    className="px-2.5 py-1 text-xs font-medium focus-gold"
                    style={{
                      backgroundColor: selected ? 'var(--color-info-bg)' : 'transparent',
                      color: selected ? 'var(--color-info)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {days}d
                  </button>
                );
              })}
            </div>
          )}
        >
          {upcomingLiquidations.length === 0 ? (
            <InlineEmpty message="Sem liquidações previstas no período selecionado." />
          ) : (
            <div className="space-y-2">
              {upcomingLiquidations.map((item) => (
                <div
                  key={`${item.offer.id || item.offer.nomeAtivo}-${item.liquidationDate.toISOString()}`}
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    borderColor: 'var(--color-border-subtle)',
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: 'var(--color-info)' }}>
                    {formatDatePtBr(item.liquidationDate)}
                  </p>
                  <p className="text-sm font-medium truncate mt-0.5" style={{ color: 'var(--color-text)' }}>
                    {item.offer.nomeAtivo}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <Badge variant={getStatusVariant(item.status)}>
                      {getOfferStatusLabel(item.status)}
                    </Badge>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatCurrency(item.revenueHouse)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
