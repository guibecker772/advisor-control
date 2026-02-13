import { Users, Calendar, Repeat, BarChart3, UserCheck } from 'lucide-react';
import type { CalendarMetrics, MetricsPeriod } from '../../domain/types/calendar';
import { MEETING_TYPE_COLORS } from '../../domain/types/calendar';

interface MetricsCardsProps {
  metrics: CalendarMetrics;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
  customDateRange: { start: string; end: string };
  onCustomDateChange: (range: { start: string; end: string }) => void;
}

export default function MetricsCards({
  metrics,
  period,
  onPeriodChange,
  customDateRange,
  onCustomDateChange,
}: MetricsCardsProps) {
  const periodOptions: { value: MetricsPeriod; label: string }[] = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
    { value: 'year', label: 'Ano' },
    { value: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Métricas:</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          {periodOptions.map((opt) => {
            const isActive = period === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onPeriodChange(opt.value)}
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--color-gold-bg)' : 'transparent',
                  color: isActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(event) => onCustomDateChange({ ...customDateRange, start: event.target.value })}
              className="px-2 py-1 text-sm rounded-lg focus-gold"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            <span style={{ color: 'var(--color-text-muted)' }}>até</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(event) => onCustomDateChange({ ...customDateRange, end: event.target.value })}
              className="px-2 py-1 text-sm rounded-lg focus-gold"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
        )}

        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {metrics.period.label}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.R1}20` }}
            >
              <Users className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.R1 }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>R1</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.R1 }}>
                {metrics.r1Count}
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Primeiras reuniões</p>
        </div>

        <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.R2}20` }}
            >
              <Calendar className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.R2 }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>R2</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.R2 }}>
                {metrics.r2Count}
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Segundas reuniões</p>
        </div>

        <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.acompanhamento}20` }}
            >
              <UserCheck className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.acompanhamento }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Acompanhamento</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.acompanhamento }}>
                {metrics.acompanhamentoCount}
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Reuniões de acompanhamento</p>
        </div>

        <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.areas_cross}20` }}
            >
              <Repeat className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.areas_cross }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Áreas Cross</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.areas_cross }}>
                {metrics.areasCrossCount}
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Reuniões de Cross</p>
        </div>

        <div className="rounded-xl shadow-sm p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                {metrics.totalMeetings}
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Todos os eventos</p>
        </div>
      </div>
    </div>
  );
}
