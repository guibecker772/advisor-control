/**
 * Planning Intelligence Layer
 *
 * Rule-based intelligence for the Planning module.
 * Provides smart suggestions, priority ranking, action recommendations,
 * and commercial radar data based on task/block state.
 */

import type { PlanningTask, PlanningBlock, TaskPriority } from './planningTypes';
import { PRIORITY_ORDER, TIMELINE_START_HOUR, TIMELINE_END_HOUR } from './planningConstants';
import {
  todayString,
  filterTasksForDate,
  filterBlocksForDate,
  filterOverdueTasks,
  filterPendingTasks,
  calculateDurationMinutes,
} from './planningUtils';

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

  // Offers with pending action
  const pendingOffers = pending.filter(
    (t) => t.type === 'offer' && t.date <= today,
  );
  if (pendingOffers.length > 0) {
    items.push({
      type: 'opportunity',
      title: `${pendingOffers.length} oferta(s) com ação pendente`,
      description: pendingOffers
        .slice(0, 2)
        .map((t) => t.linkedEntityName || t.title)
        .join(', '),
      severity: 'medium',
      linkedTaskId: pendingOffers[0].id,
    });
  }

  return items;
}

// ==========================================
// Free Slot Suggestions
// ==========================================

export function computeFreeSlotSuggestions(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
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

  const hasOverdueFollowUps = overdue.some((t) => t.type === 'follow_up');
  const hasProspectingBlock = todayBlocks.some((b) => b.category === 'prospecting');
  const pendingCount = pendingAll.length;

  const slots: FreeSlot[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
    if (busyHours.has(h)) continue;

    let suggestion = '';
    let category: FreeSlot['category'] = 'admin';

    if (hasOverdueFollowUps) {
      suggestion = 'Ideal para follow-ups vencidos';
      category = 'follow_up';
    } else if (!hasProspectingBlock && h >= 9 && h <= 11) {
      suggestion = 'Bom horário para prospecção';
      category = 'prospecting';
    } else if (h >= 14 && h <= 16) {
      suggestion = 'Bloqueie para revisão de carteira';
      category = 'review';
    } else if (pendingCount > 10) {
      suggestion = 'Use para resolver pendências acumuladas';
      category = 'admin';
    } else {
      suggestion = 'Disponível para estudo ou planejamento';
      category = 'study';
    }

    slots.push({ hour: h, suggestion, category });
  }

  return slots;
}

// ==========================================
// Smart Banner
// ==========================================

export function computeSmartBanner(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
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
