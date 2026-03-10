import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { usePlanning } from '../../../hooks/usePlanning';
import { useMonthlyPlanning } from '../../../hooks/useMonthlyPlanning';
import { SectionCard, KpiCard, Badge, Button } from '../../../components/ui';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListTodo,
  ArrowUpRight,
  Target,
  Clock,
  AlertTriangle,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  formatDateDayMonth,
  todayString,
} from '../../../domain/planning/planningUtils';
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_BADGE_VARIANT,
  LINKED_ENTITY_LABELS,
} from '../../../domain/planning/planningConstants';
import type { PlanningTask } from '../../../domain/planning/planningTypes';
import { getEntityRoute } from '../../../domain/planning/planningIntegration';
import TaskDrawer from '../../../components/planning/TaskDrawer';
import TaskFormModal from '../../../components/planning/TaskFormModal';

type PlanningReturn = ReturnType<typeof usePlanning>;

interface MonthTabProps {
  planning: PlanningReturn;
}

export default function MonthTab({ planning }: MonthTabProps) {
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = useState(0);
  const referenceDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const {
    firstDayOfWeek,
    monthTasks,
    pendingMonthTasks,
    followUpsOpen,
    monthDays,
    weeksRemaining,
    milestones,
    monthFocus,
    monthAttentions,
  } = useMonthlyPlanning(planning.tasks, planning.blocks, referenceDate);

  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);

  const today = todayString();
  const monthLabel = format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR });

  // Build calendar grid (6 rows x 7 cols)
  const calendarCells = useMemo(() => {
    const cells: (typeof monthDays[0] | null)[] = [];
    const adjustedFirst = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = 0; i < adjustedFirst; i++) cells.push(null);
    for (const day of monthDays) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayOfWeek, monthDays]);

  const dayTasks = useMemo(() => {
    if (!selectedDay) return [];
    return monthTasks.filter((t) => t.date === selectedDay);
  }, [selectedDay, monthTasks]);

  const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonthOffset((p) => p - 1)}
          className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-lg font-semibold capitalize min-w-[200px] text-center" style={{ color: 'var(--color-text)' }}>
          {monthLabel}
        </p>
        <button
          onClick={() => setMonthOffset((p) => p + 1)}
          className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {monthOffset !== 0 && (
          <button
            onClick={() => setMonthOffset(0)}
            className="px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Mês atual
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          title="Tarefas no Mês"
          value={monthTasks.length}
          icon={<ListTodo className="w-5 h-5" />}
          accentColor="gold"
        />
        <KpiCard
          title="Pendentes"
          value={pendingMonthTasks.length}
          icon={<Clock className="w-5 h-5" />}
          accentColor={pendingMonthTasks.length > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          title="Follow-ups Abertos"
          value={followUpsOpen.length}
          icon={<ArrowUpRight className="w-5 h-5" />}
          accentColor={followUpsOpen.length > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          title="Semanas Restantes"
          value={weeksRemaining}
          icon={<CalendarDays className="w-5 h-5" />}
          accentColor="info"
        />
        <KpiCard
          title="Marcos do Mês"
          value={milestones.length}
          icon={<Target className="w-5 h-5" />}
          accentColor="gold"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid (2/3) */}
        <div className="xl:col-span-2">
          <SectionCard title="Calendário" subtitle="Clique em um dia para ver os detalhes">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-xs font-semibold uppercase py-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }
                const isToday = cell.dateString === today;
                const isSelected = cell.dateString === selectedDay;
                const intensity =
                  cell.taskCount >= 5
                    ? 'high'
                    : cell.taskCount >= 3
                      ? 'medium'
                      : cell.taskCount > 0
                        ? 'low'
                        : 'none';

                return (
                  <button
                    key={cell.dateString}
                    onClick={() => setSelectedDay(cell.dateString === selectedDay ? null : cell.dateString)}
                    className="aspect-square rounded-lg p-1 flex flex-col items-center justify-center transition-all relative"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-gold-bg)'
                        : intensity === 'high'
                          ? 'var(--color-danger-bg)'
                          : intensity === 'medium'
                            ? 'var(--color-warning-bg)'
                            : intensity === 'low'
                              ? 'var(--color-surface-2)'
                              : 'transparent',
                      border: isToday
                        ? '2px solid var(--color-gold)'
                        : isSelected
                          ? '2px solid var(--color-gold)'
                          : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{ color: isToday ? 'var(--color-gold)' : 'var(--color-text)' }}
                    >
                      {cell.day}
                    </span>
                    {cell.taskCount > 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {cell.taskCount}
                      </span>
                    )}
                    {/* Indicator dots */}
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      {cell.hasMaxPriority && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--color-danger)' }}
                          title="Prioridade máxima"
                        />
                      )}
                      {cell.hasFollowUp && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--color-warning)' }}
                          title="Follow-up"
                        />
                      )}
                      {cell.isMilestone && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--color-gold)' }}
                          title="Marco"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected day details */}
            {selectedDay && (
              <div
                className="mt-4 pt-4 border-t"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  {formatDateDayMonth(selectedDay)} — {dayTasks.length} tarefa(s)
                </p>
                {dayTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <CalendarDays className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Nenhuma tarefa neste dia
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                      className="mt-2"
                    >
                      Agendar Tarefa
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full text-left rounded-lg p-3 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                          <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                            {task.title}
                          </span>
                          {task.startTime && (
                            <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                              {task.startTime}
                            </span>
                          )}
                        </div>
                        {(task.linkedEntityName || task.type !== 'general') && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              {TASK_TYPE_LABELS[task.type]}
                            </span>
                            {task.linkedEntityName && task.linkedEntityType !== 'none' && (
                              <button
                                className="text-xs inline-flex items-center gap-1 hover:underline"
                                style={{ color: 'var(--color-gold)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const route = getEntityRoute(task.linkedEntityType, task.linkedEntityId);
                                  if (route) navigate(route);
                                }}
                                title={`Abrir ${task.linkedEntityName}`}
                              >
                                {LINKED_ENTITY_LABELS[task.linkedEntityType]} — {task.linkedEntityName}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Foco do Mês */}
          <SectionCard title="Foco do Mês" subtitle="Visão estratégica">
            <div className="space-y-3 py-1">
              <FocusRow label="Estratégicas abertas" value={monthFocus.strategicOpen} color={monthFocus.strategicOpen > 0 ? 'var(--color-warning)' : 'var(--color-success)'} />
              <FocusRow label="Follow-ups em aberto" value={monthFocus.followUpsOpen} color={monthFocus.followUpsOpen > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
              <FocusRow label="Marcos no mês" value={monthFocus.milestoneCount} color="var(--color-gold)" />
              <FocusRow label="Semanas restantes" value={monthFocus.weeksRemaining} color="var(--color-info)" />
              {monthFocus.linkedEntities.length > 0 && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Entidades prioritárias
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {monthFocus.linkedEntities.map((name) => (
                      <span
                        key={name}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-gold-bg)', color: 'var(--color-gold)' }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Atenções do Mês */}
          {monthAttentions.length > 0 && (
            <SectionCard title="Atenções do Mês" subtitle="Pontos que exigem cuidado">
              <div className="space-y-2">
                {monthAttentions.map((att) => (
                  <div
                    key={att.id}
                    className="rounded-lg p-3 flex items-start gap-3"
                    style={{
                      backgroundColor: att.severity === 'high' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                      border: `1px solid ${att.severity === 'high' ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                    }}
                  >
                    <AlertTriangle
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: att.severity === 'high' ? 'var(--color-danger)' : 'var(--color-warning)' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{
                        color: att.severity === 'high' ? 'var(--color-danger)' : 'var(--color-warning)',
                      }}>
                        {att.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {att.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Marcos do Mês */}
          <SectionCard title="Marcos do Mês" subtitle="Itens estratégicos e importantes">
            {milestones.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Nenhum marco registrado
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Marcos são reuniões ou tarefas de alta prioridade que definem o mês.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                >
                  Nova Tarefa Estratégica
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {milestones.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left rounded-lg p-3 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <span className="text-xs truncate" style={{ color: 'var(--color-text)' }}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDateDayMonth(task.date)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {TASK_TYPE_LABELS[task.type]}
                      </span>
                      {task.linkedEntityName && task.linkedEntityType !== 'none' && (
                        <button
                          className="text-xs inline-flex items-center gap-0.5 hover:underline"
                          style={{ color: 'var(--color-gold)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const route = getEntityRoute(task.linkedEntityType, task.linkedEntityId);
                            if (route) navigate(route);
                          }}
                          title={`Abrir ${task.linkedEntityName}`}
                        >
                          {task.linkedEntityName}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Follow-ups em Aberto */}
          <SectionCard
            title="Follow-ups em Aberto"
            subtitle={`${followUpsOpen.length} pendente(s)`}
          >
            {followUpsOpen.length === 0 ? (
              <div className="text-center py-6">
                <ArrowUpRight className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Todos os follow-ups estão em dia
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Aproveite para criar novos contatos e avançar o pipeline.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                >
                  Criar Follow-up
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {followUpsOpen.slice(0, 8).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left rounded-lg p-2 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-warning-bg)',
                      borderLeft: '3px solid var(--color-warning)',
                    }}
                  >
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {task.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDateDayMonth(task.date)}
                      {task.linkedEntityName ? ` · ${task.linkedEntityName}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Modals */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onComplete={async (id) => { await planning.completeTask(id); setSelectedTask(null); }}
        onPostpone={async (id) => { await planning.postponeTask(id); setSelectedTask(null); }}
        onReschedule={async (id, date, start, end) => { await planning.rescheduleTask(id, date, start, end); setSelectedTask(null); }}
        onEdit={(task) => { setSelectedTask(null); setEditingTask(task); setShowTaskForm(true); }}
        onArchive={async (id) => { await planning.archiveTask(id); setSelectedTask(null); }}
      />
      <TaskFormModal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        onSave={async (data) => {
          if (editingTask?.id) { await planning.editTask(editingTask.id, data); }
          else { await planning.addTask(data); }
          setShowTaskForm(false); setEditingTask(null);
        }}
        initialData={editingTask}
      />
    </div>
  );
}

function FocusRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
