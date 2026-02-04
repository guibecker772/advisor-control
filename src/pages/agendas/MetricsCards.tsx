import { Users, Calendar, Repeat, BarChart3 } from 'lucide-react';
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
      {/* Seletor de Período */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Métricas:</span>
        </div>
        
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {periodOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onPeriodChange(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === opt.value
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) => onCustomDateChange({ ...customDateRange, start: e.target.value })}
              className="px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">até</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) => onCustomDateChange({ ...customDateRange, end: e.target.value })}
              className="px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <span className="text-sm text-gray-500">
          {metrics.period.label}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* R1 */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.R1}20` }}
            >
              <Users className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.R1 }} />
            </div>
            <div>
              <p className="text-sm text-gray-500">R1</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.R1 }}>
                {metrics.r1Count}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Primeiras reuniões</p>
        </div>

        {/* R2 */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.R2}20` }}
            >
              <Calendar className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.R2 }} />
            </div>
            <div>
              <p className="text-sm text-gray-500">R2</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.R2 }}>
                {metrics.r2Count}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Segundas reuniões</p>
        </div>

        {/* Áreas Cross */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${MEETING_TYPE_COLORS.areas_cross}20` }}
            >
              <Repeat className="w-5 h-5" style={{ color: MEETING_TYPE_COLORS.areas_cross }} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Áreas Cross</p>
              <p className="text-2xl font-bold" style={{ color: MEETING_TYPE_COLORS.areas_cross }}>
                {metrics.areasCrossCount}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Reuniões de Cross</p>
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.totalMeetings}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Todos os eventos</p>
        </div>
      </div>
    </div>
  );
}
