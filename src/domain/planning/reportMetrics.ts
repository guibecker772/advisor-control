import type {
  PlanningTask,
  PlanningBlock,
  DailyReview,
  ChecklistItem,
  TaskType,
  BlockCategory,
  FocusSessionRecord,
} from './planningTypes';
import {
  filterWeekTasks,
  filterMonthTasks,
  filterOverdueTasks,
  toDateString,
  getWeekRange,
  getMonthRange,
  formatDateShort,
  getWeekKey,
  getMonthKey,
} from './planningUtils';
import { TASK_TYPE_LABELS, BLOCK_CATEGORY_LABELS } from './planningConstants';

// ==========================================
// Types
// ==========================================

export interface TaskBreakdown {
  type: TaskType;
  label: string;
  total: number;
  completed: number;
  pending: number;
}

export interface BlockBreakdown {
  category: BlockCategory;
  label: string;
  count: number;
  totalMinutes: number;
}

export interface DailySnapshot {
  date: string;
  completed: number;
  pending: number;
  rescheduled: number;
  hasReview: boolean;
}

export interface FocusCategoryBreakdown {
  category: string;
  sessionCount: number;
  totalMinutes: number;
}

/** Per-day breakdown for weekly/monthly focus consistency view. */
export interface FocusDailyBreakdown {
  date: string;        // YYYY-MM-DD
  dayLabel: string;    // "Seg", "Ter", …
  totalMinutes: number;
  sessionCount: number;
}

export interface FocusMetrics {
  totalSessions: number;
  completedSessions: number;
  interruptedSessions: number;
  completionRate: number;
  totalMinutes: number;
  categoryBreakdown: FocusCategoryBreakdown[];
  dailyBreakdown: FocusDailyBreakdown[];
}

export interface ReportMetrics {
  periodLabel: string;
  periodRange: string;
  periodKey: string;

  // Totais
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  postponedTasks: number;
  archivedTasks: number;
  completionRate: number; // 0-100

  // Compromissos
  totalMeetings: number;
  completedMeetings: number;
  totalCalls: number;
  completedCalls: number;

  // Comercial
  followUpsDone: number;
  followUpsTotal: number;
  prospectingDone: number;
  prospectingTotal: number;
  overdueCount: number;

  // Blocos
  totalBlocks: number;
  totalBlockMinutes: number;
  blockBreakdown: BlockBreakdown[];

  // Breakdown por tipo
  taskBreakdown: TaskBreakdown[];

  // Daily Reviews
  reviewsDone: number;
  reviewDays: number; // dias úteis do período
  dailySnapshots: DailySnapshot[];

  // Checklist
  checklistTotal: number;
  checklistDone: number;
  checklistProgress: number; // 0-100

  // Focus
  focus?: FocusMetrics;
}

// ==========================================
// Helpers
// ==========================================

function filterBlocksForRange(blocks: PlanningBlock[], startStr: string, endStr: string): PlanningBlock[] {
  return blocks.filter((b) => b.date >= startStr && b.date <= endStr);
}

function countByType(tasks: PlanningTask[], type: TaskType, status?: string): number {
  return tasks.filter((t) => t.type === type && (status ? t.status === status : true)).length;
}

function buildTaskBreakdown(tasks: PlanningTask[]): TaskBreakdown[] {
  const types: TaskType[] = ['meeting', 'call', 'follow_up', 'prospecting', 'offer', 'portfolio_review', 'admin', 'post_meeting', 'general'];
  return types
    .map((type) => {
      const ofType = tasks.filter((t) => t.type === type);
      if (ofType.length === 0) return null;
      return {
        type,
        label: TASK_TYPE_LABELS[type],
        total: ofType.length,
        completed: ofType.filter((t) => t.status === 'completed').length,
        pending: ofType.filter((t) => t.status !== 'completed' && t.status !== 'archived').length,
      };
    })
    .filter(Boolean) as TaskBreakdown[];
}

function buildBlockBreakdown(blocks: PlanningBlock[]): BlockBreakdown[] {
  const categories: BlockCategory[] = ['prospecting', 'follow_up', 'meetings', 'admin', 'study', 'review', 'offer', 'deep_work', 'general'];
  return categories
    .map((category) => {
      const ofCat = blocks.filter((b) => b.category === category);
      if (ofCat.length === 0) return null;
      return {
        category,
        label: BLOCK_CATEGORY_LABELS[category],
        count: ofCat.length,
        totalMinutes: ofCat.reduce((sum, b) => sum + (b.durationMinutes || 0), 0),
      };
    })
    .filter(Boolean) as BlockBreakdown[];
}

function buildDailySnapshots(
  tasks: PlanningTask[],
  reviews: DailyReview[],
  startStr: string,
  endStr: string,
): DailySnapshot[] {
  const snapshots: DailySnapshot[] = [];
  let current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');

  while (current <= end) {
    const dateStr = toDateString(current);
    const dayTasks = tasks.filter((t) => t.date === dateStr);
    const review = reviews.find((r) => r.date === dateStr);

    snapshots.push({
      date: dateStr,
      completed: review ? review.completedCount : dayTasks.filter((t) => t.status === 'completed').length,
      pending: review ? review.pendingCount : dayTasks.filter((t) => t.status !== 'completed' && t.status !== 'archived').length,
      rescheduled: review ? review.rescheduledCount : 0,
      hasReview: !!review,
    });

    current = new Date(current.getTime() + 86400000);
  }

  return snapshots;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildFocusMetrics(
  sessions: FocusSessionRecord[],
  startStr?: string,
  endStr?: string,
): FocusMetrics | undefined {
  if (sessions.length === 0) return undefined;

  const completed = sessions.filter(s => s.outcome === 'completed');
  const interrupted = sessions.filter(s => s.outcome === 'interrupted');
  const totalMinutes = sessions.reduce((sum, s) => sum + s.totalFocusedMinutes, 0);

  // Group by sourceContext (category label)
  const catMap = new Map<string, { count: number; minutes: number }>();
  for (const s of sessions) {
    const cat = s.sourceContext || 'Foco livre';
    const entry = catMap.get(cat) ?? { count: 0, minutes: 0 };
    entry.count++;
    entry.minutes += s.totalFocusedMinutes;
    catMap.set(cat, entry);
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, { count, minutes }]) => ({
      category,
      sessionCount: count,
      totalMinutes: minutes,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  // Build daily breakdown over the period range
  const dailyBreakdown: FocusDailyBreakdown[] = [];
  if (startStr && endStr) {
    let cursor = new Date(startStr + 'T00:00:00');
    const endDate = new Date(endStr + 'T00:00:00');
    while (cursor <= endDate) {
      const dateStr = toDateString(cursor);
      const daySessions = sessions.filter(s => s.date === dateStr);
      dailyBreakdown.push({
        date: dateStr,
        dayLabel: DAY_LABELS[cursor.getDay()],
        totalMinutes: daySessions.reduce((sum, s) => sum + s.totalFocusedMinutes, 0),
        sessionCount: daySessions.length,
      });
      cursor = new Date(cursor.getTime() + 86400000);
    }
  }

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    interruptedSessions: interrupted.length,
    completionRate: Math.round((completed.length / sessions.length) * 100),
    totalMinutes,
    categoryBreakdown,
    dailyBreakdown,
  };
}

// ==========================================
// Main computation
// ==========================================

export function computeWeekReport(
  allTasks: PlanningTask[],
  allBlocks: PlanningBlock[],
  reviews: DailyReview[],
  checklistItems: ChecklistItem[],
  referenceDate: Date = new Date(),
  focusSessions: FocusSessionRecord[] = [],
): ReportMetrics {
  const { start, end } = getWeekRange(referenceDate);
  const startStr = toDateString(start);
  const endStr = toDateString(end);

  const tasks = filterWeekTasks(allTasks, referenceDate);
  const blocks = filterBlocksForRange(allBlocks, startStr, endStr);
  const periodReviews = reviews.filter((r) => r.date >= startStr && r.date <= endStr);

  const completed = tasks.filter((t) => t.status === 'completed');
  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const postponed = tasks.filter((t) => t.status === 'postponed');
  const archived = tasks.filter((t) => t.status === 'archived');

  const checklistDone = checklistItems.filter((i) => i.checked).length;

  return {
    periodLabel: `Semana ${getWeekKey(referenceDate)}`,
    periodRange: `${formatDateShort(start)} – ${formatDateShort(end)}`,
    periodKey: getWeekKey(referenceDate),

    totalTasks: tasks.length,
    completedTasks: completed.length,
    pendingTasks: pending.length,
    postponedTasks: postponed.length,
    archivedTasks: archived.length,
    completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,

    totalMeetings: countByType(tasks, 'meeting'),
    completedMeetings: countByType(tasks, 'meeting', 'completed'),
    totalCalls: countByType(tasks, 'call'),
    completedCalls: countByType(tasks, 'call', 'completed'),

    followUpsDone: countByType(tasks, 'follow_up', 'completed'),
    followUpsTotal: countByType(tasks, 'follow_up'),
    prospectingDone: countByType(tasks, 'prospecting', 'completed'),
    prospectingTotal: countByType(tasks, 'prospecting'),
    overdueCount: filterOverdueTasks(allTasks).length,

    totalBlocks: blocks.length,
    totalBlockMinutes: blocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0),
    blockBreakdown: buildBlockBreakdown(blocks),

    taskBreakdown: buildTaskBreakdown(tasks),

    reviewsDone: periodReviews.length,
    reviewDays: 5, // seg-sex
    dailySnapshots: buildDailySnapshots(tasks, periodReviews, startStr, endStr),

    checklistTotal: checklistItems.length,
    checklistDone,
    checklistProgress: checklistItems.length > 0 ? Math.round((checklistDone / checklistItems.length) * 100) : 0,

    focus: buildFocusMetrics(focusSessions.filter(s => s.date >= startStr && s.date <= endStr), startStr, endStr),
  };
}

export function computeMonthReport(
  allTasks: PlanningTask[],
  allBlocks: PlanningBlock[],
  reviews: DailyReview[],
  checklistItems: ChecklistItem[],
  referenceDate: Date = new Date(),
  focusSessions: FocusSessionRecord[] = [],
): ReportMetrics {
  const { start, end } = getMonthRange(referenceDate);
  const startStr = toDateString(start);
  const endStr = toDateString(end);

  const tasks = filterMonthTasks(allTasks, referenceDate);
  const blocks = filterBlocksForRange(allBlocks, startStr, endStr);
  const periodReviews = reviews.filter((r) => r.date >= startStr && r.date <= endStr);

  const completed = tasks.filter((t) => t.status === 'completed');
  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const postponed = tasks.filter((t) => t.status === 'postponed');
  const archived = tasks.filter((t) => t.status === 'archived');

  const checklistDone = checklistItems.filter((i) => i.checked).length;

  // Business days in month (approx — weekdays only)
  let businessDays = 0;
  let cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) businessDays++;
    cur = new Date(cur.getTime() + 86400000);
  }

  return {
    periodLabel: `Mês ${getMonthKey(referenceDate)}`,
    periodRange: `${formatDateShort(start)} – ${formatDateShort(end)}`,
    periodKey: getMonthKey(referenceDate),

    totalTasks: tasks.length,
    completedTasks: completed.length,
    pendingTasks: pending.length,
    postponedTasks: postponed.length,
    archivedTasks: archived.length,
    completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,

    totalMeetings: countByType(tasks, 'meeting'),
    completedMeetings: countByType(tasks, 'meeting', 'completed'),
    totalCalls: countByType(tasks, 'call'),
    completedCalls: countByType(tasks, 'call', 'completed'),

    followUpsDone: countByType(tasks, 'follow_up', 'completed'),
    followUpsTotal: countByType(tasks, 'follow_up'),
    prospectingDone: countByType(tasks, 'prospecting', 'completed'),
    prospectingTotal: countByType(tasks, 'prospecting'),
    overdueCount: filterOverdueTasks(allTasks).length,

    totalBlocks: blocks.length,
    totalBlockMinutes: blocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0),
    blockBreakdown: buildBlockBreakdown(blocks),

    taskBreakdown: buildTaskBreakdown(tasks),

    reviewsDone: periodReviews.length,
    reviewDays: businessDays,
    dailySnapshots: buildDailySnapshots(tasks, periodReviews, startStr, endStr),

    checklistTotal: checklistItems.length,
    checklistDone,
    checklistProgress: checklistItems.length > 0 ? Math.round((checklistDone / checklistItems.length) * 100) : 0,

    focus: buildFocusMetrics(focusSessions.filter(s => s.date >= startStr && s.date <= endStr), startStr, endStr),
  };
}

// ==========================================
// Export to text (for clipboard / download)
// ==========================================

export function reportToText(m: ReportMetrics): string {
  const lines: string[] = [];

  lines.push(`RELATÓRIO DE PRODUTIVIDADE`);
  lines.push(`${m.periodLabel}`);
  lines.push(`Período: ${m.periodRange}`);
  lines.push('');

  lines.push('═══ RESUMO GERAL ═══');
  lines.push(`Total de tarefas: ${m.totalTasks}`);
  lines.push(`Concluídas: ${m.completedTasks} (${m.completionRate}%)`);
  lines.push(`Pendentes: ${m.pendingTasks}`);
  lines.push(`Adiadas: ${m.postponedTasks}`);
  if (m.archivedTasks > 0) lines.push(`Arquivadas: ${m.archivedTasks}`);
  lines.push(`Atrasadas (total): ${m.overdueCount}`);
  lines.push('');

  lines.push('═══ COMPROMISSOS ═══');
  lines.push(`Reuniões: ${m.completedMeetings}/${m.totalMeetings}`);
  lines.push(`Ligações: ${m.completedCalls}/${m.totalCalls}`);
  lines.push('');

  lines.push('═══ EXECUÇÃO COMERCIAL ═══');
  lines.push(`Follow-ups concluídos: ${m.followUpsDone}/${m.followUpsTotal}`);
  lines.push(`Prospecção concluída: ${m.prospectingDone}/${m.prospectingTotal}`);
  lines.push('');

  if (m.taskBreakdown.length > 0) {
    lines.push('═══ TAREFAS POR TIPO ═══');
    for (const tb of m.taskBreakdown) {
      lines.push(`  ${tb.label}: ${tb.completed}/${tb.total} concluídas`);
    }
    lines.push('');
  }

  if (m.blockBreakdown.length > 0) {
    lines.push('═══ BLOCOS DE TEMPO ═══');
    lines.push(`Total: ${m.totalBlocks} blocos (${Math.round(m.totalBlockMinutes / 60)}h)`);
    for (const bb of m.blockBreakdown) {
      lines.push(`  ${bb.label}: ${bb.count} blocos (${Math.round(bb.totalMinutes / 60)}h)`);
    }
    lines.push('');
  }

  lines.push('═══ DISCIPLINA ═══');
  lines.push(`Reviews diários: ${m.reviewsDone}/${m.reviewDays} dias úteis`);
  lines.push(`Checklist: ${m.checklistDone}/${m.checklistTotal} itens (${m.checklistProgress}%)`);
  lines.push('');

  if (m.focus) {
    lines.push('═══ MODO FOCO ═══');
    lines.push(`Sessões: ${m.focus.completedSessions}/${m.focus.totalSessions} concluídas (${m.focus.completionRate}%)`);
    lines.push(`Tempo focado: ${Math.round(m.focus.totalMinutes / 60)}h ${m.focus.totalMinutes % 60}min`);
    for (const fc of m.focus.categoryBreakdown) {
      lines.push(`  ${fc.category}: ${fc.sessionCount} sessões (${fc.totalMinutes}min)`);
    }
    lines.push('');
  }

  lines.push('─── Gerado por Advisor Control ───');

  return lines.join('\n');
}
