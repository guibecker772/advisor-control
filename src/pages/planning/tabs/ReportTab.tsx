import {
  BarChart3,
  CheckCircle2,
  Clock,
  Crosshair,
  Phone,
  Users,
  Target,
  CalendarCheck,
  Download,
  Copy,
  TrendingUp,
  AlertTriangle,
  Layers,
  ClipboardCheck,
} from 'lucide-react';
import { BaseCard, SectionHeader, Badge, SegmentedControl } from '../../../components/ui';
import { useReport } from '../../../hooks/useReport';
import type { ReportMetrics, TaskBreakdown, BlockBreakdown } from '../../../domain/planning/reportMetrics';
import { reportToText } from '../../../domain/planning/reportMetrics';
import { formatDuration } from '../../../domain/planning/planningUtils';
import type { usePlanning } from '../../../hooks/usePlanning';

interface ReportTabProps {
  planning: ReturnType<typeof usePlanning>;
}

const PERIOD_OPTIONS = [
  { value: 'week' as const, label: 'Semanal' },
  { value: 'month' as const, label: 'Mensal' },
];

// ==========================================
// Sub-components
// ==========================================

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'gold',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'gold' | 'green' | 'red' | 'blue' | 'muted';
}) {
  const colorMap = {
    gold: 'var(--color-gold)',
    green: 'var(--color-success)',
    red: 'var(--color-danger)',
    blue: 'var(--color-info)',
    muted: 'var(--color-text-muted)',
  };

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{ background: 'var(--color-surface-alt)' }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: `${colorMap[color]}15`, color: colorMap[color] }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, label, count }: { value: number; label: string; count?: string }) {
  const barColor =
    value >= 100 ? 'var(--color-success)' :
    value >= 50 ? 'var(--color-gold)' :
    'var(--color-danger)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{count ?? `${value}%`}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function TaskBreakdownTable({ items }: { items: TaskBreakdown[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--color-surface-alt)' }}>
            <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Tipo</th>
            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Total</th>
            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Concluídas</th>
            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Pendentes</th>
            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Taxa</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const rate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
            return (
              <tr
                key={item.type}
                className="border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{item.label}</td>
                <td className="px-3 py-2 text-center" style={{ color: 'var(--color-text-secondary)' }}>{item.total}</td>
                <td className="px-3 py-2 text-center" style={{ color: 'var(--color-success)' }}>{item.completed}</td>
                <td className="px-3 py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>{item.pending}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}>{rate}%</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BlockBreakdownList({ items, totalMinutes }: { items: BlockBreakdown[]; totalMinutes: number }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = totalMinutes > 0 ? Math.round((item.totalMinutes / totalMinutes) * 100) : 0;
        return (
          <div key={item.category} className="flex items-center gap-3">
            <span className="w-28 flex-shrink-0 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {item.label}
            </span>
            <div className="flex-1">
              <div className="h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${pct}%`, background: 'var(--color-gold)' }}
                />
              </div>
            </div>
            <span className="w-20 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {item.count}x · {formatDuration(item.totalMinutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ snapshots }: { snapshots: ReportMetrics['dailySnapshots'] }) {
  if (snapshots.length === 0) return null;

  const max = Math.max(...snapshots.map((s) => s.completed + s.pending), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 80 }}>
      {snapshots.map((s) => {
        const completedH = (s.completed / max) * 100;
        const pendingH = (s.pending / max) * 100;
        const day = new Date(s.date + 'T00:00:00');
        const dow = day.getDay();
        if (dow === 0 || dow === 6) return null;

        const dayLabel = ['', 'S', 'T', 'Q', 'Q', 'S', ''][dow];

        return (
          <div key={s.date} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex w-full flex-col items-stretch" style={{ height: 60 }}>
              <div className="flex-1" />
              {s.pending > 0 && (
                <div
                  className="rounded-t"
                  style={{ height: `${pendingH}%`, background: 'var(--color-text-muted)', opacity: 0.3 }}
                />
              )}
              {s.completed > 0 && (
                <div
                  className="rounded-t"
                  style={{ height: `${completedH}%`, background: 'var(--color-gold)' }}
                />
              )}
            </div>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// Main component
// ==========================================

export default function ReportTab({ planning }: ReportTabProps) {
  const { period, setPeriod, metrics, loading } = useReport(planning.tasks, planning.blocks);

  const handleCopy = () => {
    if (!metrics) return;
    navigator.clipboard.writeText(reportToText(metrics));
  };

  const handleDownload = () => {
    if (!metrics) return;
    const text = reportToText(metrics);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${metrics.periodKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando relatório...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header com controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {metrics.periodLabel}
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {metrics.periodRange}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(v) => setPeriod(v as 'week' | 'month')}
          />
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            title="Copiar relatório"
          >
            <Copy className="h-4 w-4" />
            Copiar
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            title="Baixar relatório"
          >
            <Download className="h-4 w-4" />
            Baixar
          </button>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={CheckCircle2}
          label="Taxa de Conclusão"
          value={`${metrics.completionRate}%`}
          subtitle={`${metrics.completedTasks}/${metrics.totalTasks}`}
          color={metrics.completionRate >= 80 ? 'green' : metrics.completionRate >= 50 ? 'gold' : 'red'}
        />
        <MetricCard
          icon={Users}
          label="Reuniões"
          value={`${metrics.completedMeetings}/${metrics.totalMeetings}`}
          color="blue"
        />
        <MetricCard
          icon={Phone}
          label="Ligações"
          value={`${metrics.completedCalls}/${metrics.totalCalls}`}
          color="blue"
        />
        <MetricCard
          icon={Target}
          label="Follow-ups"
          value={`${metrics.followUpsDone}/${metrics.followUpsTotal}`}
          color={metrics.followUpsDone >= metrics.followUpsTotal && metrics.followUpsTotal > 0 ? 'green' : 'gold'}
        />
        <MetricCard
          icon={TrendingUp}
          label="Prospecção"
          value={`${metrics.prospectingDone}/${metrics.prospectingTotal}`}
          color={metrics.prospectingDone >= metrics.prospectingTotal && metrics.prospectingTotal > 0 ? 'green' : 'gold'}
        />
      </div>

      {/* Pendências / Alertas */}
      {(metrics.pendingTasks > 0 || metrics.postponedTasks > 0 || metrics.overdueCount > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard icon={Clock} label="Pendentes" value={metrics.pendingTasks} color="muted" />
          <MetricCard
            icon={AlertTriangle}
            label="Adiadas"
            value={metrics.postponedTasks}
            color={metrics.postponedTasks > 0 ? 'red' : 'muted'}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Atrasadas (geral)"
            value={metrics.overdueCount}
            color={metrics.overdueCount > 0 ? 'red' : 'muted'}
          />
        </div>
      )}

      {/* Gráfico diário + Disciplina */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BaseCard>
          <SectionHeader title="Execução Diária" icon={BarChart3} />
          <div className="mt-3">
            <DailyChart snapshots={metrics.dailySnapshots} />
            <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
                Concluídas
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--color-text-muted)', opacity: 0.3 }} />
                Pendentes
              </span>
            </div>
          </div>
        </BaseCard>

        <BaseCard>
          <SectionHeader title="Disciplina" icon={ClipboardCheck} />
          <div className="mt-3 space-y-3">
            <ProgressBar
              label="Reviews diários"
              value={metrics.reviewDays > 0 ? Math.round((metrics.reviewsDone / metrics.reviewDays) * 100) : 0}
              count={`${metrics.reviewsDone}/${metrics.reviewDays}`}
            />
            <ProgressBar
              label="Checklist"
              value={metrics.checklistProgress}
              count={`${metrics.checklistDone}/${metrics.checklistTotal}`}
            />
            <ProgressBar
              label="Follow-ups"
              value={metrics.followUpsTotal > 0 ? Math.round((metrics.followUpsDone / metrics.followUpsTotal) * 100) : 0}
              count={`${metrics.followUpsDone}/${metrics.followUpsTotal}`}
            />
            <ProgressBar
              label="Prospecção"
              value={metrics.prospectingTotal > 0 ? Math.round((metrics.prospectingDone / metrics.prospectingTotal) * 100) : 0}
              count={`${metrics.prospectingDone}/${metrics.prospectingTotal}`}
            />
          </div>
        </BaseCard>
      </div>

      {/* Tarefas por tipo */}
      <BaseCard>
        <SectionHeader title="Tarefas por Tipo" icon={Layers} />
        <div className="mt-3">
          <TaskBreakdownTable items={metrics.taskBreakdown} />
        </div>
      </BaseCard>

      {/* Blocos de tempo */}
      {metrics.totalBlocks > 0 && (
        <BaseCard>
          <SectionHeader title="Blocos de Tempo" icon={CalendarCheck} subtitle={`${metrics.totalBlocks} blocos · ${formatDuration(metrics.totalBlockMinutes)}`} />
          <div className="mt-3">
            <BlockBreakdownList items={metrics.blockBreakdown} totalMinutes={metrics.totalBlockMinutes} />
          </div>
        </BaseCard>
      )}

      {/* Modo Foco */}
      {metrics.focus && metrics.focus.totalSessions > 0 && (
        <BaseCard>
          <SectionHeader
            title="Modo Foco"
            icon={Crosshair}
            subtitle={`${metrics.focus.totalSessions} ${metrics.focus.totalSessions === 1 ? 'sessão' : 'sessões'} · ${formatDuration(metrics.focus.totalMinutes)}`}
          />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricCard
              icon={Crosshair}
              label="Sessões"
              value={`${metrics.focus.completedSessions}/${metrics.focus.totalSessions}`}
              color="gold"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Taxa de Conclusão"
              value={`${metrics.focus.completionRate}%`}
              color={metrics.focus.completionRate >= 80 ? 'green' : metrics.focus.completionRate >= 50 ? 'gold' : 'red'}
            />
            <MetricCard
              icon={Clock}
              label="Tempo Focado"
              value={formatDuration(metrics.focus.totalMinutes)}
              color="blue"
            />
          </div>
          {metrics.focus.categoryBreakdown.length > 0 && (
            <div className="mt-3 space-y-2">
              {metrics.focus.categoryBreakdown.map((cat) => {
                const pct = metrics.focus!.totalMinutes > 0
                  ? Math.round((cat.totalMinutes / metrics.focus!.totalMinutes) * 100)
                  : 0;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.category}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${pct}%`, background: 'var(--color-gold)' }}
                        />
                      </div>
                    </div>
                    <span className="w-20 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {cat.sessionCount}x · {formatDuration(cat.totalMinutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Weekly / daily focus consistency */}
          {metrics.focus.dailyBreakdown.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Consistência diária
              </p>
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {(() => {
                  const maxMin = Math.max(...metrics.focus!.dailyBreakdown.map(d => d.totalMinutes), 1);
                  return metrics.focus!.dailyBreakdown.map(day => {
                    const pct = (day.totalMinutes / maxMin) * 100;
                    const isToday = day.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center justify-end gap-0.5"
                        style={{ height: '100%' }}
                        title={`${day.dayLabel}: ${day.totalMinutes}min · ${day.sessionCount} ${day.sessionCount === 1 ? 'sessão' : 'sessões'}`}
                      >
                        {day.totalMinutes > 0 && (
                          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                            {day.totalMinutes}
                          </span>
                        )}
                        <div
                          className="w-full rounded-sm transition-all"
                          style={{
                            height: day.totalMinutes > 0 ? `${Math.max(pct, 8)}%` : '3px',
                            background: day.totalMinutes > 0
                              ? isToday ? 'var(--color-accent)' : 'var(--color-gold)'
                              : 'var(--color-border)',
                            opacity: day.totalMinutes > 0 ? 1 : 0.4,
                          }}
                        />
                        <span
                          className="text-[10px]"
                          style={{
                            color: isToday ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            fontWeight: isToday ? 600 : 400,
                          }}
                        >
                          {day.dayLabel}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </BaseCard>
      )}
    </div>
  );
}
