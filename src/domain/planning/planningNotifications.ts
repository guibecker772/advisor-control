/**
 * Planning Notification Generator
 *
 * Pure functions that convert Planning intelligence outputs into
 * Notification candidates for the bell notification system.
 * Each notification has a dedupKey to prevent duplicates.
 *
 * Design goals:
 * - Useful, not noisy — capped at ~10 notifications per day
 * - Clear, actionable, with context and multiple quick actions
 * - Structured by category: urgente, hoje, sugestoes, planejamento
 * - Prepared for Focus Mode notifications in future phases
 */

import type { NotificationInput, NotificationCategory, NotificationPriority } from '../types/calendar';
import type { PlanningTask, WeeklyPaceStatus } from './planningTypes';
import type { OverdueFollowUp, RelationshipAlert, FreeSlot, SmartBannerData, PostMeetingPrompt } from './planningIntelligence';
import type { PlanningAlert } from './planningIntegration';
import { getEntityRoute } from './planningIntegration';
import type { CalendarEvent } from '../types/calendar';

// ==========================================
// Helpers
// ==========================================

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function severityToPriority(severity: string): NotificationPriority {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'normal';
    default: return 'low';
  }
}

type ActionDef = { label: string; route: string; variant?: 'primary' | 'secondary' | 'ghost' };

// ==========================================
// Overdue follow-ups → urgente
// ==========================================

function fromOverdueFollowUps(alerts: OverdueFollowUp[]): NotificationInput[] {
  if (alerts.length === 0) return [];
  const day = todayKey();

  // Group: if many (>3), consolidate into a single notification
  if (alerts.length > 3) {
    const critical = alerts.filter(a => a.severity === 'critical').length;
    return [{
      type: 'planning_overdue_followup',
      category: 'urgente',
      priority: critical > 0 ? 'critical' : 'high',
      title: `${alerts.length} follow-ups vencidos`,
      message: `${critical > 0 ? `${critical} crítico(s). ` : ''}Contatos podem esfriar sem ação.`,
      actionLabel: 'Ver pendências',
      actionRoute: '/planejamento',
      actions: [
        { label: 'Ver pendências', route: '/planejamento', variant: 'primary' },
      ],
      dedupKey: `overdue-followups-batch-${day}`,
      createdAt: nowIso(),
    }];
  }

  // Individual notifications for ≤3 (include medium now for better coverage)
  return alerts.slice(0, 3).map(a => {
    const entityRoute = a.task.linkedEntityType !== 'none'
      ? getEntityRoute(a.task.linkedEntityType, a.task.linkedEntityId) ?? '/planejamento'
      : '/planejamento';

    const actions: ActionDef[] = [
      { label: 'Abrir contato', route: entityRoute, variant: 'primary' },
      { label: 'Reagendar', route: '/planejamento', variant: 'secondary' },
    ];

    return {
      type: 'planning_overdue_followup' as const,
      category: 'urgente' as NotificationCategory,
      priority: severityToPriority(a.severity),
      title: `Follow-up vencido: ${a.task.linkedEntityName || a.task.title}`,
      message: `Há ${a.daysOverdue} dia(s) sem retorno. ${a.reason}`,
      entityType: a.task.linkedEntityType !== 'none' ? a.task.linkedEntityType : undefined,
      entityId: a.task.linkedEntityId || undefined,
      entityName: a.task.linkedEntityName || undefined,
      actionLabel: 'Abrir contato',
      actionRoute: entityRoute,
      actions,
      dedupKey: `overdue-followup-${a.task.id}-${day}`,
      createdAt: nowIso(),
    };
  });
}

// ==========================================
// Overdue tasks (non-follow-up) → hoje
// ==========================================

function fromOverdueTasks(tasks: PlanningTask[]): NotificationInput[] {
  const day = todayKey();
  const overdue = tasks.filter(
    t => t.status !== 'completed' && t.status !== 'archived' && t.date < day && t.type !== 'follow_up',
  );
  if (overdue.length === 0) return [];

  const highPriority = overdue.filter(t => t.priority === 'max' || t.priority === 'high');

  // If few overdue: individual for high-priority ones
  if (overdue.length <= 2 && highPriority.length > 0) {
    return highPriority.slice(0, 2).map(t => {
      const entityRoute = t.linkedEntityType !== 'none' && t.linkedEntityId
        ? getEntityRoute(t.linkedEntityType, t.linkedEntityId) ?? '/planejamento'
        : '/planejamento';

      const actions: ActionDef[] = [
        { label: 'Concluir', route: '/planejamento', variant: 'primary' },
        { label: 'Reagendar', route: '/planejamento', variant: 'ghost' },
      ];
      if (t.linkedEntityType !== 'none') {
        actions.splice(1, 0, { label: 'Abrir vínculo', route: entityRoute, variant: 'secondary' });
      }

      return {
        type: 'planning_overdue_task' as const,
        category: 'hoje' as NotificationCategory,
        priority: 'high' as NotificationPriority,
        title: `Atrasada: ${t.title}`,
        message: t.linkedEntityName
          ? `Vinculada a ${t.linkedEntityName}. Revise e resolva.`
          : 'Tarefa de alta prioridade pendente.',
        entityType: t.linkedEntityType !== 'none' ? t.linkedEntityType : undefined,
        entityId: t.linkedEntityId || undefined,
        entityName: t.linkedEntityName || undefined,
        actionLabel: 'Concluir',
        actionRoute: '/planejamento',
        actions,
        dedupKey: `overdue-task-${t.id}-${day}`,
        createdAt: nowIso(),
      };
    });
  }

  // Batch for ≥3 overdue tasks
  if (overdue.length >= 2) {
    return [{
      type: 'planning_overdue_task',
      category: 'hoje',
      priority: highPriority.length > 0 ? 'high' : 'normal',
      title: `${overdue.length} tarefa(s) atrasada(s)`,
      message: highPriority.length > 0
        ? `${highPriority.length} de alta prioridade. Revise e reagende.`
        : 'Revise as pendências e reagende o que for necessário.',
      actionLabel: 'Ver pendências',
      actionRoute: '/planejamento',
      actions: [
        { label: 'Ver pendências', route: '/planejamento', variant: 'primary' },
      ],
      dedupKey: `overdue-tasks-batch-${day}`,
      createdAt: nowIso(),
    }];
  }

  return [];
}

// ==========================================
// Relationship alerts (client/prospect) → urgente/hoje
// ==========================================

function fromRelationshipAlerts(alerts: RelationshipAlert[]): NotificationInput[] {
  if (alerts.length === 0) return [];
  const day = todayKey();

  // Only critical/high severity
  const relevant = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  if (relevant.length === 0) return [];

  // Cap at 2
  return relevant.slice(0, 2).map(a => {
    const entityRoute = getEntityRoute(a.entityType, a.entityId) ?? '/planejamento';
    const actions: ActionDef[] = [
      { label: 'Abrir cadastro', route: entityRoute, variant: 'primary' },
      { label: 'Criar follow-up', route: '/planejamento', variant: 'secondary' },
    ];

    return {
      type: a.alertType === 'prospect_cooling'
        ? 'planning_idle_prospect' as const
        : 'planning_client_no_contact' as const,
      category: (a.severity === 'critical' ? 'urgente' : 'hoje') as NotificationCategory,
      priority: severityToPriority(a.severity),
      title: a.alertType === 'prospect_cooling'
        ? `Prospect esfriando: ${a.entityName}`
        : `Sem contato: ${a.entityName}`,
      message: `${a.daysSinceContact} dias sem contato. ${a.suggestedAction}`,
      entityType: a.entityType,
      entityId: a.entityId,
      entityName: a.entityName,
      actionLabel: 'Abrir cadastro',
      actionRoute: entityRoute,
      actions,
      dedupKey: `relationship-${a.entityType}-${a.entityId}-${day}`,
      createdAt: nowIso(),
    };
  });
}

// ==========================================
// Overflow risk → hoje
// ==========================================

function fromOverflowRisk(automationAlerts: PlanningAlert[]): NotificationInput[] {
  const overflow = automationAlerts.find(a => a.category === 'overflow_risk');
  if (!overflow) return [];
  const day = todayKey();

  return [{
    type: 'planning_overflow_risk',
    category: 'hoje',
    priority: severityToPriority(overflow.severity),
    title: overflow.title,
    message: overflow.description + ' ' + overflow.suggestedAction,
    actionLabel: 'Reorganizar dia',
    actionRoute: '/planejamento',
    actions: [
      { label: 'Reorganizar dia', route: '/planejamento', variant: 'primary' },
    ],
    dedupKey: `overflow-risk-${day}`,
    createdAt: nowIso(),
  }];
}

// ==========================================
// Meeting prep → hoje (meetings within next 2h without post_meeting task)
// ==========================================

function fromMeetingPrep(
  tasks: PlanningTask[],
  events: CalendarEvent[],
): NotificationInput[] {
  const now = new Date();
  const day = todayKey();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Check calendar events first
  const upcomingEvents = events.filter(e => {
    if (e.status === 'cancelled') return false;
    const start = new Date(e.start);
    return start > now && start <= twoHoursFromNow;
  });

  if (upcomingEvents.length === 0) return [];

  // Check which events have a related prep task (post_meeting or meeting type)
  const pendingTasks = tasks.filter(
    t => t.status !== 'completed' && t.status !== 'archived',
  );

  const result: NotificationInput[] = [];
  for (const event of upcomingEvents.slice(0, 2)) {
    // Does a task exist for this event?
    const hasPrep = pendingTasks.some(
      t => (t.type === 'meeting' || t.type === 'post_meeting') &&
        t.date === day &&
        (t.title.toLowerCase().includes(event.title.toLowerCase().slice(0, 15)) ||
         (t.linkedEntityName && event.title.toLowerCase().includes(t.linkedEntityName.toLowerCase()))),
    );

    // Only notify if there's NO preparation task
    if (hasPrep) continue;

    const startDate = new Date(event.start);
    const minutesUntil = Math.round((startDate.getTime() - now.getTime()) / 60000);

    result.push({
      type: 'planning_meeting_prep',
      category: 'hoje',
      priority: minutesUntil <= 30 ? 'high' : 'normal',
      title: `Reunião em ${minutesUntil}min: ${event.title}`,
      message: 'Sem tarefa de preparação identificada.',
      eventId: event.id,
      eventTitle: event.title,
      eventStart: event.start,
      actionLabel: 'Preparar reunião',
      actionRoute: '/planejamento',
      actions: [
        { label: 'Preparar reunião', route: '/planejamento', variant: 'primary' },
        { label: 'Ver agenda', route: '/agendas', variant: 'ghost' },
      ],
      dedupKey: `meeting-prep-${event.id}-${day}`,
      createdAt: nowIso(),
    });
  }

  return result;
}

// ==========================================
// Weekly pace behind → planejamento
// ==========================================

function fromWeeklyPace(weeklyPace: WeeklyPaceStatus | null): NotificationInput[] {
  if (!weeklyPace || weeklyPace.overall === 'on_track') return [];
  const day = todayKey();

  const behind = Object.values(weeklyPace.metrics).filter(m => m.status !== 'on_track');
  if (behind.length === 0) return [];

  const critical = behind.filter(m => m.status === 'critical');
  const labels = behind.slice(0, 3).map(m => `${m.label}: ${m.actual}/${m.target}`);

  return [{
    type: 'planning_pace_behind',
    category: 'planejamento',
    priority: critical.length > 0 ? 'high' : 'normal',
    title: `Ritmo semanal: ${behind.length} meta(s) atrasada(s)`,
    message: labels.join(' · '),
    actionLabel: 'Ver planejamento',
    actionRoute: '/planejamento',
    actions: [
      { label: 'Ver planejamento', route: '/planejamento', variant: 'primary' },
    ],
    dedupKey: `pace-behind-${day}`,
    createdAt: nowIso(),
  }];
}

// ==========================================
// Free slot suggestion → sugestoes (max 2)
// ==========================================

function fromFreeSlots(slots: FreeSlot[]): NotificationInput[] {
  // Only suggest high/medium priority slots
  const worthySlots = slots.filter(s => s.priority === 'high' || s.priority === 'medium');
  if (worthySlots.length === 0) return [];
  const day = todayKey();

  // Take up to 2 best slots, prefer high priority
  const sorted = [...worthySlots].sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  return sorted.slice(0, 2).map(slot => ({
    type: 'planning_free_slot' as const,
    category: 'sugestoes' as NotificationCategory,
    priority: (slot.priority === 'high' ? 'normal' : 'low') as NotificationPriority,
    title: `${slot.hour}h livre — ${slot.suggestion}`,
    message: slot.contextReason,
    actionLabel: slot.actionLabel,
    actionRoute: '/planejamento',
    actions: [
      { label: slot.actionLabel, route: '/planejamento', variant: 'primary' as const },
      { label: 'Criar bloco', route: '/planejamento', variant: 'ghost' as const },
    ],
    dedupKey: `free-slot-${slot.hour}-${day}`,
    createdAt: nowIso(),
  }));
}

// ==========================================
// Daily summary → planejamento (1 per day)
// ==========================================

function fromDailySummary(banner: SmartBannerData | null, todayTaskCount: number): NotificationInput[] {
  if (!banner) return [];
  const day = todayKey();

  // Only show if there's something meaningful
  if (todayTaskCount === 0 && banner.overdueCount === 0) return [];

  const parts: string[] = [];
  if (todayTaskCount > 0) parts.push(`${todayTaskCount} tarefa(s)`);
  if (banner.overdueCount > 0) parts.push(`${banner.overdueCount} atrasada(s)`);
  if (banner.maxPriorityCount > 0) parts.push(`${banner.maxPriorityCount} prioridade máxima`);
  if (banner.freeHours >= 2) parts.push(`${banner.freeHours}h livre(s)`);

  return [{
    type: 'planning_daily_summary',
    category: 'planejamento',
    priority: banner.overdueCount > 0 ? 'high' : 'normal',
    title: 'Resumo do dia',
    message: parts.join(' · '),
    actionLabel: 'Abrir planejamento',
    actionRoute: '/planejamento',
    actions: [
      { label: 'Abrir planejamento', route: '/planejamento', variant: 'primary' },
    ],
    dedupKey: `daily-summary-${day}`,
    createdAt: nowIso(),
  }];
}

// ==========================================
// Post-meeting reminder → hoje (meetings that ended without follow-up)
// ==========================================

function fromPostMeetingReminder(prompts: PostMeetingPrompt[]): NotificationInput[] {
  // Only notify about meetings that have NO post-meeting task yet
  const actionable = prompts.filter(p => !p.hasPostTask);
  if (actionable.length === 0) return [];
  const day = todayKey();

  // Take at most 2 most-recent meetings
  return actionable.slice(0, 2).map(prompt => {
    const hoursAgo = Math.round(prompt.minutesSinceEnd / 60);
    const timeLabel = hoursAgo >= 1 ? `há ${hoursAgo}h` : `há ${prompt.minutesSinceEnd}min`;

    return {
      type: 'planning_post_meeting' as const,
      category: 'hoje' as NotificationCategory,
      priority: (prompt.minutesSinceEnd > 120 ? 'high' : 'normal') as NotificationPriority,
      title: `Pós-reunião: ${prompt.eventTitle}`,
      message: `${prompt.meetingType} encerrou ${timeLabel}. Registre resumo e próximos passos.`,
      eventId: prompt.eventId,
      eventTitle: prompt.eventTitle,
      actionLabel: 'Registrar pós-reunião',
      actionRoute: '/planejamento',
      actions: [
        { label: 'Registrar pós-reunião', route: '/planejamento', variant: 'primary' as const },
      ],
      dedupKey: `post-meeting-${prompt.eventId}-${day}`,
      createdAt: nowIso(),
    };
  });
}

// ==========================================
// Main generator — combines all sources
// ==========================================

export interface PlanningNotificationInput {
  tasks: PlanningTask[];
  overdueFollowUpAlerts: OverdueFollowUp[];
  relationshipAlerts: RelationshipAlert[];
  automationAlerts: PlanningAlert[];
  freeSlots: FreeSlot[];
  smartBanner: SmartBannerData | null;
  todayTaskCount: number;
  weeklyPace: WeeklyPaceStatus | null;
  calendarEvents: CalendarEvent[];
  postMeetingPrompts: PostMeetingPrompt[];
}

/**
 * Generates all Planning notification candidates for the current day.
 * Returns NotificationInput[] with dedupKeys for preventing duplicates.
 * The caller is responsible for dedup against already-persisted notifications.
 *
 * Max output: ~10 notifications per cycle (hard-capped).
 */
export function generatePlanningNotifications(input: PlanningNotificationInput): NotificationInput[] {
  const all: NotificationInput[] = [
    // Urgente
    ...fromOverdueFollowUps(input.overdueFollowUpAlerts),
    ...fromRelationshipAlerts(input.relationshipAlerts),
    // Hoje
    ...fromOverdueTasks(input.tasks),
    ...fromOverflowRisk(input.automationAlerts),
    ...fromMeetingPrep(input.tasks, input.calendarEvents),
    ...fromPostMeetingReminder(input.postMeetingPrompts),
    // Sugestões
    ...fromFreeSlots(input.freeSlots),
    // Planejamento
    ...fromWeeklyPace(input.weeklyPace),
    ...fromDailySummary(input.smartBanner, input.todayTaskCount),
  ];

  // Hard cap to avoid noise
  return all.slice(0, 10);
}
