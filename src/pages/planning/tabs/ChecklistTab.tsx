import { SectionCard, BaseCard, PageSkeleton } from '../../../components/ui';
import { useChecklistPlanning } from '../../../hooks/useChecklistPlanning';
import { CheckSquare, Square, CalendarRange, CalendarDays } from 'lucide-react';

export default function ChecklistTab() {
  const {
    weeklyChecklist,
    monthlyChecklist,
    loading,
    currentWeekKey,
    currentMonthKey,
    toggleWeeklyItem,
    toggleMonthlyItem,
    weeklyProgress,
    monthlyProgress,
  } = useChecklistPlanning();

  if (loading) {
    return <PageSkeleton showKpis={false} rows={3} />;
  }

  return (
    <div className="space-y-6">
      {/* Progress summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProgressCard
          title="Checklist Semanal"
          subtitle={`Semana ${currentWeekKey}`}
          progress={weeklyProgress}
          icon={<CalendarRange className="w-5 h-5" />}
          total={weeklyChecklist?.items.length ?? 0}
          checked={weeklyChecklist?.items.filter((i) => i.checked).length ?? 0}
        />
        <ProgressCard
          title="Checklist Mensal"
          subtitle={currentMonthKey}
          progress={monthlyProgress}
          icon={<CalendarDays className="w-5 h-5" />}
          total={monthlyChecklist?.items.length ?? 0}
          checked={monthlyChecklist?.items.filter((i) => i.checked).length ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly checklist */}
        <SectionCard
          title="Checklist Semanal"
          subtitle="Itens de revisão para a semana corrente"
        >
          {weeklyChecklist?.items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum item configurado.
            </p>
          ) : (
            <div className="space-y-1">
              {weeklyChecklist?.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleWeeklyItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                    hover:bg-[var(--color-surface-2)] text-left"
                >
                  {item.checked ? (
                    <CheckSquare
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: 'var(--color-success)' }}
                    />
                  ) : (
                    <Square
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: item.checked ? 'var(--color-text-muted)' : 'var(--color-text)',
                      textDecoration: item.checked ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Monthly checklist */}
        <SectionCard
          title="Checklist Mensal"
          subtitle="Itens de revisão para o mês corrente"
        >
          {monthlyChecklist?.items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum item configurado.
            </p>
          ) : (
            <div className="space-y-1">
              {monthlyChecklist?.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleMonthlyItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                    hover:bg-[var(--color-surface-2)] text-left"
                >
                  {item.checked ? (
                    <CheckSquare
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: 'var(--color-success)' }}
                    />
                  ) : (
                    <Square
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: item.checked ? 'var(--color-text-muted)' : 'var(--color-text)',
                      textDecoration: item.checked ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ProgressCard({
  title,
  subtitle,
  progress,
  icon,
  total,
  checked,
}: {
  title: string;
  subtitle: string;
  progress: number;
  icon: React.ReactNode;
  total: number;
  checked: number;
}) {
  return (
    <BaseCard padding="lg">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-gold)' }}
          >
            {title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
          <p
            className="text-2xl font-bold mt-2"
            style={{
              color: progress >= 100
                ? 'var(--color-success)'
                : progress >= 50
                  ? 'var(--color-gold)'
                  : 'var(--color-text)',
            }}
          >
            {checked}/{total}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: 'var(--color-gold-bg)',
            color: 'var(--color-gold)',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Progresso
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              color: progress >= 100
                ? 'var(--color-success)'
                : progress >= 50
                  ? 'var(--color-gold)'
                  : 'var(--color-warning)',
            }}
          >
            {progress}%
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--color-surface-3)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, progress)}%`,
              backgroundColor: progress >= 100
                ? 'var(--color-success)'
                : progress >= 50
                  ? 'var(--color-gold)'
                  : 'var(--color-warning)',
            }}
          />
        </div>
      </div>
    </BaseCard>
  );
}
