import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, getNomeMes } from '../../../domain/calculations';
import type { CaptacaoLancamento } from '../../../domain/types';
import { EmptyState, SectionCard } from '../../../components/ui';
import { buildEvolucaoSeries, type EvolucaoPatrimonialPoint } from '../utils/dashboardSeries';

interface EvolucaoPatrimonialChartProps {
  lancamentos: CaptacaoLancamento[];
  mesAtual: number;
  anoAtual: number;
  captacaoRoute?: string;
}

interface TooltipState {
  index: number;
  left: number;
  top: number;
}

const CHART_WIDTH = 980;
const CHART_HEIGHT = 248;
const CHART_TOP = 16;
const CHART_BOTTOM = 34;
const CHART_LEFT = 34;
const CHART_RIGHT = 14;
const GRID_LINES = 4;
const TOOLTIP_WIDTH = 244;
const TOOLTIP_HEIGHT = 132;

export function EvolucaoPatrimonialChart({
  lancamentos,
  mesAtual,
  anoAtual,
  captacaoRoute = '/captacao',
}: EvolucaoPatrimonialChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const series = useMemo<EvolucaoPatrimonialPoint[]>(() => {
    return buildEvolucaoSeries(lancamentos, mesAtual, anoAtual);
  }, [anoAtual, lancamentos, mesAtual]);

  const hasData = useMemo(() => {
    return series.some((item) => item.captacaoLiquida !== 0 || item.transferenciaXp !== 0);
  }, [series]);

  const values = useMemo(
    () => series.flatMap((item) => [item.captacaoLiquidaAcumulada, item.transferenciaXpAcumulada]),
    [series],
  );

  const hasNegative = values.some((value) => value < 0);
  const maxPositive = values.reduce((acc, value) => Math.max(acc, value), 0);
  const maxNegativeAbs = Math.abs(values.reduce((acc, value) => Math.min(acc, value), 0));

  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const baselineY = hasNegative
    ? CHART_TOP + plotHeight / 2
    : CHART_TOP + plotHeight - 6;
  const maxAmplitude = hasNegative
    ? (plotHeight / 2) - 8
    : plotHeight - 14;
  const scaleDenominator = hasNegative
    ? Math.max(maxPositive, maxNegativeAbs)
    : Math.max(maxPositive, 0);

  const pointCount = Math.max(series.length - 1, 1);
  const pointGap = plotWidth / pointCount;
  const interactionWidth = Math.max(12, pointGap);

  const getPointX = (index: number): number => CHART_LEFT + (pointGap * index);

  const getPointY = (value: number): number => {
    if (scaleDenominator <= 0) return baselineY;
    const scaled = (Math.abs(value) / scaleDenominator) * maxAmplitude;
    if (!hasNegative || value >= 0) {
      return baselineY - scaled;
    }
    return baselineY + scaled;
  };

  const buildPolyline = (
    key: 'captacaoLiquidaAcumulada' | 'transferenciaXpAcumulada',
  ): string => {
    return series
      .map((item, index) => `${getPointX(index)},${getPointY(item[key])}`)
      .join(' ');
  };

  const captacaoPolyline = buildPolyline('captacaoLiquidaAcumulada');
  const transferenciaPolyline = buildPolyline('transferenciaXpAcumulada');

  const handlePointHover = useCallback((index: number, event: ReactMouseEvent<SVGRectElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const rawLeft = event.clientX - rect.left + 8;
    const rawTop = event.clientY - rect.top - 10;
    const maxLeft = Math.max(8, container.clientWidth - TOOLTIP_WIDTH - 8);
    const maxTop = Math.max(8, container.clientHeight - TOOLTIP_HEIGHT - 8);

    setTooltip({
      index,
      left: Math.min(Math.max(rawLeft, 8), maxLeft),
      top: Math.min(Math.max(rawTop, 8), maxTop),
    });
  }, []);

  const tooltipItem = tooltip ? series[tooltip.index] : null;

  return (
    <SectionCard
      title="Evolução Patrimonial"
      subtitle={`Acumulado diário de ${getNomeMes(mesAtual)} ${anoAtual}`}
    >
      {!hasData ? (
        <EmptyState
          title="Sem dados de captação"
          description="Registre lançamentos em Captação para ver a evolução mensal."
          action={(
            <Link
              to={captacaoRoute}
              className="rounded-lg px-4 py-2 text-sm font-medium focus-gold"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              Registrar lançamento
            </Link>
          )}
        />
      ) : (
        <div ref={containerRef} className="relative">
          <svg
            className="h-[248px] w-full"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Gráfico de evolução patrimonial"
          >
            {Array.from({ length: GRID_LINES + 1 }, (_, index) => {
              const y = CHART_TOP + (plotHeight / GRID_LINES) * index;
              return (
                <line
                  key={`grid-${index}`}
                  x1={CHART_LEFT}
                  y1={y}
                  x2={CHART_WIDTH - CHART_RIGHT}
                  y2={y}
                  stroke="var(--color-border-subtle)"
                  strokeDasharray="4 6"
                  strokeWidth="1"
                  opacity={0.42}
                />
              );
            })}

            <line
              x1={CHART_LEFT}
              y1={baselineY}
              x2={CHART_WIDTH - CHART_RIGHT}
              y2={baselineY}
              stroke="var(--color-border-subtle)"
              strokeWidth="1"
            />

            <polyline
              points={captacaoPolyline}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={transferenciaPolyline}
              fill="none"
              stroke="var(--chart-5)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {series.map((item, index) => {
              const x = getPointX(index);
              const captacaoY = getPointY(item.captacaoLiquidaAcumulada);
              const transferenciaY = getPointY(item.transferenciaXpAcumulada);
              const isMilestone = item.dia === 1 || item.dia === series.length || item.dia % 5 === 0;

              return (
                <g key={`day-${item.dia}`}>
                  <rect
                    x={x - (interactionWidth / 2)}
                    y={CHART_TOP}
                    width={interactionWidth}
                    height={plotHeight}
                    fill="transparent"
                    onMouseMove={(event) => handlePointHover(index, event)}
                    onMouseEnter={(event) => handlePointHover(index, event)}
                    onMouseLeave={() => setTooltip(null)}
                  />

                  <circle cx={x} cy={captacaoY} r={2.8} fill="var(--chart-1)" />
                  <circle cx={x} cy={transferenciaY} r={2.8} fill="var(--chart-5)" />

                  {isMilestone && (
                    <text
                      x={x}
                      y={CHART_HEIGHT - 10}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-text-secondary)"
                    >
                      {item.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {tooltip && tooltipItem && (
            <div
              className="pointer-events-none absolute rounded-lg border p-3 text-xs shadow-lg"
              style={{
                left: tooltip.left,
                top: tooltip.top,
                width: TOOLTIP_WIDTH,
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <p className="mb-2 font-semibold">
                Dia {tooltipItem.label}/{String(mesAtual).padStart(2, '0')}
              </p>
              <div className="space-y-1.5">
                <p className="flex items-center justify-between gap-2">
                  <span>Captação diária</span>
                  <span style={{ color: tooltipItem.captacaoLiquida >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.captacaoLiquida)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Captação acumulada</span>
                  <span style={{ color: tooltipItem.captacaoLiquidaAcumulada >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.captacaoLiquidaAcumulada)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Transferência XP diária</span>
                  <span style={{ color: tooltipItem.transferenciaXp >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.transferenciaXp)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Transferência XP acumulada</span>
                  <span style={{ color: tooltipItem.transferenciaXpAcumulada >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.transferenciaXpAcumulada)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />
              Captação líquida acumulada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-5)' }} />
              Transferência XP acumulada
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
