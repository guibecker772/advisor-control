import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { usePlanning } from '../../../hooks/usePlanning';
import { useWeeklyPlanning } from '../../../hooks/useWeeklyPlanning';
import { SectionCard, Badge, Button } from '../../../components/ui';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plus,
  CalendarDays,
  ListTodo,
  ExternalLink,
  GripVertical,
  Calendar,
  CalendarClock,
  Inbox,
  Archive,
  ArrowRight,
} from 'lucide-react';
import { addDays, parseISO, format as fnsFormat } from 'date-fns';
import {
  formatWeekdayShort,
  formatDateDayMonth,
  formatDateShort,
  getWeekKey,
} from '../../../domain/planning/planningUtils';
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_BADGE_VARIANT,
} from '../../../domain/planning/planningConstants';
import type { PlanningTask } from '../../../domain/planning/planningTypes';
import type { CalendarEvent } from '../../../domain/types/calendar';
import { getEffectiveMeetingType, MEETING_TYPE_COLORS, MEETING_TYPE_LABELS } from '../../../domain/types/calendar';
import { getEntityRoute } from '../../../domain/planning/planningIntegration';
import TaskDrawer from '../../../components/planning/TaskDrawer';
import TaskFormModal from '../../../components/planning/TaskFormModal';

type PlanningReturn = ReturnType<typeof usePlanning>;

interface WeekTabProps {
  planning: PlanningReturn;
  agendaEvents?: CalendarEvent[];
}

/** Identifies what is being dragged. */
interface DragItem {
  type: 'task' | 'block';
  id: string;
  sourceDate: string;
}

function GoalBar({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 flex-shrink-0 truncate" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-3)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-gold)' : 'var(--color-warning)',
          }}
        />
      </div>
      <span
        className="text-xs w-12 text-right font-medium flex-shrink-0"
        style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-text-muted)' }}
      >
        {done}/{target}
      </span>
    </div>
  );
}

export default function WeekTab({ planning, agendaEvents = [] }: WeekTabProps) {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const referenceDate = useMemo(() => addDays(new Date(), weekOffset * 7), [weekOffset]);
  const {
    weekDays,
    weekData,
    unscheduledTasks,
    weekPriorities,
    overdueForWeek,
    weekGoals,
    undatedSummary,
  } = useWeeklyPlanning(planning.tasks, planning.blocks, referenceDate);

  // Enhanced visibility on Sunday (7) / Monday (1)
  const jsDay = new Date().getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const isCleanupDay = dayOfWeek === 7 || dayOfWeek === 1;

  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);

  // Drag-and-drop state
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Group agenda events by date string for the week
  const agendaByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of agendaEvents) {
      try {
        const dateStr = fnsFormat(parseISO(ev.start), 'yyyy-MM-dd');
        const arr = map.get(dateStr) ?? [];
        arr.push(ev);
        map.set(dateStr, arr);
      } catch { /* skip invalid */ }
    }
    return map;
  }, [agendaEvents]);

  const weekKey = getWeekKey(referenceDate);

  // --- Drag handlers ---
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: DragItem) => {
      setDragItem(item);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(item));
      // Ghost opacity
      if (e.currentTarget instanceof HTMLElement) {
        requestAnimationFrame(() => {
          (e.currentTarget as HTMLElement).style.opacity = '0.4';
        });
      }
    },
    [],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '1';
      }
      setDragItem(null);
      setDropTarget(null);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, dateString: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(dateString);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, dateString: string) => {
      // Only clear if leaving the column itself (not a child)
      const related = e.relatedTarget as HTMLElement | null;
      if (related && e.currentTarget.contains(related)) return;
      if (dropTarget === dateString) setDropTarget(null);
    },
    [dropTarget],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDate: string) => {
      e.preventDefault();
      setDropTarget(null);
      setDragItem(null);

      let item: DragItem;
      try {
        item = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }

      // Skip if dropped on same date
      if (item.sourceDate === targetDate) return;

      if (item.type === 'task') {
        await planning.editTask(item.id, { date: targetDate });
      } else if (item.type === 'block') {
        await planning.editBlock(item.id, { date: targetDate });
      }
    },
    [planning],
  );

  return (
    <div className="space-y-6">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((p) => p - 1)}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Semana {weekKey.split('-W')[1]}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {formatDateShort(weekDays[0])} - {formatDateShort(weekDays[6])}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset((p) => p + 1)}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Week board (3/4) */}
        <div className="xl:col-span-3">
          <div className="grid grid-cols-7 gap-3">
            {weekData.map((day) => (
              <div
                key={day.dateString}
                className="rounded-xl flex flex-col min-h-[300px] transition-all duration-150"
                onDragOver={(e) => handleDragOver(e, day.dateString)}
                onDragLeave={(e) => handleDragLeave(e, day.dateString)}
                onDrop={(e) => handleDrop(e, day.dateString)}
                style={{
                  backgroundColor: dropTarget === day.dateString && dragItem?.sourceDate !== day.dateString
                    ? 'var(--color-gold-bg)'
                    : 'var(--color-surface)',
                  border: dropTarget === day.dateString && dragItem?.sourceDate !== day.dateString
                    ? '2px dashed var(--color-gold)'
                    : day.isToday
                      ? '2px solid var(--color-gold)'
                      : day.isEmpty
                        ? '1px dashed var(--color-border-subtle)'
                        : '1px solid var(--color-border-subtle)',
                }}
              >
                {/* Day header */}
                <div
                  className="p-3 border-b text-center relative"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    backgroundColor: day.isToday ? 'var(--color-gold-bg)' : 'var(--color-surface-2)',
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase"
                    style={{ color: day.isToday ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
                  >
                    {formatWeekdayShort(day.date)}
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: day.isToday ? 'var(--color-gold)' : 'var(--color-text)' }}
                  >
                    {formatDateDayMonth(day.date)}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {day.totalTasks}t · {day.freeHours}h livre
                    </span>
                  </div>
                  {/* Day status indicators */}
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {day.isOverloaded && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-danger)' }}
                        title="Dia sobrecarregado"
                      />
                    )}
                    {day.isEmpty && !day.isToday && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-warning)' }}
                        title="Dia vazio"
                      />
                    )}
                    {day.hasHighPriority && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-gold)' }}
                        title="Tem alta prioridade"
                      />
                    )}
                    {!day.hasCommercialBlock && !day.isEmpty && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-info)' }}
                        title="Sem bloco comercial"
                      />
                    )}
                  </div>
                </div>

                {/* Day items */}
                <div className="flex-1 p-2 space-y-1 overflow-y-auto">
                  {day.tasks.length === 0 && day.blocks.length === 0 && !(agendaByDate.get(day.dateString)?.length) && (
                    <div className="text-center py-4">
                      <p className="text-xs italic mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Dia livre
                      </p>
                      <button
                        onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                        className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
                        style={{ color: 'var(--color-gold)' }}
                      >
                        + Tarefa
                      </button>
                    </div>
                  )}
                  {day.tasks.map((task) => (
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, { type: 'task', id: task.id!, sourceDate: day.dateString })
                      }
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedTask(task)}
                      className="w-full text-left rounded-md p-2 transition-colors cursor-grab active:cursor-grabbing group"
                      style={{
                        backgroundColor: task.status === 'completed'
                          ? 'var(--color-success-bg)'
                          : 'var(--color-surface-2)',
                        borderLeft: `3px solid ${
                          task.priority === 'max'
                            ? 'var(--color-danger)'
                            : task.priority === 'high'
                              ? 'var(--color-warning)'
                              : task.priority === 'medium'
                                ? 'var(--color-info)'
                                : 'var(--color-border-subtle)'
                        }`,
                      }}
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical
                          className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
                          style={{ color: 'var(--color-text-muted)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium truncate"
                            style={{
                              color: task.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text)',
                              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </p>
                          {task.startTime && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {task.startTime}
                            </p>
                          )}
                          {task.linkedEntityName && task.linkedEntityType !== 'none' && (
                            <button
                              className="text-xs truncate inline-flex items-center gap-0.5 hover:underline"
                              style={{ color: 'var(--color-gold)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const route = getEntityRoute(task.linkedEntityType, task.linkedEntityId);
                                if (route) navigate(route);
                              }}
                              title={`Abrir ${task.linkedEntityName}`}
                            >
                              {task.linkedEntityName}
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {day.blocks.map((block) => (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, { type: 'block', id: block.id!, sourceDate: day.dateString })
                      }
                      onDragEnd={handleDragEnd}
                      className="rounded-md p-2 cursor-grab active:cursor-grabbing group"
                      style={{
                        backgroundColor: 'var(--color-gold-bg)',
                        borderLeft: '3px solid var(--color-gold)',
                      }}
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical
                          className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
                          style={{ color: 'var(--color-gold)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--color-gold)' }}>
                            {block.title}
                          </p>
                          {block.startTime && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {block.startTime} - {block.endTime}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(agendaByDate.get(day.dateString) ?? []).map((agEvt) => {
                    const mType = getEffectiveMeetingType(agEvt);
                    const mColor = MEETING_TYPE_COLORS[mType];
                    const startD = parseISO(agEvt.start);
                    const endD = agEvt.end ? parseISO(agEvt.end) : null;
                    return (
                      <div
                        key={`ag-${agEvt.id}`}
                        className="rounded-md p-2"
                        style={{
                          backgroundColor: `${mColor}10`,
                          borderLeft: `3px solid ${mColor}`,
                        }}
                      >
                        <div className="flex items-start gap-1">
                          <Calendar
                            className="w-3 h-3 mt-0.5 flex-shrink-0"
                            style={{ color: mColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                              {agEvt.title}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {fnsFormat(startD, 'HH:mm')}{endD ? ` - ${fnsFormat(endD, 'HH:mm')}` : ''}
                            </p>
                            <span
                              className="text-[10px] px-1 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: `${mColor}20`, color: mColor }}
                            >
                              {MEETING_TYPE_LABELS[mType]}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar (1/4) */}
        <div className="space-y-6">
          {/* Week Goals */}
          <SectionCard title="Metas da Semana" subtitle="Progresso operacional">
            <div className="space-y-3 py-1">
              <GoalBar label="Reuniões" done={weekGoals.meetings.done} target={weekGoals.meetings.target} />
              <GoalBar label="Follow-ups" done={weekGoals.followUpsDone.done} target={weekGoals.followUpsDone.target} />
              <GoalBar label="Contatos novos" done={weekGoals.newContacts.done} target={weekGoals.newContacts.target} />
              <GoalBar label="Blocos prospecção" done={weekGoals.prospectingBlocks.done} target={weekGoals.prospectingBlocks.target} />
              <GoalBar label="Concluídas" done={weekGoals.tasksCompleted.done} target={weekGoals.tasksCompleted.target} />
            </div>
          </SectionCard>

          {/* Week priorities */}
          <SectionCard title="Prioridades da Semana" subtitle={`${weekPriorities.length} item(ns)`}>
            {weekPriorities.length === 0 ? (
              <div className="text-center py-6">
                <ListTodo className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Nenhuma prioridade nesta semana
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Crie tarefas de alta prioridade para manter o foco comercial.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                >
                  Nova Tarefa
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {weekPriorities.map((task) => (
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
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDateDayMonth(task.date)}
                      {task.startTime ? ` · ${task.startTime}` : ''}
                      {task.linkedEntityName ? ` · ${task.linkedEntityName}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Overdue follow-ups needing scheduling */}
          {overdueForWeek.length > 0 && (
            <SectionCard
              title="Follow-ups Vencidos"
              subtitle="Precisam encaixe na semana"
            >
              <div className="space-y-2">
                {overdueForWeek.map((task) => (
                  <button
                    key={task.id}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, { type: 'task', id: task.id!, sourceDate: task.date || '' })
                    }
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left rounded-lg p-3 transition-colors cursor-grab active:cursor-grabbing group"
                    style={{
                      backgroundColor: 'var(--color-danger-bg)',
                      border: '1px solid var(--color-danger)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical
                        className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
                        style={{ color: 'var(--color-danger)' }}
                      />
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {task.title}
                      </span>
                    </div>
                    <p className="text-xs mt-1 pl-5" style={{ color: 'var(--color-danger)' }}>
                      Vencido em {formatDateDayMonth(task.date)}
                      {task.linkedEntityName ? ` · ${task.linkedEntityName}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Undated tasks — enriched section */}
          <SectionCard
            title="Pendências sem Data"
            subtitle={
              undatedSummary.total === 0
                ? 'Tudo organizado'
                : `${undatedSummary.total} item(ns)${undatedSummary.highImpact > 0 ? ` · ${undatedSummary.highImpact} de alto impacto` : ''}`
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              >
                + Nova
              </Button>
            }
          >
            {undatedSummary.total === 0 ? (
              <div className="text-center py-6">
                <CalendarDays className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Todas as tarefas têm data
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Ótimo! Sua semana está bem organizada.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Cleanup alert — boosted on Sunday/Monday */}
                {(isCleanupDay || undatedSummary.aging > 0) && (
                  <div
                    className="rounded-lg p-3 flex items-start gap-2"
                    style={{
                      backgroundColor: isCleanupDay ? 'var(--color-warning-bg)' : 'var(--color-surface-2)',
                      border: isCleanupDay ? '1px solid var(--color-warning)' : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <Inbox className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: isCleanupDay ? 'var(--color-warning)' : 'var(--color-text-muted)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                        {isCleanupDay ? 'Hora de organizar!' : 'Tarefas acumulando'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {undatedSummary.aging > 0
                          ? `${undatedSummary.aging} tarefa(s) criada(s) há 7+ dias sem data.`
                          : `${undatedSummary.total} pendência(s) sem data. Distribua na semana.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Classified task list */}
                {undatedSummary.items.slice(0, 10).map(({ task, ageDays, impact, suggestion }) => (
                  <div
                    key={task.id}
                    className="rounded-lg overflow-hidden transition-all"
                    style={{
                      backgroundColor: impact === 'high' ? 'var(--color-gold-bg)' : 'var(--color-surface-2)',
                      border: `1px solid ${
                        impact === 'high' ? 'var(--color-gold)'
                          : impact === 'medium' ? 'var(--color-info)'
                          : 'var(--color-border-subtle)'
                      }`,
                    }}
                  >
                    <button
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, { type: 'task', id: task.id!, sourceDate: '' })
                      }
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedTask(task)}
                      className="w-full text-left p-2.5 cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical
                          className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
                          style={{ color: 'var(--color-text-muted)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {impact === 'high' && (
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-gold)' }} />
                            )}
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                              {TASK_TYPE_LABELS[task.type]}
                            </span>
                            {ageDays >= 7 && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
                              >
                                {ageDays}d sem data
                              </span>
                            )}
                            {task.linkedEntityName && (
                              <span className="text-[10px] truncate" style={{ color: 'var(--color-gold)' }}>
                                {task.linkedEntityName}
                              </span>
                            )}
                            <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]} className="text-[10px] !py-0 !px-1">
                              {PRIORITY_LABELS[task.priority]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                    {/* Quick actions row */}
                    <div
                      className="flex items-center gap-1 px-2.5 pb-2 pt-0"
                    >
                      <button
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-surface-hover)]"
                        style={{ color: 'var(--color-gold)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(task);
                          setShowTaskForm(true);
                        }}
                        title="Definir data e encaixar na semana"
                      >
                        <CalendarClock className="w-3 h-3" />
                        {suggestion}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-surface-hover)]"
                        style={{ color: 'var(--color-text-muted)' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (task.id) {
                            await planning.archiveTask(task.id);
                          }
                        }}
                        title="Arquivar tarefa"
                      >
                        <Archive className="w-3 h-3" />
                        Arquivar
                      </button>
                    </div>
                  </div>
                ))}

                {undatedSummary.total > 10 && (
                  <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    +{undatedSummary.total - 10} tarefas sem data
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Modals/Drawers */}
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
          if (editingTask?.id) {
            await planning.editTask(editingTask.id, data);
          } else {
            await planning.addTask(data);
          }
          setShowTaskForm(false);
          setEditingTask(null);
        }}
        initialData={editingTask}
      />
    </div>
  );
}
