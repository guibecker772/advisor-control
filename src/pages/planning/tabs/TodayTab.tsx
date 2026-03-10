import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import type { usePlanning } from '../../../hooks/usePlanning';
import { useTodayPlanning } from '../../../hooks/useTodayPlanning';
import { KpiCard, Button, SectionCard, Badge } from '../../../components/ui';
import {
  CalendarCheck,
  ListTodo,
  AlertTriangle,
  Flame,
  Clock,
  Target,
  Plus,
  LayoutGrid,
  ClipboardCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  Users,
  Check,
  ChevronRight,
  ExternalLink,
  Bell,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import {
  formatDatePtBR,
  formatDuration,
} from '../../../domain/planning/planningUtils';
import { getEntityRoute } from '../../../domain/planning/planningIntegration';
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  LINKED_ENTITY_LABELS,
  TIMELINE_HOURS,
} from '../../../domain/planning/planningConstants';
import type { PlanningTask, PlanningBlock, AutomationPreferences, ChecklistSummary } from '../../../domain/planning/planningTypes';
import { useChecklistPlanning } from '../../../hooks/useChecklistPlanning';

// Lazy-loaded modals (só carregam quando o usuário interage)
const TaskFormModal = lazy(() => import('../../../components/planning/TaskFormModal'));
const BlockFormModal = lazy(() => import('../../../components/planning/BlockFormModal'));
const TaskDrawer = lazy(() => import('../../../components/planning/TaskDrawer'));
const DailyReviewModal = lazy(() => import('../../../components/planning/DailyReviewModal'));

type PlanningReturn = ReturnType<typeof usePlanning>;

interface TodayTabProps {
  planning: PlanningReturn;
  automationPrefs?: AutomationPreferences;
  onChangeTab?: (tab: string) => void;
}

const IMPACT_COLORS = {
  revenue: 'var(--color-gold)',
  relationship: 'var(--color-info)',
  pipeline: 'var(--color-success)',
  operational: 'var(--color-text-secondary)',
} as const;

const IMPACT_LABELS = {
  revenue: 'Receita',
  relationship: 'Relacionamento',
  pipeline: 'Pipeline',
  operational: 'Operacional',
} as const;

export default function TodayTab({ planning, automationPrefs, onChangeTab }: TodayTabProps) {
  const navigate = useNavigate();
  const {
    today,
    todayTasks,
    timelineTasks,
    timelineBlocks,
    stats,
    nextAction,
    top5,
    entityAlerts,
    radar,
    freeSlots,
    smartBanner,
    overflowTasks,
    tomorrowTasks,
    tomorrowPriority1,
    tomorrowMainPending,
    automationAlerts,
    automationOpportunities,
  } = useTodayPlanning(planning.tasks, planning.blocks, automationPrefs);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
  const [blockFormDefaults, setBlockFormDefaults] = useState<Partial<PlanningBlock> | null>(null);

  // Checklist data for daily review integration
  const {
    weeklyChecklist,
    monthlyChecklist,
    weeklyProgress,
    monthlyProgress,
  } = useChecklistPlanning();

  const checklistSummary: ChecklistSummary | undefined =
    weeklyChecklist || monthlyChecklist
      ? {
          weeklyProgress,
          weeklyTotal: weeklyChecklist?.items.length ?? 0,
          weeklyChecked: weeklyChecklist?.items.filter((i) => i.checked).length ?? 0,
          weeklyPending: weeklyChecklist?.items.filter((i) => !i.checked) ?? [],
          monthlyProgress,
          monthlyTotal: monthlyChecklist?.items.length ?? 0,
          monthlyChecked: monthlyChecklist?.items.filter((i) => i.checked).length ?? 0,
          monthlyPending: monthlyChecklist?.items.filter((i) => !i.checked) ?? [],
        }
      : undefined;

  const getTimelineItemsForHour = (hour: number) => {
    const hourStr = String(hour).padStart(2, '0');
    const matchedTasks = timelineTasks.filter(
      (t) => t.startTime && t.startTime.startsWith(hourStr),
    );
    const matchedBlocks = timelineBlocks.filter(
      (b) => b.startTime && b.startTime.startsWith(hourStr),
    );
    return { tasks: matchedTasks, blocks: matchedBlocks };
  };

  const getFreeSlotForHour = (hour: number) =>
    freeSlots.find((s) => s.hour === hour);

  return (
    <div className="space-y-6">
      {/* ========== SMART BANNER ========== */}
      <div
        className="rounded-xl p-5 flex items-start gap-4"
        style={{
          backgroundColor: 'var(--color-gold-bg)',
          border: '1px solid var(--color-gold)',
        }}
      >
        <Target
          className="w-6 h-6 flex-shrink-0 mt-0.5"
          style={{ color: 'var(--color-gold)' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-gold)' }}>
            {smartBanner.greeting}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text)' }}>
            {smartBanner.message}
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
            {formatDatePtBR(new Date())}
          </p>
        </div>
      </div>

      {/* ========== ACTION BUTTONS ========== */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
        >
          Nova Tarefa
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<LayoutGrid className="w-4 h-4" />}
          onClick={() => { setBlockFormDefaults(null); setShowBlockForm(true); }}
        >
          Novo Bloco
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ClipboardCheck className="w-4 h-4" />}
          onClick={() => setShowDailyReview(true)}
        >
          Revisão do Dia
        </Button>
      </div>

      {/* ========== "O QUE FAZER AGORA" ========== */}
      {nextAction && (
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-gold)',
            boxShadow: '0 0 0 1px var(--color-gold-bg), 0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-gold)' }}>
              O que fazer agora
            </h3>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {nextAction.task.title}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {nextAction.reason}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant={PRIORITY_BADGE_VARIANT[nextAction.task.priority]}>
                  {PRIORITY_LABELS[nextAction.task.priority]}
                </Badge>
                <span className="text-xs" style={{ color: IMPACT_COLORS[nextAction.impactType] }}>
                  {IMPACT_LABELS[nextAction.impactType]}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {TASK_TYPE_LABELS[nextAction.task.type]}
                </span>
                {nextAction.task.linkedEntityName && nextAction.task.linkedEntityType !== 'none' && (
                  <button
                    className="text-xs font-medium inline-flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--color-gold)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const route = getEntityRoute(nextAction.task.linkedEntityType, nextAction.task.linkedEntityId);
                      if (route) navigate(route);
                    }}
                    title={`Abrir ${nextAction.task.linkedEntityName}`}
                  >
                    {LINKED_ENTITY_LABELS[nextAction.task.linkedEntityType]} — {nextAction.task.linkedEntityName}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                size="sm"
                leftIcon={<Check className="w-4 h-4" />}
                onClick={() => planning.completeTask(nextAction.task.id!)}
              >
                Concluir
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Clock className="w-4 h-4" />}
                onClick={() => planning.postponeTask(nextAction.task.id!)}
              >
                Adiar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTask(nextAction.task)}
              >
                Abrir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== KPI CARDS ========== */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Compromissos"
          value={stats.totalAppointments}
          icon={<CalendarCheck className="w-5 h-5" />}
          accentColor="gold"
        />
        <KpiCard
          title="Tarefas do Dia"
          value={stats.totalTasks}
          icon={<ListTodo className="w-5 h-5" />}
          accentColor="info"
        />
        <KpiCard
          title="Follow-ups Vencidos"
          value={stats.followUpsOverdue}
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor={stats.followUpsOverdue > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          title="Prioridade Máxima"
          value={stats.maxPriority}
          icon={<Flame className="w-5 h-5" />}
          accentColor={stats.maxPriority > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          title="Horas Livres"
          value={`${stats.freeHours}h`}
          icon={<Clock className="w-5 h-5" />}
          accentColor="info"
        />
        <KpiCard
          title="Meta do Dia"
          value={`${stats.completedCount}/${stats.totalTasks}`}
          icon={<Target className="w-5 h-5" />}
          accentColor="gold"
          progress={stats.totalTasks > 0 ? (stats.completedCount / stats.totalTasks) * 100 : 0}
          progressLabel="Progresso"
        />
      </div>

      {/* ========== MAIN CONTENT: Timeline + Sidebar ========== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Timeline column (2/3) */}
        <div className="xl:col-span-2">
          <SectionCard title="Timeline do Dia" subtitle="Visão por hora">
            <div className="space-y-0">
              {TIMELINE_HOURS.map((hour) => {
                const { tasks: hourTasks, blocks: hourBlocks } = getTimelineItemsForHour(hour);
                const hasItems = hourTasks.length > 0 || hourBlocks.length > 0;
                const freeSlot = !hasItems ? getFreeSlotForHour(hour) : undefined;

                return (
                  <div
                    key={hour}
                    className="flex gap-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-border-subtle)' }}
                  >
                    <div
                      className="w-14 flex-shrink-0 text-right text-sm font-medium pt-0.5"
                      style={{ color: hasItems ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 min-w-0">
                      {!hasItems && freeSlot && (
                        <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg group planning-timeline-free">
                          <div>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              Horário livre
                            </span>
                            <span className="text-xs ml-2 italic" style={{ color: 'var(--color-text-muted)' }}>
                              — {freeSlot.suggestion}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-surface-2)]"
                              style={{ color: 'var(--color-gold)' }}
                              onClick={() => {
                                setBlockFormDefaults({
                                  date: today,
                                  startTime: `${String(hour).padStart(2, '0')}:00`,
                                  endTime: `${String(hour + 1).padStart(2, '0')}:00`,
                                  category: freeSlot.category === 'follow_up' ? 'follow_up' : freeSlot.category,
                                } as Partial<PlanningBlock>);
                                setShowBlockForm(true);
                              }}
                            >
                              + Bloco
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-surface-2)]"
                              style={{ color: 'var(--color-text-secondary)' }}
                              onClick={() => {
                                setEditingTask(null);
                                setShowTaskForm(true);
                              }}
                            >
                              + Tarefa
                            </button>
                          </div>
                        </div>
                      )}
                      {!hasItems && !freeSlot && (
                        <div className="py-1 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                          Horário livre
                        </div>
                      )}
                      {hourTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="w-full text-left rounded-lg p-3 mb-1 transition-colors cursor-pointer"
                          style={{
                            backgroundColor: task.status === 'completed'
                              ? 'var(--color-success-bg)'
                              : 'var(--color-surface-2)',
                            border: '1px solid var(--color-border-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-sm font-medium truncate"
                                style={{
                                  color: task.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text)',
                                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                }}
                              >
                                {task.title}
                              </span>
                              <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                                {PRIORITY_LABELS[task.priority]}
                              </Badge>
                              <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
                                {STATUS_LABELS[task.status]}
                              </Badge>
                            </div>
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                              {task.startTime} - {task.endTime}
                            </span>
                          </div>
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
                            {task.durationMinutes > 0 && (
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {formatDuration(task.durationMinutes)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {hourBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="rounded-lg p-3 mb-1"
                          style={{
                            backgroundColor: 'var(--color-gold-bg)',
                            border: '1px solid var(--color-gold)',
                            borderLeftWidth: '3px',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-gold)' }}>
                              {block.title}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {block.startTime} - {block.endTime}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Sidebar column (1/3) */}
        <div className="space-y-6">
          {/* Top 5 Prioridades */}
          <SectionCard title="Top 5 Prioridades do Dia" subtitle="Ranking por impacto">
            {top5.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Nenhuma prioridade pendente
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Crie uma tarefa de alta prioridade ou use um bloco livre para prospecção.
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
                {top5.map((item, index) => (
                  <button
                    key={item.task.id}
                    onClick={() => setSelectedTask(item.task)}
                    className="w-full text-left rounded-lg p-3 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                        style={{
                          backgroundColor: index === 0 ? 'var(--color-gold)' : 'var(--color-surface-3)',
                          color: index === 0 ? 'var(--color-bg)' : 'var(--color-text-muted)',
                        }}
                      >
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                            {item.task.title}
                          </span>
                          <Badge variant={PRIORITY_BADGE_VARIANT[item.task.priority]}>
                            {PRIORITY_LABELS[item.task.priority]}
                          </Badge>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {item.reason}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Exigem Ação Hoje */}
          <SectionCard
            title="Exigem Ação Hoje"
            subtitle={entityAlerts.length > 0 ? `${entityAlerts.length} entidade(s)` : 'Clientes e prospects'}
          >
            {entityAlerts.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Tudo em dia com seus vínculos
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma entidade exige ação urgente. Aproveite para revisar a carteira.
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
                {entityAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={`${alert.entityType}:${alert.entityId}`}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: alert.severity === 'high' ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
                      border: `1px solid ${alert.severity === 'high' ? 'var(--color-danger)' : 'var(--color-border-subtle)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                            {alert.entityName}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
                          >
                            {LINKED_ENTITY_LABELS[alert.entityType]}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: alert.severity === 'high' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                          {alert.reason}
                        </p>
                        <p className="text-xs mt-0.5 italic" style={{ color: 'var(--color-text-muted)' }}>
                          {alert.suggestedAction}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {getEntityRoute(alert.entityType) && (
                          <button
                            className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                            style={{ color: 'var(--color-gold)' }}
                            onClick={() => navigate(getEntityRoute(alert.entityType, alert.entityId)!)}
                            title={`Abrir ${alert.entityName}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                          style={{ color: 'var(--color-text-secondary)' }}
                          onClick={() => {
                            if (alert.relatedTasks.length > 0) setSelectedTask(alert.relatedTasks[0]);
                          }}
                          title="Ver tarefa"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Central de Alertas */}
          {automationAlerts.length > 0 && (
            <SectionCard
              title="Central de Alertas"
              subtitle={`${automationAlerts.length} alerta(s) ativo(s)`}
            >
              <div className="space-y-2">
                {automationAlerts.slice(0, 5).map((alert) => {
                  const severityConfig = {
                    critical: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)', color: 'var(--color-danger)', icon: <AlertTriangle className="w-4 h-4" /> },
                    high: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', color: 'var(--color-warning)', icon: <Bell className="w-4 h-4" /> },
                    medium: { bg: 'var(--color-info-bg)', border: 'var(--color-info)', color: 'var(--color-info)', icon: <Bell className="w-4 h-4" /> },
                    low: { bg: 'var(--color-surface-2)', border: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)', icon: <Bell className="w-4 h-4" /> },
                  }[alert.severity];

                  return (
                    <div
                      key={alert.id}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: severityConfig.bg,
                        border: `1px solid ${severityConfig.border}`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0" style={{ color: severityConfig.color }}>
                          {severityConfig.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: severityConfig.color }}>
                            {alert.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs font-medium" style={{ color: severityConfig.color }}>
                              {alert.suggestedAction}
                            </span>
                            {alert.entityType && alert.entityType !== 'none' && alert.entityId && (
                              <button
                                className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                                style={{ color: 'var(--color-gold)' }}
                                onClick={() => {
                                  const route = getEntityRoute(alert.entityType!, alert.entityId);
                                  if (route) navigate(route);
                                }}
                                title={alert.entityName || 'Abrir entidade'}
                              >
                                <ExternalLink className="w-3 h-3" />
                                Abrir
                              </button>
                            )}
                            {alert.relatedTaskIds.length > 0 && (
                              <button
                                className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                                style={{ color: 'var(--color-text-secondary)' }}
                                onClick={() => {
                                  const task = planning.tasks.find((t) => t.id === alert.relatedTaskIds[0]);
                                  if (task) setSelectedTask(task);
                                }}
                              >
                                <ChevronRight className="w-3 h-3" />
                                Ver tarefa
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Oportunidades */}
          <SectionCard
            title="Oportunidades"
            subtitle={automationOpportunities.length > 0
              ? `${automationOpportunities.length} detectada(s)`
              : 'Análise comercial'}
          >
            {automationOpportunities.length === 0 && radar.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Sem oportunidades pendentes
                </p>
                <p className="text-xs mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Bom momento para prospectar novos contatos.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<LayoutGrid className="w-4 h-4" />}
                  onClick={() => { setBlockFormDefaults(null); setShowBlockForm(true); }}
                >
                  Criar Bloco de Prospecção
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {automationOpportunities.map((opp) => {
                  const impactConfig = {
                    revenue: { color: 'var(--color-success)', label: 'Receita' },
                    relationship: { color: 'var(--color-gold)', label: 'Relacionamento' },
                    operational: { color: 'var(--color-text-muted)', label: 'Operacional' },
                    pipeline: { color: 'var(--color-info)', label: 'Pipeline' },
                  }[opp.estimatedImpact];

                  return (
                    <div
                      key={opp.id}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: 'var(--color-success-bg)',
                        border: '1px solid var(--color-success)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                            {opp.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {opp.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: 'var(--color-surface-2)',
                                color: impactConfig.color,
                              }}
                            >
                              {impactConfig.label}
                            </span>
                            {opp.entityType && opp.entityType !== 'none' && opp.entityId && (
                              <button
                                className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                                style={{ color: 'var(--color-gold)' }}
                                onClick={() => {
                                  const route = getEntityRoute(opp.entityType!, opp.entityId);
                                  if (route) navigate(route);
                                }}
                                title={opp.entityName || 'Abrir entidade'}
                              >
                                <ExternalLink className="w-3 h-3" />
                                {opp.entityName || 'Abrir'}
                              </button>
                            )}
                            {opp.suggestedTaskTemplate && (
                              <button
                                className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors hover:bg-[var(--color-surface-3)]"
                                style={{ color: 'var(--color-success)' }}
                                onClick={() => {
                                  setEditingTask(null);
                                  setShowTaskForm(true);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                                Criar tarefa
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Keep existing radar items that aren't covered by automation */}
                {radar.map((item, index) => (
                  <div
                    key={`radar-${index}`}
                    className="rounded-lg p-3 flex items-start gap-3"
                    style={{
                      backgroundColor: item.type === 'risk' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                      border: `1px solid ${item.type === 'risk' ? 'var(--color-danger)' : 'var(--color-success)'}`,
                    }}
                  >
                    {item.type === 'opportunity' ? (
                      <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: item.type === 'risk' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {item.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Fechamento do Dia */}
          <SectionCard title="Fechamento do Dia">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-success-bg)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                  {stats.completedCount}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Concluídas</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>
                  {stats.pendingCount}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pendentes</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-info-bg)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--color-info)' }}>
                  {overflowTasks.length}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Transbordo</p>
              </div>
            </div>
            {/* Tomorrow preview */}
            {tomorrowPriority1 && (
              <div
                className="rounded-lg p-3 mb-3"
                style={{
                  backgroundColor: 'var(--color-gold-bg)',
                  border: '1px solid var(--color-gold)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-gold)' }}>
                  Prioridade #1 amanhã
                </p>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {tomorrowPriority1.title}
                </p>
              </div>
            )}
            {overflowTasks.length > 0 && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-warning)' }}>
                {overflowTasks.length} tarefa(s) não concluída(s) serão transferidas para amanhã.
              </p>
            )}
            <Button
              fullWidth
              variant="secondary"
              onClick={() => setShowDailyReview(true)}
              leftIcon={<ClipboardCheck className="w-4 h-4" />}
            >
              Encerrar Dia
            </Button>
          </SectionCard>
        </div>
      </div>

      {/* ========== MODALS (lazy-loaded) ========== */}
      <Suspense fallback={null}>
        {showTaskForm && (
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
        )}

        {showBlockForm && (
          <BlockFormModal
            isOpen={showBlockForm}
            onClose={() => { setShowBlockForm(false); setBlockFormDefaults(null); }}
            onSave={async (data) => {
              await planning.addBlock(data);
              setShowBlockForm(false);
              setBlockFormDefaults(null);
            }}
            initialData={blockFormDefaults as PlanningBlock | null}
          />
        )}

        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onComplete={async (id) => { await planning.completeTask(id); setSelectedTask(null); }}
            onPostpone={async (id) => { await planning.postponeTask(id); setSelectedTask(null); }}
            onReschedule={async (id, date, start, end) => { await planning.rescheduleTask(id, date, start, end); setSelectedTask(null); }}
            onEdit={(task) => { setSelectedTask(null); setEditingTask(task); setShowTaskForm(true); }}
            onArchive={async (id) => { await planning.archiveTask(id); setSelectedTask(null); }}
          />
        )}

        {showDailyReview && (
          <DailyReviewModal
            isOpen={showDailyReview}
            onClose={() => setShowDailyReview(false)}
            stats={stats}
            date={today}
            overflowTasks={overflowTasks}
            tomorrowPriority1={tomorrowPriority1}
            tomorrowMainPending={tomorrowMainPending}
            tomorrowTasksCount={tomorrowTasks.length}
            onPostponeTask={(id) => planning.postponeTask(id)}
            checklistSummary={checklistSummary}
            onGoToChecklist={onChangeTab ? () => onChangeTab('checklist') : undefined}
          />
        )}
      </Suspense>
    </div>
  );
}
