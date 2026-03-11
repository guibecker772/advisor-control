/**
 * Planning Intelligence Layer
 *
 * Rule-based intelligence for the Planning module.
 * Provides smart suggestions, priority ranking, action recommendations,
 * and commercial radar data based on task/block state.
 */

import type { PlanningTask, PlanningBlock, TaskPriority, WeeklyPaceGoals, WeeklyPaceMetric, WeeklyPaceStatus } from './planningTypes';
import { PRIORITY_ORDER, TIMELINE_START_HOUR, TIMELINE_END_HOUR, DEFAULT_WEEKLY_PACE_GOALS, WEEKLY_PACE_LABELS } from './planningConstants';
import {
  todayString,
  filterTasksForDate,
  filterBlocksForDate,
  filterOverdueTasks,
  filterPendingTasks,
  filterWeekTasks,
  filterWeekBlocks,
  calculateDurationMinutes,
  getWeekKey,
} from './planningUtils';
import type { CalendarEvent } from '../types/calendar';
import { getEffectiveMeetingType, MEETING_TYPE_COLORS, MEETING_TYPE_LABELS } from '../types/calendar';

// ==========================================
// Types
// ==========================================

export interface NextAction {
  task: PlanningTask;
  reason: string;
  reasonShort: string;
  impactType: 'revenue' | 'relationship' | 'operational' | 'pipeline';
}

export interface RankedPriority {
  task: PlanningTask;
  score: number;
  reason: string;
}

export interface EntityAlert {
  entityName: string;
  entityType: 'client' | 'prospect' | 'offer' | 'cross' | 'goal';
  entityId: string;
  reason: string;
  suggestedAction: string;
  relatedTasks: PlanningTask[];
  severity: 'high' | 'medium' | 'low';
}

export interface RadarItem {
  type: 'opportunity' | 'risk';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  linkedTaskId?: string;
}

export interface FreeSlot {
  hour: number;
  suggestion: string;
  category: 'prospecting' | 'follow_up' | 'review' | 'admin' | 'study';
  /** Visual priority — drives emphasis in the timeline. */
  priority: 'high' | 'medium' | 'low';
  /** Short CTA label for the primary action button. */
  actionLabel: string;
  /** Task type to pre-fill when creating a task from this slot. */
  taskType: PlanningTask['type'];
  /** Block category to pre-fill when creating a block from this slot. */
  blockCategory: PlanningBlock['category'];
  /** Short context explanation (why this suggestion). */
  contextReason: string;
}

export interface SmartBannerData {
  greeting: string;
  freeHours: number;
  overdueFollowUps: number;
  overdueCount: number;
  maxPriorityCount: number;
  bestOpportunity: string;
  message: string;
}

/** Overdue follow-up with escalated priority and context. */
export interface OverdueFollowUp {
  task: PlanningTask;
  daysOverdue: number;
  escalatedPriority: TaskPriority;
  severity: 'critical' | 'high' | 'medium';
  reason: string;
}

/** Alert for client without recent contact or prospect going cold. */
export interface RelationshipAlert {
  entityType: 'client' | 'prospect';
  entityId: string;
  entityName: string;
  alertType: 'client_no_contact' | 'prospect_cooling';
  daysSinceContact: number;
  lastContactDate: string;
  severity: 'critical' | 'high' | 'medium';
  reason: string;
  suggestedAction: string;
  /** The most recent task for this entity (for context). */
  latestTask: PlanningTask;
}

/** Configurable thresholds for relationship alerts. */
export interface RelationshipAlertThresholds {
  /** Days without contact before client alert fires (default 14). */
  clientNoContactDays: number;
  /** Days without contact before prospect cooling alert fires (default 7). */
  prospectCoolingDays: number;
}

/** Contextual focus suggestion based on the day’s schedule. */
export interface FocusSuggestion {
  /** Short label for the suggestion (e.g. "Prospecção"). */
  label: string;
  /** Explanation of why this is suggested now. */
  reason: string;
  /** Recommended duration in minutes. */
  durationMinutes: number;
  /** Category of the suggested activity. */
  category: 'prospecting' | 'follow_up' | 'review' | 'admin' | 'deep_work' | 'general';
  /** Visual priority level. */
  priority: 'high' | 'medium' | 'low';
}

/** Prompt shown after a meeting ends, promoting continuity actions. */
export interface PostMeetingPrompt {
  eventId: string;
  eventTitle: string;
  meetingType: string;
  meetingColor: string;
  startTime: string;
  endTime: string;
  attendees: string;
  /** Minutes since the meeting ended. */
  minutesSinceEnd: number;
  /** Whether a post-meeting task already exists for this event. */
  hasPostTask: boolean;
}

// ==========================================
// Next Action ("O que fazer agora")
// ==========================================

export function computeNextAction(
  tasks: PlanningTask[],
  _blocks: PlanningBlock[],
): NextAction | null {
  const today = todayString();
  const pending = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'archived',
  );

  // 1. Overdue max priority
  const overdueMax = pending
    .filter((t) => t.date < today && t.priority === 'max')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (overdueMax.length > 0) {
    return {
      task: overdueMax[0],
      reason: 'Tarefa atrasada com prioridade máxima. Resolva antes de qualquer outra ação.',
      reasonShort: 'Atrasada · Prioridade máxima',
      impactType: 'revenue',
    };
  }

  // 2. Overdue follow-ups
  const overdueFollowUps = pending
    .filter((t) => t.date < today && t.type === 'follow_up')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (overdueFollowUps.length > 0) {
    return {
      task: overdueFollowUps[0],
      reason: 'Follow-up vencido. Contato pode esfriar se não for feito hoje.',
      reasonShort: 'Follow-up vencido',
      impactType: 'relationship',
    };
  }

  // 3. Today's max/high priority not completed
  const todayHighPriority = pending
    .filter(
      (t) =>
        t.date === today &&
        (t.priority === 'max' || t.priority === 'high'),
    )
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  if (todayHighPriority.length > 0) {
    return {
      task: todayHighPriority[0],
      reason: `Tarefa de ${todayHighPriority[0].priority === 'max' ? 'prioridade máxima' : 'alta prioridade'} agendada para hoje.`,
      reasonShort: todayHighPriority[0].priority === 'max' ? 'Prioridade máxima · Hoje' : 'Alta prioridade · Hoje',
      impactType: todayHighPriority[0].linkedEntityType !== 'none' ? 'pipeline' : 'operational',
    };
  }

  // 4. Linked entity tasks (have commercial context)
  const linkedTasks = pending
    .filter((t) => t.date <= today && t.linkedEntityType !== 'none')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  if (linkedTasks.length > 0) {
    return {
      task: linkedTasks[0],
      reason: `Tarefa vinculada a ${linkedTasks[0].linkedEntityName || 'entidade'} que exige ação.`,
      reasonShort: `Ação pendente · ${linkedTasks[0].linkedEntityName || 'Vínculo'}`,
      impactType: 'pipeline',
    };
  }

  // 5. Any pending task for today
  const todayPending = pending
    .filter((t) => t.date === today)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  if (todayPending.length > 0) {
    return {
      task: todayPending[0],
      reason: 'Próxima tarefa pendente do dia.',
      reasonShort: 'Próxima do dia',
      impactType: 'operational',
    };
  }

  return null;
}

// ==========================================
// Top 5 Priorities (ranked scoring)
// ==========================================

function scoreTask(task: PlanningTask, today: string): number {
  let score = 0;

  // Priority weight (max=40, high=30, medium=15, low=5)
  const priorityScores: Record<TaskPriority, number> = { max: 40, high: 30, medium: 15, low: 5 };
  score += priorityScores[task.priority];

  // Overdue bonus
  if (task.date < today) score += 25;

  // Follow-up bonus
  if (task.type === 'follow_up') score += 10;

  // *** Overdue follow-up escalation: significant boost ***
  if (task.type === 'follow_up' && task.date < today) {
    const daysOverdue = Math.floor(
      (new Date(today).getTime() - new Date(task.date).getTime()) / 86400000,
    );
    // +15 base for any overdue follow-up, +3 per extra day (capped at +30)
    score += 15 + Math.min(daysOverdue * 3, 30);
    // Linked entity overdue follow-up: extra +10 (relationship at risk)
    if (task.linkedEntityType !== 'none') score += 10;
  }

  // Linked entity bonus
  if (task.linkedEntityType !== 'none') score += 10;

  // Today bonus
  if (task.date === today) score += 15;

  // Offer/prospecting bonus (commercial impact)
  if (task.type === 'offer' || task.type === 'prospecting') score += 8;

  return score;
}

export function computeTop5Priorities(tasks: PlanningTask[]): RankedPriority[] {
  const today = todayString();
  const pending = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      t.date <= today,
  );

  const scored = pending.map((task) => {
    const score = scoreTask(task, today);
    let reason = '';
    if (task.date < today) reason = 'Atrasada';
    else if (task.priority === 'max') reason = 'Prioridade máxima';
    else if (task.priority === 'high') reason = 'Alta prioridade';
    else if (task.type === 'follow_up') reason = 'Follow-up';
    else reason = 'Pendente hoje';

    if (task.linkedEntityName) {
      reason += ` · ${task.linkedEntityName}`;
    }

    return { task, score, reason };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ==========================================
// Entity Alerts ("Exigem ação hoje")
// ==========================================

export function computeEntityAlerts(tasks: PlanningTask[]): EntityAlert[] {
  const today = todayString();
  const pending = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      t.linkedEntityType !== 'none' &&
      t.linkedEntityId,
  );

  // Group by entity
  const entityMap = new Map<string, { tasks: PlanningTask[]; name: string; type: string; id: string }>();
  for (const task of pending) {
    const key = `${task.linkedEntityType}:${task.linkedEntityId}`;
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        tasks: [],
        name: task.linkedEntityName || 'Sem nome',
        type: task.linkedEntityType,
        id: task.linkedEntityId,
      });
    }
    entityMap.get(key)!.tasks.push(task);
  }

  const alerts: EntityAlert[] = [];

  for (const [, entity] of entityMap) {
    const overdueTasks = entity.tasks.filter((t) => t.date < today);
    const todayTasks = entity.tasks.filter((t) => t.date === today);
    const hasFollowUp = entity.tasks.some((t) => t.type === 'follow_up');
    const hasMaxPriority = entity.tasks.some((t) => t.priority === 'max' || t.priority === 'high');

    let reason = '';
    let suggestedAction = '';
    let severity: EntityAlert['severity'] = 'medium';

    if (overdueTasks.length > 0 && hasFollowUp) {
      reason = `Follow-up vencido há ${overdueTasks.length > 1 ? `${overdueTasks.length} itens` : '1 item'}`;
      suggestedAction = 'Fazer contato ou reagendar';
      severity = 'high';
    } else if (overdueTasks.length > 0) {
      reason = `${overdueTasks.length} tarefa(s) atrasada(s)`;
      suggestedAction = 'Resolver pendências ou reagendar';
      severity = 'high';
    } else if (todayTasks.length > 0 && hasMaxPriority) {
      reason = 'Tarefa de alta prioridade para hoje';
      suggestedAction = 'Priorizar execução';
      severity = 'high';
    } else if (todayTasks.length > 0) {
      reason = `${todayTasks.length} tarefa(s) agendada(s) para hoje`;
      suggestedAction = 'Executar conforme planejado';
      severity = 'medium';
    } else {
      reason = `${entity.tasks.length} tarefa(s) pendente(s)`;
      suggestedAction = 'Revisar e priorizar';
      severity = 'low';
    }

    if (severity === 'low' && !hasMaxPriority) continue; // Only show relevant alerts

    alerts.push({
      entityName: entity.name,
      entityType: entity.type as EntityAlert['entityType'],
      entityId: entity.id,
      reason,
      suggestedAction,
      relatedTasks: entity.tasks,
      severity,
    });
  }

  return alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ==========================================
// Commercial Radar
// ==========================================

export function computeRadar(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  weeklyPace?: WeeklyPaceStatus | null,
): RadarItem[] {
  const today = todayString();
  const items: RadarItem[] = [];
  const pending = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'archived',
  );

  // High-priority follow-ups with commercial potential
  const commercialFollowUps = pending.filter(
    (t) =>
      t.type === 'follow_up' &&
      (t.priority === 'max' || t.priority === 'high') &&
      t.linkedEntityType !== 'none',
  );
  if (commercialFollowUps.length > 0) {
    items.push({
      type: 'opportunity',
      title: `${commercialFollowUps.length} follow-up(s) com potencial comercial`,
      description: commercialFollowUps
        .slice(0, 2)
        .map((t) => t.linkedEntityName || t.title)
        .join(', '),
      severity: 'high',
      linkedTaskId: commercialFollowUps[0].id,
    });
  }

  // Overdue follow-ups per entity (relationship risk)
  const overdueFollowUps = pending.filter(
    (t) => t.type === 'follow_up' && t.date < today && t.linkedEntityType !== 'none',
  );
  const overdueByEntity = new Map<string, PlanningTask[]>();
  for (const fu of overdueFollowUps) {
    const key = fu.linkedEntityName || fu.title;
    if (!overdueByEntity.has(key)) overdueByEntity.set(key, []);
    overdueByEntity.get(key)!.push(fu);
  }
  for (const [entityName, fuTasks] of overdueByEntity) {
    const oldestDate = fuTasks.reduce((min, t) => (t.date < min ? t.date : min), fuTasks[0].date);
    const daysOverdue = Math.floor(
      (new Date(today).getTime() - new Date(oldestDate).getTime()) / 86400000,
    );
    items.push({
      type: 'risk',
      title: `Follow-up vencido: ${entityName}`,
      description: `Sem retorno há ${daysOverdue} dia(s). Risco de perder engajamento.`,
      severity: daysOverdue >= 7 ? 'high' : 'medium',
      linkedTaskId: fuTasks[0].id,
    });
  }

  // Overdue linked tasks (risk of losing relationship)
  const overdueLinked = pending.filter(
    (t) => t.date < today && t.linkedEntityType !== 'none',
  );
  if (overdueLinked.length > 0) {
    items.push({
      type: 'risk',
      title: `${overdueLinked.length} ação(ões) atrasada(s) com vínculo`,
      description: 'Clientes ou prospects podem perder engajamento.',
      severity: 'high',
    });
  }

  // Free blocks that could be used for prospecting
  const todayBlocks = filterBlocksForDate(blocks, today);
  const todayTasks = filterTasksForDate(tasks, today);
  const totalWorkMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  let busyMinutes = 0;
  for (const t of todayTasks) {
    if (t.startTime && t.endTime) busyMinutes += calculateDurationMinutes(t.startTime, t.endTime);
  }
  for (const b of todayBlocks) {
    if (b.startTime && b.endTime) busyMinutes += calculateDurationMinutes(b.startTime, b.endTime);
  }
  const freeHours = Math.round(((totalWorkMinutes - busyMinutes) / 60) * 10) / 10;

  if (freeHours >= 2) {
    const hasProspecting = todayBlocks.some((b) => b.category === 'prospecting') ||
      todayTasks.some((t) => t.type === 'prospecting');
    if (!hasProspecting) {
      items.push({
        type: 'opportunity',
        title: `${freeHours}h livres sem bloco de prospecção`,
        description: 'Considere usar tempo livre para prospectar novos clientes.',
        severity: 'medium',
      });
    }
  }

  // Offers with pending action — split by severity
  const pendingOffers = pending.filter(
    (t) => t.type === 'offer' && t.date <= today,
  );
  const overdueOffers = pendingOffers.filter((t) => t.date < today);
  const todayOffers = pendingOffers.filter((t) => t.date === today);

  if (overdueOffers.length > 0) {
    const oldestDate = overdueOffers.reduce((min, t) => (t.date < min ? t.date : min), overdueOffers[0].date);
    const daysOverdue = Math.floor((new Date(today).getTime() - new Date(oldestDate).getTime()) / 86400000);
    items.push({
      type: 'risk',
      title: `${overdueOffers.length} oferta(s) com ação atrasada`,
      description: `Pendente há até ${daysOverdue} dia(s). ${overdueOffers.slice(0, 2).map((t) => t.linkedEntityName || t.title).join(', ')}`,
      severity: daysOverdue >= 5 ? 'high' : 'medium',
      linkedTaskId: overdueOffers[0].id,
    });
  }
  if (todayOffers.length > 0) {
    items.push({
      type: 'opportunity',
      title: `${todayOffers.length} oferta(s) para abordar hoje`,
      description: todayOffers.slice(0, 2).map((t) => t.linkedEntityName || t.title).join(', '),
      severity: 'medium',
      linkedTaskId: todayOffers[0].id,
    });
  }

  // Offers without follow-up
  const offerEntities = new Set(
    pendingOffers.filter((t) => t.linkedEntityId).map((t) => t.linkedEntityId),
  );
  const followUpEntities = new Set(
    pending.filter((t) => t.type === 'follow_up' && t.linkedEntityId).map((t) => t.linkedEntityId),
  );
  const offersNoFollowUp = [...offerEntities].filter((id) => !followUpEntities.has(id));
  if (offersNoFollowUp.length > 0) {
    items.push({
      type: 'opportunity',
      title: `${offersNoFollowUp.length} oferta(s) sem follow-up`,
      description: 'Crie follow-ups para garantir acompanhamento comercial.',
      severity: 'medium',
    });
  }

  // Weekly pace signals
  if (weeklyPace && weeklyPace.overall !== 'on_track') {
    const behind = Object.values(weeklyPace.metrics).filter((m) => m.status !== 'on_track');
    for (const m of behind) {
      items.push({
        type: 'risk',
        title: `${m.label}: ${m.actual}/${m.target} na semana`,
        description: `Meta semanal atrasada — faltam ${m.behindBy} para o ritmo de ${getDayName(weeklyPace.dayOfWeek)}.`,
        severity: m.status === 'critical' ? 'high' : 'medium',
      });
    }
  }

  return items;
}

// ==========================================
// Free Slot Suggestions
// ==========================================

export function computeFreeSlotSuggestions(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  weeklyPace?: WeeklyPaceStatus | null,
): FreeSlot[] {
  const today = todayString();
  const todayTasks = filterTasksForDate(tasks, today);
  const todayBlocks = filterBlocksForDate(blocks, today);
  const pendingAll = filterPendingTasks(tasks);
  const overdue = filterOverdueTasks(tasks);

  const busyHours = new Set<number>();
  for (const t of todayTasks) {
    if (t.startTime) {
      const hour = parseInt(t.startTime.split(':')[0], 10);
      busyHours.add(hour);
    }
  }
  for (const b of todayBlocks) {
    if (b.startTime) {
      const hour = parseInt(b.startTime.split(':')[0], 10);
      busyHours.add(hour);
    }
  }

  // Context signals
  const overdueFollowUps = overdue.filter((t) => t.type === 'follow_up');
  const hasOverdueFollowUps = overdueFollowUps.length > 0;
  const hasProspectingBlock = todayBlocks.some((b) => b.category === 'prospecting');
  const hasReviewBlock = todayBlocks.some((b) => b.category === 'review');
  const pendingCount = pendingAll.length;
  const commercialTaskCount = todayTasks.filter(
    (t) => t.type === 'prospecting' || t.type === 'offer' || t.type === 'call',
  ).length;
  const lowCommercialDensity = commercialTaskCount < 2;

  // Weekly pace context (boosts suggestions when behind target)
  const paceBehindProspecting = weeklyPace?.metrics.prospectingBlocks.status !== 'on_track';
  const paceBehindFollowUps = weeklyPace?.metrics.followUps.status !== 'on_track';
  const paceBehindContacts = weeklyPace?.metrics.newContacts.status !== 'on_track';

  // Detect consecutive free hours for "deep work" suggestion
  const freeHourList: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
    if (!busyHours.has(h)) freeHourList.push(h);
  }
  const consecutiveStretchStart = new Set<number>();
  for (let i = 0; i < freeHourList.length; i++) {
    let streak = 1;
    while (i + streak < freeHourList.length && freeHourList[i + streak] === freeHourList[i] + streak) {
      streak++;
    }
    if (streak >= 3) {
      // Mark only the first hour of a long stretch
      consecutiveStretchStart.add(freeHourList[i]);
    }
  }

  // Track how many follow-up slots we've already assigned (cap at 2)
  let followUpSlotsAssigned = 0;

  const slots: FreeSlot[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
    if (busyHours.has(h)) continue;

    let suggestion = '';
    let category: FreeSlot['category'] = 'admin';
    let priority: FreeSlot['priority'] = 'low';
    let actionLabel = '+ Tarefa';
    let taskType: FreeSlot['taskType'] = 'general';
    let blockCategory: FreeSlot['blockCategory'] = 'general';
    let contextReason = '';

    // Rule 1: Overdue follow-ups (high priority, max 2 slots)
    if (hasOverdueFollowUps && followUpSlotsAssigned < 2) {
      suggestion = `Resolver ${overdueFollowUps.length} follow-up${overdueFollowUps.length > 1 ? 's' : ''} vencido${overdueFollowUps.length > 1 ? 's' : ''}`;
      category = 'follow_up';
      priority = 'high';
      actionLabel = '+ Follow-up';
      taskType = 'follow_up';
      blockCategory = 'follow_up';
      contextReason = `${overdueFollowUps.length} follow-up${overdueFollowUps.length > 1 ? 's' : ''} pendente${overdueFollowUps.length > 1 ? 's' : ''}`;
      if (paceBehindFollowUps) contextReason += ' · meta semanal atrasada';
      followUpSlotsAssigned++;
    }
    // Rule 2: Morning prospecting (no prospecting block + 8–11 + low commercial)
    else if (!hasProspectingBlock && h >= 8 && h <= 11 && lowCommercialDensity) {
      suggestion = paceBehindProspecting
        ? 'Prospecção urgente — meta semanal atrasada'
        : 'Prospecção — melhor horário do dia';
      category = 'prospecting';
      priority = 'high';
      actionLabel = '+ Prospecção';
      taskType = 'prospecting';
      blockCategory = 'prospecting';
      contextReason = paceBehindProspecting
        ? 'Meta de prospecção atrasada · sem bloco comercial'
        : 'Sem bloco comercial e poucas ações de captação';
    }
    // Rule 3: Morning prospecting (has prospecting block but low commercial)
    else if (!hasProspectingBlock && h >= 8 && h <= 11) {
      suggestion = paceBehindContacts
        ? 'Prospecção — meta de contatos atrasada'
        : 'Bom horário para prospecção';
      category = 'prospecting';
      priority = paceBehindContacts ? 'high' : 'medium';
      actionLabel = '+ Prospecção';
      taskType = 'prospecting';
      blockCategory = 'prospecting';
      contextReason = paceBehindContacts
        ? 'Meta semanal de novos contatos atrasada'
        : 'Sem bloco de prospecção agendado';
    }
    // Rule 3b: Pace-driven follow-up slot (when behind but no overdue)
    else if (paceBehindFollowUps && !hasOverdueFollowUps && followUpSlotsAssigned < 1) {
      suggestion = 'Follow-up — meta semanal atrasada';
      category = 'follow_up';
      priority = 'high';
      actionLabel = '+ Follow-up';
      taskType = 'follow_up';
      blockCategory = 'follow_up';
      contextReason = `Meta de follow-ups: ${weeklyPace!.metrics.followUps.actual}/${weeklyPace!.metrics.followUps.target}`;
      followUpSlotsAssigned++;
    }
    // Rule 4: Long stretch → deep work
    else if (consecutiveStretchStart.has(h)) {
      suggestion = 'Bloco longo livre — ideal para trabalho focado';
      category = 'review';
      priority = 'medium';
      actionLabel = '+ Bloco de Foco';
      taskType = 'portfolio_review';
      blockCategory = 'deep_work';
      contextReason = '3+ horas consecutivas livres';
    }
    // Rule 5: Afternoon review (no review block + 14–16)
    else if (!hasReviewBlock && h >= 14 && h <= 16) {
      suggestion = 'Revisão de carteira ou pipeline';
      category = 'review';
      priority = 'medium';
      actionLabel = '+ Revisão';
      taskType = 'portfolio_review';
      blockCategory = 'review';
      contextReason = 'Sem bloco de revisão agendado';
    }
    // Rule 6: High pending count → tackle backlog
    else if (pendingCount > 10) {
      suggestion = `Resolver pendências (${pendingCount} acumuladas)`;
      category = 'admin';
      priority = 'medium';
      actionLabel = '+ Tarefa';
      taskType = 'admin';
      blockCategory = 'admin';
      contextReason = `${pendingCount} tarefas pendentes no backlog`;
    }
    // Rule 7: Late afternoon → admin / planning
    else if (h >= 17) {
      suggestion = 'Organização e planejamento do próximo dia';
      category = 'admin';
      priority = 'low';
      actionLabel = '+ Admin';
      taskType = 'admin';
      blockCategory = 'admin';
      contextReason = 'Final do dia — bom para organizar';
    }
    // Rule 8: Default → study
    else {
      suggestion = 'Disponível para estudo ou planejamento';
      category = 'study';
      priority = 'low';
      actionLabel = '+ Estudo';
      taskType = 'general';
      blockCategory = 'study';
      contextReason = 'Horário disponível';
    }

    slots.push({ hour: h, suggestion, category, priority, actionLabel, taskType, blockCategory, contextReason });
  }

  return slots;
}

// ==========================================
// Smart Banner
// ==========================================

export function computeSmartBanner(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  weeklyPace?: WeeklyPaceStatus | null,
): SmartBannerData {
  const today = todayString();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const overdue = filterOverdueTasks(tasks);
  const overdueFollowUps = overdue.filter((t) => t.type === 'follow_up');
  const todayTasks = filterTasksForDate(tasks, today);
  const todayBlocks = filterBlocksForDate(blocks, today);
  const maxPriority = todayTasks.filter(
    (t) => t.priority === 'max' && t.status !== 'completed' && t.status !== 'archived',
  );

  const totalWorkMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  let busyMinutes = 0;
  for (const t of todayTasks) {
    if (t.startTime && t.endTime) busyMinutes += calculateDurationMinutes(t.startTime, t.endTime);
  }
  for (const b of todayBlocks) {
    if (b.startTime && b.endTime) busyMinutes += calculateDurationMinutes(b.startTime, b.endTime);
  }
  const freeHours = Math.max(0, Math.round(((totalWorkMinutes - busyMinutes) / 60) * 10) / 10);

  // Build smart message
  let bestOpportunity = '';
  if (overdueFollowUps.length > 0) {
    bestOpportunity = 'priorizar follow-ups vencidos';
  } else if (freeHours >= 3) {
    const hasProspecting = todayBlocks.some((b) => b.category === 'prospecting');
    bestOpportunity = hasProspecting
      ? 'usar tempo livre para revisão de carteira'
      : 'criar um bloco de prospecção';
  } else if (maxPriority.length > 0) {
    bestOpportunity = 'focar na(s) tarefa(s) de prioridade máxima';
  }

  const parts: string[] = [];

  if (freeHours > 0) parts.push(`${freeHours}h livres`);
  if (overdueFollowUps.length > 0) parts.push(`${overdueFollowUps.length} follow-up${overdueFollowUps.length > 1 ? 's' : ''} vencido${overdueFollowUps.length > 1 ? 's' : ''}`);
  if (overdue.length > 0 && overdue.length !== overdueFollowUps.length) parts.push(`${overdue.length} pendência${overdue.length > 1 ? 's' : ''} atrasada${overdue.length > 1 ? 's' : ''}`);
  if (maxPriority.length > 0) parts.push(`${maxPriority.length} tarefa${maxPriority.length > 1 ? 's' : ''} de prioridade máxima`);

  let message: string;
  if (parts.length === 0 && todayTasks.length === 0) {
    message = 'Nenhum compromisso registrado para hoje. Aproveite para organizar prospecção, revisão de carteira ou acompanhamento.';
  } else if (parts.length === 0) {
    message = `Hoje você tem ${todayTasks.length} tarefa${todayTasks.length > 1 ? 's' : ''} e tudo está em dia.`;
  } else {
    message = `Hoje você tem ${parts.join(', ')}.`;
    if (bestOpportunity) {
      message += ` Melhor ação: ${bestOpportunity}.`;
    }
  }

  // Append weekly pace context when behind
  if (weeklyPace && weeklyPace.overall !== 'on_track') {
    const behind = Object.values(weeklyPace.metrics)
      .filter((m) => m.status !== 'on_track')
      .map((m) => m.label.toLowerCase());
    if (behind.length > 0) {
      message += ` Ritmo semanal atrasado: ${behind.join(', ')}.`;
    }
  }

  return {
    greeting,
    freeHours,
    overdueFollowUps: overdueFollowUps.length,
    overdueCount: overdue.length,
    maxPriorityCount: maxPriority.length,
    bestOpportunity,
    message,
  };
}

// ==========================================
// Overdue Follow-Up Escalation
// ==========================================

/**
 * Classifies overdue follow-ups by age and severity.
 * Escalates effective priority based on days overdue:
 * - 1-3 days: severity medium, escalated to 'high' (if was medium/low)
 * - 4-7 days: severity high, escalated to 'high'
 * - 8+ days: severity critical, escalated to 'max'
 *
 * Filters out low-relevance items:
 * - Only promotes follow-ups that are actually pending (not completed/archived)
 * - Prioritizes linked entities over unlinked
 */
export function computeOverdueFollowUps(tasks: PlanningTask[]): OverdueFollowUp[] {
  const today = todayString();
  const todayMs = new Date(today).getTime();

  const overdueFUs = tasks.filter(
    (t) =>
      t.type === 'follow_up' &&
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      t.date < today,
  );

  const results: OverdueFollowUp[] = overdueFUs.map((task) => {
    const daysOverdue = Math.floor(
      (todayMs - new Date(task.date).getTime()) / 86400000,
    );

    let severity: OverdueFollowUp['severity'];
    let escalatedPriority: TaskPriority;

    if (daysOverdue >= 8) {
      severity = 'critical';
      escalatedPriority = 'max';
    } else if (daysOverdue >= 4) {
      severity = 'high';
      escalatedPriority = task.priority === 'max' ? 'max' : 'high';
    } else {
      severity = 'medium';
      escalatedPriority =
        task.priority === 'max' || task.priority === 'high'
          ? task.priority
          : 'high';
    }

    let reason: string;
    if (daysOverdue === 1) {
      reason = 'Venceu ontem';
    } else {
      reason = `Vencido há ${daysOverdue} dias`;
    }
    if (task.linkedEntityName) {
      reason += ` · ${task.linkedEntityName}`;
    }

    return { task, daysOverdue, escalatedPriority, severity, reason };
  });

  // Sort: critical first, then high, then medium; within same severity, most overdue first
  // Linked entities rank higher than unlinked at same severity
  return results.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    const aLinked = a.task.linkedEntityType !== 'none' ? 0 : 1;
    const bLinked = b.task.linkedEntityType !== 'none' ? 0 : 1;
    if (aLinked !== bLinked) return aLinked - bLinked;
    return b.daysOverdue - a.daysOverdue;
  });
}

// ==========================================
// Relationship Alerts (client no contact / prospect cooling)
// ==========================================

const DEFAULT_RELATIONSHIP_THRESHOLDS: RelationshipAlertThresholds = {
  clientNoContactDays: 14,
  prospectCoolingDays: 7,
};

/**
 * Analyzes ALL tasks (including completed) to detect:
 * 1. Clients without recent contact (no completed/pending task in X days)
 * 2. Prospects going cold (active prospect with no recent activity in Y days)
 *
 * Uses task history as proxy for contact:
 * - The most recent task date (by `date` field) linked to an entity = last contact
 * - If the entity only has very old tasks, it means the relationship is cooling
 *
 * Filtering out noise:
 * - Only entities with at least one completed task OR an overdue task get flagged
 * - Entities with future-dated pending tasks are considered "scheduled" and excluded
 * - Archived tasks are ignored
 */
export function computeRelationshipAlerts(
  tasks: PlanningTask[],
  thresholds?: Partial<RelationshipAlertThresholds>,
): RelationshipAlert[] {
  const today = todayString();
  const todayMs = new Date(today).getTime();
  const config = { ...DEFAULT_RELATIONSHIP_THRESHOLDS, ...thresholds };

  // Only consider non-archived tasks linked to entities
  const entityTasks = tasks.filter(
    (t) =>
      t.status !== 'archived' &&
      (t.linkedEntityType === 'client' || t.linkedEntityType === 'prospect') &&
      t.linkedEntityId,
  );

  // Group by entity
  const entityMap = new Map<string, {
    tasks: PlanningTask[];
    name: string;
    type: 'client' | 'prospect';
    id: string;
  }>();

  for (const task of entityTasks) {
    const key = `${task.linkedEntityType}:${task.linkedEntityId}`;
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        tasks: [],
        name: task.linkedEntityName || 'Sem nome',
        type: task.linkedEntityType as 'client' | 'prospect',
        id: task.linkedEntityId,
      });
    }
    entityMap.get(key)!.tasks.push(task);
  }

  const alerts: RelationshipAlert[] = [];

  for (const [, entity] of entityMap) {
    const { tasks: eTasks, type: entityType, id: entityId, name: entityName } = entity;

    // Find the most recent "contact" date — most recent completed task, or most recent task date overall
    const completedTasks = eTasks.filter((t) => t.status === 'completed');
    const pendingTasks = eTasks.filter(
      (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'postponed',
    );

    // If there are future-dated pending tasks, the entity has scheduled contact — skip
    const hasFutureTask = pendingTasks.some((t) => t.date > today);
    if (hasFutureTask) continue;

    // Determine last contact date
    let lastContactDate: string | null = null;

    if (completedTasks.length > 0) {
      // Use the most recent completed task's date
      lastContactDate = completedTasks.reduce(
        (max, t) => (t.date > max ? t.date : max),
        completedTasks[0].date,
      );
    } else if (pendingTasks.length > 0) {
      // No completed tasks: use the most recent pending task's date as fallback
      lastContactDate = pendingTasks.reduce(
        (max, t) => (t.date > max ? t.date : max),
        pendingTasks[0].date,
      );
    }

    if (!lastContactDate) continue;

    const daysSince = Math.floor((todayMs - new Date(lastContactDate).getTime()) / 86400000);
    if (daysSince <= 0) continue;

    // Find the most recent task (for context in UI)
    const latestTask = eTasks.reduce(
      (latest, t) => (t.date > latest.date ? t : latest),
      eTasks[0],
    );

    const thresholdDays = entityType === 'client'
      ? config.clientNoContactDays
      : config.prospectCoolingDays;

    if (daysSince < thresholdDays) continue;

    // Determine severity
    let severity: RelationshipAlert['severity'];
    if (daysSince >= thresholdDays * 2) {
      severity = 'critical';
    } else if (daysSince >= Math.round(thresholdDays * 1.5)) {
      severity = 'high';
    } else {
      severity = 'medium';
    }

    if (entityType === 'client') {
      alerts.push({
        entityType,
        entityId,
        entityName,
        alertType: 'client_no_contact',
        daysSinceContact: daysSince,
        lastContactDate,
        severity,
        reason: `Sem contato há ${daysSince} dias`,
        suggestedAction: 'Agendar reunião ou follow-up',
        latestTask,
      });
    } else {
      alerts.push({
        entityType,
        entityId,
        entityName,
        alertType: 'prospect_cooling',
        daysSinceContact: daysSince,
        lastContactDate,
        severity,
        reason: `Sem avanço há ${daysSince} dias`,
        suggestedAction: 'Retomar contato antes que esfrie',
        latestTask,
      });
    }
  }

  // Sort: critical first, then high, then medium; prospects before clients at same severity
  return alerts.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    // Prospects are more urgent than clients at same severity (pipeline risk)
    if (a.entityType !== b.entityType) {
      return a.entityType === 'prospect' ? -1 : 1;
    }
    return b.daysSinceContact - a.daysSinceContact;
  });
}

// ==========================================
// Offer Opportunity Detection
// ==========================================

export interface OfferOpportunity {
  /** Unique key composed from offer entity id or task id. */
  id: string;
  offerName: string;
  offerId: string;
  /** What kind of pending action this is. */
  alertType: 'no_linked_task' | 'stalled' | 'overdue_action' | 'unlinked_high_value';
  severity: 'critical' | 'high' | 'medium';
  reason: string;
  suggestedAction: string;
  daysStalled: number;
  /** The most relevant task for this offer (for context / navigation). */
  referenceTask: PlanningTask;
}

/**
 * Detects offer-related opportunities by analyzing all offer-typed tasks.
 *
 * Rules:
 * 1. **Overdue action** — offer task past its date and still pending → high/critical
 * 2. **Stalled offer** — offer task with no status change in ≥5 days → medium/high
 * 3. **Offer without follow-up** — offer task exists but no follow_up task linked to same entity → medium
 * 4. **Unlinked high-value** — high/max priority offer task with no linked entity → medium
 */
export function computeOfferOpportunities(tasks: PlanningTask[]): OfferOpportunity[] {
  const today = todayString();
  const todayMs = new Date(today).getTime();

  const allActive = tasks.filter(
    (t) => t.status !== 'archived',
  );

  // All offer-typed tasks that are still pending/in_progress/postponed
  const pendingOfferTasks = allActive.filter(
    (t) =>
      t.type === 'offer' &&
      (t.status === 'pending' || t.status === 'in_progress' || t.status === 'postponed'),
  );

  // All follow-up tasks (for cross-referencing)
  const followUpTasks = allActive.filter(
    (t) => t.type === 'follow_up' && (t.status === 'pending' || t.status === 'in_progress'),
  );

  // Group offer tasks by linked entity (offer ID or name)
  const offerGroups = new Map<string, PlanningTask[]>();
  for (const task of pendingOfferTasks) {
    const key = task.linkedEntityId || task.title;
    if (!offerGroups.has(key)) offerGroups.set(key, []);
    offerGroups.get(key)!.push(task);
  }

  const opportunities: OfferOpportunity[] = [];
  const seen = new Set<string>();

  for (const [groupKey, offerTasks] of offerGroups) {
    // Sort by date descending to get the most recent task first
    const sorted = [...offerTasks].sort((a, b) => (b.date > a.date ? 1 : -1));
    const latestTask = sorted[0];
    const offerName = latestTask.linkedEntityName || latestTask.title;
    const offerId = latestTask.linkedEntityId || latestTask.id || groupKey;

    // RULE 1: Overdue action — task date is in the past
    const overdueTasks = offerTasks.filter((t) => t.date < today);
    if (overdueTasks.length > 0) {
      const oldestOverdue = overdueTasks.reduce(
        (oldest, t) => (t.date < oldest.date ? t : oldest),
        overdueTasks[0],
      );
      const daysOverdue = Math.floor((todayMs - new Date(oldestOverdue.date).getTime()) / 86400000);
      const key = `overdue-${offerId}`;
      if (!seen.has(key)) {
        seen.add(key);
        opportunities.push({
          id: key,
          offerName,
          offerId,
          alertType: 'overdue_action',
          severity: daysOverdue >= 7 ? 'critical' : daysOverdue >= 3 ? 'high' : 'medium',
          reason: `Ação pendente há ${daysOverdue} dia(s)`,
          suggestedAction: 'Executar ação ou reagendar',
          daysStalled: daysOverdue,
          referenceTask: oldestOverdue,
        });
      }
      continue; // Overdue is the strongest signal — skip other rules for this offer
    }

    // RULE 2: Stalled offer — most recent task updated >5 days ago (using updatedAt or date)
    const latestDate = latestTask.updatedAt
      ? latestTask.updatedAt.slice(0, 10)
      : latestTask.date;
    const daysSinceUpdate = Math.floor((todayMs - new Date(latestDate).getTime()) / 86400000);
    if (daysSinceUpdate >= 5) {
      const key = `stalled-${offerId}`;
      if (!seen.has(key)) {
        seen.add(key);
        opportunities.push({
          id: key,
          offerName,
          offerId,
          alertType: 'stalled',
          severity: daysSinceUpdate >= 10 ? 'high' : 'medium',
          reason: `Sem movimentação há ${daysSinceUpdate} dia(s)`,
          suggestedAction: 'Retomar abordagem ou atualizar status',
          daysStalled: daysSinceUpdate,
          referenceTask: latestTask,
        });
      }
      continue;
    }

    // RULE 3: Offer without follow-up — no follow-up task linked to same entity
    if (latestTask.linkedEntityId) {
      const hasFollowUp = followUpTasks.some(
        (f) =>
          f.linkedEntityId === latestTask.linkedEntityId ||
          f.linkedEntityName === latestTask.linkedEntityName,
      );
      if (!hasFollowUp) {
        const key = `no-followup-${offerId}`;
        if (!seen.has(key)) {
          seen.add(key);
          opportunities.push({
            id: key,
            offerName,
            offerId,
            alertType: 'no_linked_task',
            severity: 'medium',
            reason: 'Sem follow-up vinculado',
            suggestedAction: 'Criar follow-up para acompanhar',
            daysStalled: 0,
            referenceTask: latestTask,
          });
        }
        continue;
      }
    }

    // RULE 4: Unlinked high-value — high/max priority but no linked entity
    if (
      (latestTask.priority === 'max' || latestTask.priority === 'high') &&
      latestTask.linkedEntityType === 'none'
    ) {
      const key = `unlinked-${offerId}`;
      if (!seen.has(key)) {
        seen.add(key);
        opportunities.push({
          id: key,
          offerName,
          offerId,
          alertType: 'unlinked_high_value',
          severity: 'medium',
          reason: 'Oferta de alta prioridade sem vínculo',
          suggestedAction: 'Vincular a cliente ou prospect elegível',
          daysStalled: 0,
          referenceTask: latestTask,
        });
      }
    }
  }

  // Sort by severity, then by days stalled
  const sevOrder = { critical: 0, high: 1, medium: 2 };
  return opportunities.sort((a, b) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return b.daysStalled - a.daysStalled;
  });
}

// ==========================================
// Weekly Pace Detection
// ==========================================

/**
 * Computes weekly pace status by counting completed tasks/blocks
 * for the current week and comparing against configurable targets.
 *
 * Uses day-of-week to calculate expected progress:
 * Mon=20%, Tue=40%, Wed=60%, Thu=80%, Fri=100% (weekdays only).
 * Weekends keep expectedPct at 100%.
 *
 * A metric is "behind" when actual < expected, "critical" when actual < 50% of expected.
 */
export function computeWeeklyPace(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  goals?: Partial<WeeklyPaceGoals>,
): WeeklyPaceStatus {
  const now = new Date();
  const weekLabel = getWeekKey(now);

  // Day of week: 1=Mon … 7=Sun (ISO)
  const jsDay = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  // Expected progress based on weekdays elapsed (Mon=1 → 20%, Fri=5 → 100%)
  const weekdaysElapsed = Math.min(dayOfWeek, 5);
  const expectedPct = Math.round((weekdaysElapsed / 5) * 100);

  const config: WeeklyPaceGoals = { ...DEFAULT_WEEKLY_PACE_GOALS, ...goals };

  // Filter to current week
  const weekTasks = filterWeekTasks(tasks, now);
  const weekBlocks = filterWeekBlocks(blocks, now);

  // Count completed/done items per metric
  const completedTasks = weekTasks.filter((t) => t.status === 'completed');
  const meetingsDone = completedTasks.filter((t) => t.type === 'meeting').length;
  const followUpsDone = completedTasks.filter((t) => t.type === 'follow_up').length;
  const newContactsDone = completedTasks.filter(
    (t) => t.type === 'call' || t.type === 'prospecting',
  ).length;
  // Prospecting blocks: count blocks with category 'prospecting' (regardless of completion)
  const prospectingBlocksDone = weekBlocks.filter(
    (b) => b.category === 'prospecting',
  ).length;

  function buildMetric(
    label: string,
    actual: number,
    target: number,
  ): WeeklyPaceMetric {
    const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 100;
    const expectedAbs = Math.round((target * expectedPct) / 100);
    const behindBy = Math.max(0, expectedAbs - actual);
    let status: WeeklyPaceMetric['status'] = 'on_track';
    if (actual < expectedAbs * 0.5 && expectedAbs > 0) {
      status = 'critical';
    } else if (actual < expectedAbs) {
      status = 'behind';
    }
    return { label, actual, target, pct, behindBy, status };
  }

  const metrics = {
    meetings: buildMetric(WEEKLY_PACE_LABELS.meetings, meetingsDone, config.meetings),
    followUps: buildMetric(WEEKLY_PACE_LABELS.followUps, followUpsDone, config.followUps),
    prospectingBlocks: buildMetric(WEEKLY_PACE_LABELS.prospectingBlocks, prospectingBlocksDone, config.prospectingBlocks),
    newContacts: buildMetric(WEEKLY_PACE_LABELS.newContacts, newContactsDone, config.newContacts),
  };

  const behindCount = Object.values(metrics).filter((m) => m.status !== 'on_track').length;
  let overall: WeeklyPaceStatus['overall'] = 'on_track';
  if (behindCount >= 3) overall = 'critical';
  else if (behindCount >= 1) overall = 'behind';

  // Build actionable summary
  const behind = Object.values(metrics).filter((m) => m.status !== 'on_track');
  let summary: string;
  if (behind.length === 0) {
    summary = 'Todas as metas semanais estão no ritmo. Continue assim!';
  } else {
    const names = behind.map((m) => m.label.toLowerCase()).join(', ');
    summary = `Atenção: ${names} abaixo do ritmo esperado para ${getDayName(dayOfWeek)}.`;
  }

  return {
    weekLabel,
    dayOfWeek,
    expectedPct,
    metrics,
    behindCount,
    overall,
    summary,
  };
}

function getDayName(dow: number): string {
  const names: Record<number, string> = {
    1: 'segunda-feira',
    2: 'terça-feira',
    3: 'quarta-feira',
    4: 'quinta-feira',
    5: 'sexta-feira',
    6: 'sábado',
    7: 'domingo',
  };
  return names[dow] || '';
}

// ==========================================
// Focus Suggestion (contextual)
// ==========================================

/**
 * Compute the best focus suggestion for right now based on
 * current hour, today’s tasks/blocks, overdue items, and weekly pace.
 *
 * Returns null when there is nothing actionable to suggest.
 */
export function computeFocusSuggestion(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  weeklyPace?: WeeklyPaceStatus | null,
): FocusSuggestion | null {
  const today = todayString();
  const hour = new Date().getHours();
  const todayTasks = filterTasksForDate(tasks, today);
  const todayBlocks = filterBlocksForDate(blocks, today);
  const overdue = filterOverdueTasks(tasks);
  const overdueFollowUps = overdue.filter((t) => t.type === 'follow_up');
  const pending = filterPendingTasks(tasks);

  // Busy hours set
  const busyHours = new Set<number>();
  for (const t of todayTasks) {
    if (t.startTime) busyHours.add(parseInt(t.startTime.split(':')[0], 10));
  }
  for (const b of todayBlocks) {
    if (b.startTime) busyHours.add(parseInt(b.startTime.split(':')[0], 10));
  }

  // Check if current hour and the next are free
  const currentFree = !busyHours.has(hour);
  const nextFree = !busyHours.has(hour + 1);
  const windowMinutes = currentFree && nextFree ? 60 : currentFree ? 25 : 0;

  // Nothing to suggest if current hour is occupied or it’s outside work hours
  if (!currentFree || hour < TIMELINE_START_HOUR || hour > TIMELINE_END_HOUR) {
    return null;
  }

  // Pace signals
  const behindProspecting = weeklyPace?.metrics.prospectingBlocks.status !== 'on_track';
  const behindFollowUps = weeklyPace?.metrics.followUps.status !== 'on_track';

  const hasProspectingBlock = todayBlocks.some((b) => b.category === 'prospecting');
  const commercialCount = todayTasks.filter(
    (t) => t.type === 'prospecting' || t.type === 'offer' || t.type === 'call',
  ).length;

  // Priority 1: Overdue follow-ups
  if (overdueFollowUps.length > 0) {
    return {
      label: `Resolver ${overdueFollowUps.length} follow-up${overdueFollowUps.length > 1 ? 's' : ''} vencido${overdueFollowUps.length > 1 ? 's' : ''}`,
      reason: behindFollowUps
        ? 'Meta semanal de follow-ups atrasada'
        : 'Follow-ups precisam de atenção',
      durationMinutes: Math.min(windowMinutes || 25, 45),
      category: 'follow_up',
      priority: 'high',
    };
  }

  // Priority 2: Morning prospecting (8–11) when no bloco + low commercial
  if (hour >= 8 && hour <= 11 && !hasProspectingBlock && commercialCount < 2) {
    return {
      label: 'Prospecção',
      reason: behindProspecting
        ? 'Meta semanal atrasada · melhor horário'
        : 'Horário ideal para captação',
      durationMinutes: windowMinutes >= 60 ? 45 : 25,
      category: 'prospecting',
      priority: 'high',
    };
  }

  // Priority 3: 2+ free hours → deep work
  if (windowMinutes >= 60) {
    // Check for 3+ consecutive free
    let streak = 0;
    for (let h = hour; h <= TIMELINE_END_HOUR; h++) {
      if (!busyHours.has(h)) streak++; else break;
    }
    if (streak >= 3) {
      return {
        label: 'Trabalho focado',
        reason: `${streak}h consecutivas livres — ideal para deep work`,
        durationMinutes: 45,
        category: 'deep_work',
        priority: 'medium',
      };
    }
  }

  // Priority 4: Afternoon review (14–16)
  if (hour >= 14 && hour <= 16 && !todayBlocks.some((b) => b.category === 'review')) {
    return {
      label: 'Revisão de carteira',
      reason: 'Sem bloco de revisão agendado',
      durationMinutes: windowMinutes >= 60 ? 45 : 25,
      category: 'review',
      priority: 'medium',
    };
  }

  // Priority 5: High pending backlog
  if (pending.length > 10) {
    return {
      label: 'Resolver pendências',
      reason: `${pending.length} tarefas pendentes acumuladas`,
      durationMinutes: 25,
      category: 'admin',
      priority: 'medium',
    };
  }

  // Priority 6: Short free window → quick follow-ups
  if (windowMinutes <= 30 && behindFollowUps) {
    return {
      label: 'Follow-up rápido',
      reason: 'Janela curta — bom para contatos breves',
      durationMinutes: 15,
      category: 'follow_up',
      priority: 'low',
    };
  }

  // Priority 7: Late afternoon → planning/admin
  if (hour >= 17) {
    return {
      label: 'Organização',
      reason: 'Final do dia — planejar o amanhã',
      durationMinutes: 15,
      category: 'admin',
      priority: 'low',
    };
  }

  // Generic: free hour, nothing special
  return {
    label: 'Foco livre',
    reason: 'Horário disponível para concentração',
    durationMinutes: 25,
    category: 'general',
    priority: 'low',
  };
}

// ==========================================
// Post-Meeting Prompt Detection
// ==========================================

/** Maximum hours after a meeting ends before we stop prompting. */
const POST_MEETING_MAX_HOURS = 6;

/**
 * Detects meetings that have already ended today and generates
 * post-meeting prompts so the user can register summary, next-action,
 * and follow-up tasks — turning each meeting into commercial continuity.
 *
 * Rules:
 * - Only today's confirmed events (status !== 'cancelled')
 * - Meeting must have ended (end < now) but not more than POST_MEETING_MAX_HOURS ago
 * - Checks existing tasks for a matching post_meeting title to flag `hasPostTask`
 * - Sorted by most-recent-first (lowest minutesSinceEnd first)
 */
export function detectPostMeetingPrompts(
  events: CalendarEvent[],
  tasks: PlanningTask[],
  today: string,
): PostMeetingPrompt[] {
  const now = new Date();
  const maxAgoMs = POST_MEETING_MAX_HOURS * 60 * 60 * 1000;

  // Collect post_meeting task titles for dedup matching
  const postTaskTitles = new Set(
    tasks
      .filter((t) => t.type === 'post_meeting' && t.status !== 'archived')
      .map((t) => t.title.toLowerCase()),
  );

  const prompts: PostMeetingPrompt[] = [];

  for (const event of events) {
    // Skip cancelled / all-day / non-today events
    if (event.status === 'cancelled') continue;
    if (event.allDay) continue;

    const eventDate = event.start.slice(0, 10);
    if (eventDate !== today) continue;

    const endTime = new Date(event.end);
    const diffMs = now.getTime() - endTime.getTime();

    // Must have ended, but within the window
    if (diffMs <= 0 || diffMs > maxAgoMs) continue;

    const mType = getEffectiveMeetingType(event);
    const mLabel = MEETING_TYPE_LABELS[mType] || mType;
    const mColor = MEETING_TYPE_COLORS[mType] || '#6B7280';

    // Check if a post-meeting task already exists
    const expectedTitle = `Pós-reunião: ${event.title}`.toLowerCase();
    const hasPostTask = postTaskTitles.has(expectedTitle);

    prompts.push({
      eventId: event.googleEventId || event.id || event.title,
      eventTitle: event.title,
      meetingType: mLabel,
      meetingColor: mColor,
      startTime: event.start,
      endTime: event.end,
      attendees: event.attendees || '',
      minutesSinceEnd: Math.round(diffMs / 60000),
      hasPostTask,
    });
  }

  // Most-recent-first
  return prompts.sort((a, b) => a.minutesSinceEnd - b.minutesSinceEnd);
}
