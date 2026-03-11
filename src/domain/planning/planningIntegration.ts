/**
 * Planning Integration Layer
 *
 * Connects the Planning module with other Advisor Control modules.
 * Provides utilities for linking tasks to existing entities and
 * preparing the architecture for future automation triggers.
 */

import type { PlanningTask, LinkedEntityType, TaskPriority, AlertThresholds, SuggestionThresholds, AutomationRulePreferences } from './planningTypes';
import { createDefaultTask } from './planningUtils';
import { DEFAULT_ALERT_THRESHOLDS, DEFAULT_SUGGESTION_THRESHOLDS, DEFAULT_RULE_PREFERENCES } from './planningConstants';
import type { CalendarEvent } from '../types/calendar';
import { getEffectiveMeetingType, MEETING_TYPE_LABELS } from '../types/calendar';

// ==========================================
// Entity routing helpers
// ==========================================

const ENTITY_ROUTE_MAP: Record<string, string> = {
  client: '/clientes',
  prospect: '/prospects',
  offer: '/ofertas',
  cross: '/cross',
  goal: '/metas',
};

/**
 * Entity types that support deep linking via `?open={id}` query param.
 * Clientes and Prospects pages handle this param to open entity details.
 */
const DEEP_LINK_SUPPORTED: Set<string> = new Set(['client', 'prospect']);

/**
 * Returns the route path for a given entity type.
 * If entityId is provided and the entity type supports deep linking,
 * appends `?open={entityId}` to navigate directly to the entity detail.
 */
export function getEntityRoute(entityType: LinkedEntityType, entityId?: string): string | null {
  const base = ENTITY_ROUTE_MAP[entityType] ?? null;
  if (!base) return null;
  if (entityId && DEEP_LINK_SUPPORTED.has(entityType)) {
    return `${base}?open=${encodeURIComponent(entityId)}`;
  }
  return base;
}

/**
 * Returns true if the given entity type supports deep linking by ID.
 */
export function supportsDeepLink(entityType: LinkedEntityType): boolean {
  return DEEP_LINK_SUPPORTED.has(entityType);
}

/**
 * Returns the full route path for a task's linked entity.
 * Uses deep link (with ?open=id) when supported, falls back to list page.
 * Returns null if the task has no linked entity or the entity type has no route.
 */
export function getTaskEntityRoute(task: PlanningTask): string | null {
  if (task.linkedEntityType === 'none' || !task.linkedEntityId) return null;
  return getEntityRoute(task.linkedEntityType, task.linkedEntityId);
}

// ==========================================
// Entity linking helpers
// ==========================================

export interface LinkedEntity {
  type: LinkedEntityType;
  id: string;
  name: string;
}

/**
 * Creates a pre-filled task linked to a client
 */
export function createTaskForClient(
  clientName: string,
  clientId: string,
  overrides: Partial<PlanningTask> = {},
): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return createDefaultTask({
    title: `Tarefa para ${clientName}`,
    origin: 'client',
    linkedEntityType: 'client',
    linkedEntityId: clientId,
    linkedEntityName: clientName,
    ...overrides,
  });
}

/**
 * Creates a follow-up task linked to a prospect
 */
export function createFollowUpForProspect(
  prospectName: string,
  prospectId: string,
  overrides: Partial<PlanningTask> = {},
): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return createDefaultTask({
    title: `Follow-up: ${prospectName}`,
    type: 'follow_up',
    origin: 'prospect',
    linkedEntityType: 'prospect',
    linkedEntityId: prospectId,
    linkedEntityName: prospectName,
    priority: 'high',
    ...overrides,
  });
}

/**
 * Creates a task linked to an offer
 */
export function createTaskForOffer(
  offerName: string,
  offerId: string,
  overrides: Partial<PlanningTask> = {},
): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return createDefaultTask({
    title: `Contato oferta: ${offerName}`,
    type: 'offer',
    origin: 'offer',
    linkedEntityType: 'offer',
    linkedEntityId: offerId,
    linkedEntityName: offerName,
    priority: 'high',
    ...overrides,
  });
}

/**
 * Creates a task linked to a cross selling opportunity
 */
export function createTaskForCross(
  clientName: string,
  crossId: string,
  product: string,
  overrides: Partial<PlanningTask> = {},
): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return createDefaultTask({
    title: `Cross: ${product} - ${clientName}`,
    type: 'offer',
    origin: 'cross',
    linkedEntityType: 'cross',
    linkedEntityId: crossId,
    linkedEntityName: `${clientName} - ${product}`,
    priority: 'medium',
    ...overrides,
  });
}

/**
 * Creates a prospecting block linked to a goal
 */
export function createProspectingBlockForGoal(
  goalDescription: string,
  goalId: string,
  overrides: Partial<PlanningTask> = {},
): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return createDefaultTask({
    title: `Prospecção para meta: ${goalDescription}`,
    type: 'prospecting',
    origin: 'goal',
    linkedEntityType: 'goal',
    linkedEntityId: goalId,
    linkedEntityName: goalDescription,
    priority: 'high',
    ...overrides,
  });
}

// ==========================================
// Automation trigger definitions (future use)
// ==========================================

/**
 * Defines the structure for future automation triggers.
 * These are not active yet but provide the foundation for
 * automatic task creation based on system events.
 */
export type AutomationTrigger =
  | 'meeting_created'        // When a meeting is scheduled -> create pre/post meeting tasks
  | 'prospect_idle'          // When a prospect has no contact for X days -> suggest follow-up
  | 'offer_pending'          // When an offer is pending contact -> create contact task
  | 'client_no_contact'      // When a client has no contact for X days -> suggest task
  | 'goal_behind'           // When a goal is behind target -> suggest prospecting block
  | 'cross_opportunity';     // When a cross opportunity is identified -> create task

export interface AutomationRule {
  trigger: AutomationTrigger;
  enabled: boolean;
  taskTemplate: Partial<PlanningTask>;
  description: string;
  priority: TaskPriority;
}

/**
 * Default automation rules (disabled by default).
 * Ready to be activated in future versions.
 */
export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    trigger: 'meeting_created',
    enabled: false,
    description: 'Criar tarefa de preparação e pós-reunião automaticamente',
    priority: 'medium',
    taskTemplate: {
      type: 'post_meeting',
      origin: 'system',
    },
  },
  {
    trigger: 'prospect_idle',
    enabled: false,
    description: 'Sugerir follow-up quando prospect está parado há mais de 7 dias',
    priority: 'high',
    taskTemplate: {
      type: 'follow_up',
      origin: 'system',
    },
  },
  {
    trigger: 'offer_pending',
    enabled: false,
    description: 'Criar tarefa de contato quando oferta está pendente',
    priority: 'high',
    taskTemplate: {
      type: 'offer',
      origin: 'system',
    },
  },
  {
    trigger: 'client_no_contact',
    enabled: false,
    description: 'Sugerir tarefa quando cliente sem contato há mais de 30 dias',
    priority: 'medium',
    taskTemplate: {
      type: 'general',
      origin: 'system',
    },
  },
  {
    trigger: 'goal_behind',
    enabled: false,
    description: 'Sugerir bloco de prospecção quando meta está atrasada',
    priority: 'max',
    taskTemplate: {
      type: 'prospecting',
      origin: 'system',
    },
  },
  {
    trigger: 'cross_opportunity',
    enabled: false,
    description: 'Criar tarefa quando oportunidade de cross é identificada',
    priority: 'medium',
    taskTemplate: {
      type: 'offer',
      origin: 'system',
    },
  },
];

// ==========================================
// Smart suggestions (simple rules for now)
// ==========================================

export interface PlanningSuggestion {
  id: string;
  type: 'action' | 'warning' | 'info';
  title: string;
  description: string;
  actionLabel?: string;
  taskTemplate?: Partial<PlanningTask>;
}

/**
 * Generates simple rule-based suggestions.
 * Can be extended with more sophisticated logic in the future.
 */
export function generateSuggestions(
  overdueFollowUps: number,
  freeHours: number,
  maxPriorityCount: number,
  pendingCount: number,
  thresholds: SuggestionThresholds = DEFAULT_SUGGESTION_THRESHOLDS,
): PlanningSuggestion[] {
  const suggestions: PlanningSuggestion[] = [];

  if (overdueFollowUps > 0) {
    suggestions.push({
      id: 'overdue-followups',
      type: 'warning',
      title: `${overdueFollowUps} follow-up(s) vencido(s)`,
      description: 'Revise e reagende os follow-ups pendentes para manter o pipeline ativo.',
      actionLabel: 'Ver pendências',
    });
  }

  if (freeHours >= thresholds.freeHoursForBlock) {
    suggestions.push({
      id: 'free-hours',
      type: 'info',
      title: `${freeHours}h livres disponíveis`,
      description: 'Considere criar um bloco de prospecção ou estudo para aproveitar o tempo.',
      actionLabel: 'Criar bloco',
      taskTemplate: {
        type: 'prospecting',
        origin: 'manual',
      },
    });
  }

  if (maxPriorityCount > 0) {
    suggestions.push({
      id: 'max-priority',
      type: 'action',
      title: `${maxPriorityCount} tarefa(s) de prioridade máxima`,
      description: 'Garanta que essas tarefas sejam concluídas hoje.',
    });
  }

  if (pendingCount > thresholds.highPendingLimit) {
    suggestions.push({
      id: 'high-pending',
      type: 'warning',
      title: `${pendingCount} tarefas pendentes acumuladas`,
      description: 'Considere revisar e priorizar as pendências para evitar acúmulo.',
      actionLabel: 'Ver pendências',
    });
  }

  return suggestions;
}

// ==========================================
// Derived impact & priority helpers (Etapa 9)
// ==========================================

/** Commercial impact classification for a task. */
export type DerivedImpact = 'revenue' | 'relationship' | 'operational' | 'pipeline';

/** Priority levels that the system can assign automatically. */
export type DerivedPriority = 'critical' | 'high' | 'normal' | 'low';

/** Alert categories for future automation. */
export type AlertCategory =
  | 'overdue_followup'
  | 'idle_prospect'
  | 'pending_offer'
  | 'client_no_contact'
  | 'goal_behind'
  | 'cross_opportunity'
  | 'overflow_risk'
  | 'empty_day';

/** Structured alert for the notification/automation layer. */
export interface PlanningAlert {
  id: string;
  category: AlertCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  entityType?: LinkedEntityType;
  entityId?: string;
  entityName?: string;
  relatedTaskIds: string[];
  suggestedAction: string;
  suggestedTaskTemplate?: Partial<PlanningTask>;
  createdAt: string;
  dismissed: boolean;
}

/** Opportunity detected by rule-based analysis. */
export interface PlanningOpportunity {
  id: string;
  type: 'prospecting' | 'cross_sell' | 'upsell' | 'reactivation' | 'review';
  title: string;
  description: string;
  estimatedImpact: DerivedImpact;
  entityType?: LinkedEntityType;
  entityId?: string;
  entityName?: string;
  suggestedTaskTemplate?: Partial<PlanningTask>;
}

/**
 * Derives the commercial impact of a task.
 */
export function deriveDerivedImpact(task: PlanningTask): DerivedImpact {
  // Pipeline: prospecting, offers
  if (task.type === 'prospecting' || task.type === 'offer') return 'pipeline';
  // Revenue: meetings, portfolio reviews linked to entities
  if (
    (task.type === 'meeting' || task.type === 'portfolio_review') &&
    task.linkedEntityType !== 'none'
  ) {
    return 'revenue';
  }
  // Relationship: follow-ups, calls, linked to clients
  if (
    task.type === 'follow_up' ||
    task.type === 'call' ||
    task.linkedEntityType === 'client'
  ) {
    return 'relationship';
  }
  return 'operational';
}

/**
 * Derives a system priority based on task context (date, type, entity).
 * Uses heuristics beyond the user-assigned priority.
 */
export function derivePriority(task: PlanningTask, today: string): DerivedPriority {
  // Critical: overdue + max/high user priority
  if (
    task.date < today &&
    (task.priority === 'max' || task.priority === 'high')
  ) {
    return 'critical';
  }
  // Critical: overdue follow-up linked to entity
  if (
    task.date < today &&
    task.type === 'follow_up' &&
    task.linkedEntityType !== 'none'
  ) {
    return 'critical';
  }
  // High: today + max priority
  if (task.date === today && task.priority === 'max') return 'high';
  // High: overdue anything
  if (task.date < today) return 'high';
  // Normal: today
  if (task.date === today) return 'normal';
  return 'low';
}

/**
 * Scans tasks and generates structured alerts for the automation layer.
 * This is a pure function that can be called by hooks or workers.
 */
export function scanForAlerts(
  tasks: PlanningTask[],
  today: string,
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
  rulePrefs: AutomationRulePreferences = DEFAULT_RULE_PREFERENCES,
): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];
  const pending = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'archived',
  );

  // Overdue follow-ups
  const overdueFollowUps = pending.filter(
    (t) => t.type === 'follow_up' && t.date < today,
  );
  if (overdueFollowUps.length > 0) {
    alerts.push({
      id: `alert-overdue-followups-${today}`,
      category: 'overdue_followup',
      severity: overdueFollowUps.length >= 3 ? 'critical' : 'high',
      title: `${overdueFollowUps.length} follow-up(s) vencido(s)`,
      description: 'Contatos podem esfriar sem ação imediata.',
      relatedTaskIds: overdueFollowUps.map((t) => t.id!).filter(Boolean),
      suggestedAction: 'Reagendar ou fazer contato hoje',
      createdAt: today,
      dismissed: false,
    });
  }

  // Idle prospects (using configurable threshold)
  if (rulePrefs.prospect_idle.enabled) {
    const idleDays = thresholds.prospectIdleDays;
    const idleProspects = pending.filter(
      (t) =>
        t.linkedEntityType === 'prospect' &&
        t.date < today &&
        new Date(today).getTime() - new Date(t.date).getTime() > idleDays * 86400000,
    );
    if (idleProspects.length > 0) {
      const uniqueProspects = [...new Set(idleProspects.map((t) => t.linkedEntityName))];
      alerts.push({
        id: `alert-idle-prospects-${today}`,
        category: 'idle_prospect',
        severity: 'high',
        title: `${uniqueProspects.length} prospect(s) sem contato há >${idleDays} dias`,
        description: uniqueProspects.slice(0, 3).join(', '),
        relatedTaskIds: idleProspects.map((t) => t.id!).filter(Boolean),
        suggestedAction: 'Agendar follow-up imediatamente',
        createdAt: today,
        dismissed: false,
      });
    }
  }

  // Pending offers
  if (rulePrefs.offer_pending.enabled) {
    const pendingOffers = pending.filter(
      (t) => t.type === 'offer' && t.date <= today,
    );
    if (pendingOffers.length > 0) {
      alerts.push({
        id: `alert-pending-offers-${today}`,
        category: 'pending_offer',
        severity: 'medium',
        title: `${pendingOffers.length} oferta(s) com ação pendente`,
        description: pendingOffers.slice(0, 2).map((t) => t.linkedEntityName || t.title).join(', '),
        relatedTaskIds: pendingOffers.map((t) => t.id!).filter(Boolean),
        suggestedAction: 'Fazer contato ou atualizar status',
        createdAt: today,
        dismissed: false,
      });
    }
  }

  // Overflow risk (configurable threshold)
  const todayTasks = pending.filter((t) => t.date === today);
  if (todayTasks.length > thresholds.overflowTaskLimit) {
    alerts.push({
      id: `alert-overflow-risk-${today}`,
      category: 'overflow_risk',
      severity: 'medium',
      title: `${todayTasks.length} tarefas agendadas para hoje`,
      description: 'Risco de transbordo alto. Considere redistribuir.',
      relatedTaskIds: todayTasks.map((t) => t.id!).filter(Boolean),
      suggestedAction: 'Reagendar tarefas de menor prioridade',
      createdAt: today,
      dismissed: false,
    });
  }

  // High-priority tasks without scheduled time
  const highNoTime = todayTasks.filter(
    (t) =>
      (t.priority === 'max' || t.priority === 'high') &&
      !t.startTime &&
      t.status !== 'completed',
  );
  if (highNoTime.length > 0) {
    alerts.push({
      id: `alert-high-no-time-${today}`,
      category: 'overflow_risk',
      severity: 'medium',
      title: `${highNoTime.length} tarefa(s) importante(s) sem horário`,
      description: highNoTime.slice(0, 2).map((t) => t.title).join(', '),
      relatedTaskIds: highNoTime.map((t) => t.id!).filter(Boolean),
      suggestedAction: 'Agendar horário para garantir execução',
      createdAt: today,
      dismissed: false,
    });
  }

  // Empty day — no pending tasks for today
  if (todayTasks.length === 0 && pending.length > 0) {
    alerts.push({
      id: `alert-empty-day-${today}`,
      category: 'empty_day',
      severity: 'low',
      title: 'Dia sem tarefas agendadas',
      description: `Há ${pending.length} tarefa(s) pendente(s) que podem ser encaixadas.`,
      relatedTaskIds: [],
      suggestedAction: 'Agendar tarefas pendentes ou criar prospecção',
      createdAt: today,
      dismissed: false,
    });
  }

  // Client with no contact (configurable threshold)
  if (rulePrefs.client_no_contact.enabled) {
    const contactDays = thresholds.clientNoContactDays;
    const clientNoContact = pending.filter(
      (t) =>
        t.linkedEntityType === 'client' &&
        t.date < today &&
        new Date(today).getTime() - new Date(t.date).getTime() > contactDays * 86400000,
    );
    if (clientNoContact.length > 0) {
      const uniqueClients = [...new Set(clientNoContact.map((t) => t.linkedEntityName))];
      alerts.push({
        id: `alert-client-no-contact-${today}`,
        category: 'client_no_contact',
        severity: 'medium',
        title: `${uniqueClients.length} cliente(s) sem contato há >${contactDays} dias`,
        description: uniqueClients.slice(0, 3).join(', '),
        relatedTaskIds: clientNoContact.map((t) => t.id!).filter(Boolean),
        suggestedAction: 'Entrar em contato para manter relacionamento',
        createdAt: today,
        dismissed: false,
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Scans tasks and identifies commercial opportunities.
 */
export function scanForOpportunities(
  tasks: PlanningTask[],
  today: string,
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
): PlanningOpportunity[] {
  const opportunities: PlanningOpportunity[] = [];
  const pending = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'archived',
  );

  // Clients with meetings but no follow-up scheduled
  const clientMeetings = pending.filter(
    (t) => t.type === 'meeting' && t.linkedEntityType === 'client',
  );
  const clientFollowUps = pending.filter(
    (t) => t.type === 'follow_up' && t.linkedEntityType === 'client',
  );
  const clientsWithMeetingNoFollowUp = clientMeetings.filter(
    (m) => !clientFollowUps.some((f) => f.linkedEntityId === m.linkedEntityId),
  );
  for (const meeting of clientsWithMeetingNoFollowUp.slice(0, 3)) {
    opportunities.push({
      id: `opp-meeting-followup-${meeting.id}`,
      type: 'review',
      title: `Agendar follow-up pós-reunião com ${meeting.linkedEntityName}`,
      description: 'Cliente tem reunião mas nenhum follow-up agendado.',
      estimatedImpact: 'relationship',
      entityType: 'client',
      entityId: meeting.linkedEntityId,
      entityName: meeting.linkedEntityName,
      suggestedTaskTemplate: {
        type: 'follow_up',
        origin: 'client',
        linkedEntityType: 'client',
        linkedEntityId: meeting.linkedEntityId,
        linkedEntityName: meeting.linkedEntityName,
        priority: 'high',
      },
    });
  }

  // Prospects with high-priority tasks (upsell potential)
  const prospectHighPriority = pending.filter(
    (t) =>
      t.linkedEntityType === 'prospect' &&
      (t.priority === 'max' || t.priority === 'high') &&
      t.date <= today,
  );
  if (prospectHighPriority.length > 0) {
    const names = [...new Set(prospectHighPriority.map((t) => t.linkedEntityName))];
    opportunities.push({
      id: `opp-prospect-conversion-${today}`,
      type: 'prospecting',
      title: `${names.length} prospect(s) de alta prioridade para ação`,
      description: names.slice(0, 3).join(', '),
      estimatedImpact: 'pipeline',
    });
  }

  // Cross-sell opportunities (tasks linked to 'cross' entity)
  const crossTasks = pending.filter(
    (t) => t.linkedEntityType === 'cross' && t.date <= today,
  );
  if (crossTasks.length > 0) {
    opportunities.push({
      id: `opp-cross-sell-${today}`,
      type: 'cross_sell',
      title: `${crossTasks.length} oportunidade(s) de cross selling`,
      description: crossTasks.slice(0, 2).map((t) => t.linkedEntityName || t.title).join(', '),
      estimatedImpact: 'revenue',
    });
  }

  // Overdue tasks that could be reactivated
  const overduePending = pending.filter(
    (t) => t.date < today && t.type !== 'follow_up',
  );
  if (overduePending.length >= thresholds.reactivationThreshold) {
    opportunities.push({
      id: `opp-reactivation-${today}`,
      type: 'reactivation',
      title: `${overduePending.length} tarefa(s) atrasada(s) para revisão`,
      description: 'Reagendar ou concluir pode liberar espaço para novas oportunidades.',
      estimatedImpact: 'operational',
    });
  }

  return opportunities;
}

// ==========================================
// Meeting preparation & post-meeting suggestions
// ==========================================

export type MeetingSuggestionKind = 'preparation' | 'post_meeting';

export interface MeetingSuggestion {
  id: string;
  kind: MeetingSuggestionKind;
  eventId: string;
  eventTitle: string;
  meetingTypeLabel: string;
  meetingColor: string;
  /** HH:mm of the meeting start */
  eventTime: string;
  title: string;
  description: string;
  taskTemplate: Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
}

/**
 * Generates preparation and post-meeting task suggestions from today's agenda events.
 * Checks existing tasks to avoid duplicating suggestions that were already created.
 */
export function generateMeetingSuggestions(
  todayEvents: CalendarEvent[],
  existingTasks: PlanningTask[],
  todayDate: string,
): MeetingSuggestion[] {
  const suggestions: MeetingSuggestion[] = [];

  for (const event of todayEvents) {
    if (event.status === 'cancelled') continue;

    const mType = getEffectiveMeetingType(event);
    const mLabel = MEETING_TYPE_LABELS[mType];
    const priority: TaskPriority = mType === 'R1' || mType === 'R2' ? 'high' : 'medium';

    let eventStartTime = '';
    let eventEndTime = '';
    try {
      const startD = new Date(event.start);
      eventStartTime = `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`;
      if (event.end) {
        const endD = new Date(event.end);
        eventEndTime = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
      }
    } catch {
      // skip events with bad dates
      continue;
    }

    const eventId = event.id ?? event.googleEventId ?? event.title;

    // Check if a preparation task already exists for this event
    const hasPrepTask = existingTasks.some(
      (t) =>
        t.origin === 'agenda' &&
        (t.type === 'meeting' || t.type === 'post_meeting') &&
        t.title.includes(event.title) &&
        t.title.startsWith('Preparar'),
    );

    if (!hasPrepTask) {
      // Compute preparation time: 30 min before the event
      let prepTime = '';
      if (eventStartTime) {
        const [h, m] = eventStartTime.split(':').map(Number);
        const totalMin = h * 60 + m - 30;
        if (totalMin >= 0) {
          prepTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
        }
      }

      suggestions.push({
        id: `prep-${eventId}`,
        kind: 'preparation',
        eventId: eventId!,
        eventTitle: event.title,
        meetingTypeLabel: mLabel,
        meetingColor: getMeetingColor(mType),
        eventTime: eventStartTime,
        title: `Preparar: ${event.title}`,
        description: `Revisar informações antes da reunião (${mLabel}) às ${eventStartTime}`,
        taskTemplate: createDefaultTask({
          title: `Preparar: ${event.title}`,
          type: 'meeting',
          origin: 'agenda',
          date: todayDate,
          startTime: prepTime,
          endTime: eventStartTime,
          durationMinutes: 30,
          priority,
          notes: `Preparação para ${mLabel}: ${event.title}${event.attendees ? `\nParticipantes: ${event.attendees}` : ''}${event.location ? `\nLocal: ${event.location}` : ''}`,
        }),
      });
    }

    // Check if a post-meeting task already exists for this event
    const hasPostTask = existingTasks.some(
      (t) =>
        t.origin === 'agenda' &&
        t.type === 'post_meeting' &&
        t.title.includes(event.title),
    );

    if (!hasPostTask) {
      suggestions.push({
        id: `post-${eventId}`,
        kind: 'post_meeting',
        eventId: eventId!,
        eventTitle: event.title,
        meetingTypeLabel: mLabel,
        meetingColor: getMeetingColor(mType),
        eventTime: eventStartTime,
        title: `Pós-reunião: ${event.title}`,
        description: `Registrar próximos passos e follow-ups após ${mLabel}`,
        taskTemplate: createDefaultTask({
          title: `Pós-reunião: ${event.title}`,
          type: 'post_meeting',
          origin: 'agenda',
          date: todayDate,
          startTime: eventEndTime,
          endTime: '',
          durationMinutes: 15,
          priority,
          notes: `Registrar próximos passos da reunião ${mLabel}: ${event.title}${event.attendees ? `\nParticipantes: ${event.attendees}` : ''}`,
        }),
      });
    }
  }

  return suggestions;
}

function getMeetingColor(mType: string): string {
  const colors: Record<string, string> = {
    R1: '#3B82F6',
    R2: '#10B981',
    acompanhamento: '#3B82F6',
    areas_cross: '#8B5CF6',
    outro: '#6B7280',
  };
  return colors[mType] ?? '#6B7280';
}
