import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { formatCurrency, getNomeMes } from '../../../domain/calculations';
import type { CaptacaoLancamento } from '../../../domain/types';
import { EmptyState, SectionCard, SegmentedControl } from '../../../components/ui';
import { buildEvolucaoSeries, type EvolucaoPatrimonialPoint } from '../utils/dashboardSeries';

interface EvolucaoPatrimonialChartProps {
  lancamentos: CaptacaoLancamento[];
  anoAtual: number;
  defaultRange?: 6 | 12;
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
const CHART_LEFT = 20;
const CHART_RIGHT = 14;
const GRID_LINES = 4;
const TOOLTIP_WIDTH = 232;
const TOOLTIP_HEIGHT = 104;
const RANGE_OPTIONS = [
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
] as const;

export function EvolucaoPatrimonialChart({
  lancamentos,
  anoAtual,
  defaultRange = 6,
  captacaoRoute = '/captacao',
}: EvolucaoPatrimonialChartProps) {
  const [range, setRange] = useState<6 | 12>(defaultRange);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const months = useMemo(() => {
    const monthLimit = range === 6 ? 6 : 12;
    const shortYear = String(anoAtual).slice(-2);

    return Array.from({ length: monthLimit }, (_, index) => {
      const mes = index + 1;
      return {
        mes,
        ano: anoAtual,
        label: `${getNomeMes(mes).slice(0, 3)}/${shortYear}`,
      };
    });
  }, [anoAtual, range]);

  const series = useMemo<EvolucaoPatrimonialPoint[]>(() => {
    return buildEvolucaoSeries(lancamentos, months);
  }, [lancamentos, months]);

  const values = useMemo(
    () => series.flatMap((item) => [item.captacaoLiquida, item.transferenciaXp]),
    [series],
  );

  const maxAbs = useMemo(() => {
    return values.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
  }, [values]);

  const hasData = maxAbs > 0;
  const hasNegative = values.some((value) => value < 0);
  const maxPositive = values.reduce((acc, value) => Math.max(acc, value), 0);
  const maxNegativeAbs = Math.abs(values.reduce((acc, value) => Math.min(acc, value), 0));

  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const baselineY = hasNegative
    ? CHART_TOP + plotHeight / 2
    : CHART_TOP + plotHeight - 6;
  const maxBarHeight = hasNegative
    ? (plotHeight / 2) - 8
    : plotHeight - 14;
  const scaleDenominator = hasNegative
    ? Math.max(maxPositive, maxNegativeAbs)
    : Math.max(maxPositive, 0);

  const groupWidth = plotWidth / Math.max(series.length, 1);
  const barWidth = Math.min(18, Math.max(10, groupWidth * 0.2));
  const barGap = Math.max(4, groupWidth * 0.08);

  const getBarHeight = (value: number): number => {
    if (scaleDenominator <= 0) return 0;
    return (Math.abs(value) / scaleDenominator) * maxBarHeight;
  };

  const getBarY = (value: number, height: number): number => {
    if (!hasNegative) return baselineY - height;
    if (value >= 0) return baselineY - height;
    return baselineY;
  };

  const handleGroupHover = useCallback((index: number, event: ReactMouseEvent<SVGGElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const rawLeft = event.clientX - rect.left + 10;
    const rawTop = event.clientY - rect.top - 12;
    const maxLeft = Math.max(8, container.clientWidth - TOOLTIP_WIDTH - 8);
    const maxTop = Math.max(8, container.clientHeight - TOOLTIP_HEIGHT - 8);

    setTooltip({
      index,
      left: Math.min(Math.max(rawLeft, 8), maxLeft),
      top: Math.min(Math.max(rawTop, 8), maxTop),
    });
  }, []);

  const tooltipItem = tooltip ? series[tooltip.index] : null;

  const handleRangeChange = useCallback((nextValue: string) => {
    setRange(nextValue === '12' ? 12 : 6);
  }, []);

  return (
    <SectionCard
      title="Evolução Patrimonial"
      subtitle="Captação líquida e transferência XP por mês"
      action={(
        <SegmentedControl
          options={RANGE_OPTIONS}
          value={String(range)}
          onChange={handleRangeChange}
          size="sm"
          className="w-auto"
        />
      )}
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

            {series.map((item, index) => {
              const groupStart = CHART_LEFT + (index * groupWidth);
              const center = groupStart + (groupWidth / 2);
              const captacaoHeight = getBarHeight(item.captacaoLiquida);
              const transferenciaHeight = getBarHeight(item.transferenciaXp);
              const captacaoX = center - (barGap / 2) - barWidth;
              const transferenciaX = center + (barGap / 2);

              return (
                <g
                  key={`${item.ano}-${item.mes}`}
                  onMouseMove={(event) => handleGroupHover(index, event)}
                  onMouseEnter={(event) => handleGroupHover(index, event)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <rect
                    x={groupStart + 4}
                    y={CHART_TOP + 4}
                    width={Math.max(0, groupWidth - 8)}
                    height={Math.max(0, plotHeight - 8)}
                    rx={8}
                    fill="var(--color-surface-2)"
                    opacity={0.38}
                  />

                  <rect
                    x={captacaoX}
                    y={getBarY(item.captacaoLiquida, captacaoHeight)}
                    width={barWidth}
                    height={captacaoHeight}
                    rx={4}
                    fill="var(--chart-1)"
                  />

                  <rect
                    x={transferenciaX}
                    y={getBarY(item.transferenciaXp, transferenciaHeight)}
                    width={barWidth}
                    height={transferenciaHeight}
                    rx={4}
                    fill="var(--chart-5)"
                  />

                  <text
                    x={center}
                    y={CHART_HEIGHT - 10}
                    textAnchor="middle"
                    fontSize="11.5"
                    fill="var(--color-text-secondary)"
                  >
                    {item.label}
                  </text>
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
              <p className="mb-2 font-semibold">{tooltipItem.label}</p>
              <div className="space-y-1">
                <p className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--chart-1)' }} />
                    Captação
                  </span>
                  <span style={{ color: tooltipItem.captacaoLiquida >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.captacaoLiquida)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--chart-5)' }} />
                    Transferência XP
                  </span>
                  <span style={{ color: tooltipItem.transferenciaXp >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(tooltipItem.transferenciaXp)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
              Captação líquida
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-5)' }} />
              Transferência XP
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
