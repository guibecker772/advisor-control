import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  getISOWeek,
  getYear,
  addDays,
  eachDayOfInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { PlanningTask, PlanningBlock, TaskPriority } from './planningTypes';
import { PRIORITY_ORDER, TIMELINE_START_HOUR, TIMELINE_END_HOUR } from './planningConstants';

// ============================================
// Date formatting
// ============================================

export function formatDatePtBR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateDayMonth(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "d 'de' MMM", { locale: ptBR });
}

export function formatWeekday(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE', { locale: ptBR });
}

export function formatWeekdayShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE', { locale: ptBR });
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayString(): string {
  return toDateString(new Date());
}

// ============================================
// Week/Month keys
// ============================================

export function getWeekKey(date: Date = new Date()): string {
  const week = getISOWeek(date);
  const year = getYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

// ============================================
// Week helpers
// ============================================

export function getWeekDays(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

// ============================================
// Duration calculations
// ============================================

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

// ============================================
// Sorting and filtering
// ============================================

export function sortByPriority<T extends { priority: TaskPriority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function sortByTime<T extends { startTime: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.startTime && !b.startTime) return 0;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function filterTasksForDate(tasks: PlanningTask[], date: string): PlanningTask[] {
  return tasks.filter((t) => t.date === date);
}

export function filterBlocksForDate(blocks: PlanningBlock[], date: string): PlanningBlock[] {
  return blocks.filter((b) => b.date === date);
}

export function filterOverdueTasks(tasks: PlanningTask[]): PlanningTask[] {
  const today = todayString();
  return tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      t.date < today,
  );
}

export function filterTodayTasks(tasks: PlanningTask[]): PlanningTask[] {
  const today = todayString();
  return tasks.filter((t) => t.date === today);
}

export function filterWeekTasks(tasks: PlanningTask[], date: Date = new Date()): PlanningTask[] {
  const { start, end } = getWeekRange(date);
  const startStr = toDateString(start);
  const endStr = toDateString(end);
  return tasks.filter((t) => t.date >= startStr && t.date <= endStr);
}

export function filterMonthTasks(tasks: PlanningTask[], date: Date = new Date()): PlanningTask[] {
  const { start, end } = getMonthRange(date);
  const startStr = toDateString(start);
  const endStr = toDateString(end);
  return tasks.filter((t) => t.date >= startStr && t.date <= endStr);
}

export function filterPendingTasks(tasks: PlanningTask[]): PlanningTask[] {
  return tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'postponed',
  );
}

export function filterFollowUps(tasks: PlanningTask[]): PlanningTask[] {
  return tasks.filter((t) => t.type === 'follow_up');
}

export function filterMaxPriority(tasks: PlanningTask[]): PlanningTask[] {
  return tasks.filter((t) => t.priority === 'max' && t.status !== 'completed' && t.status !== 'archived');
}

// ============================================
// Free hours calculation
// ============================================

export function calculateFreeHoursForDay(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  date: string,
): number {
  const dayTasks = filterTasksForDate(tasks, date).filter((t) => t.startTime && t.endTime);
  const dayBlocks = filterBlocksForDate(blocks, date).filter((b) => b.startTime && b.endTime);

  const totalWorkMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  
  let busyMinutes = 0;
  const allItems = [
    ...dayTasks.map((t) => ({ start: t.startTime, end: t.endTime })),
    ...dayBlocks.map((b) => ({ start: b.startTime, end: b.endTime })),
  ];

  for (const item of allItems) {
    busyMinutes += calculateDurationMinutes(item.start, item.end);
  }

  const freeMinutes = Math.max(0, totalWorkMinutes - busyMinutes);
  return Math.round((freeMinutes / 60) * 10) / 10; // 1 decimal
}

// ============================================
// Statistics
// ============================================

export function calculateDayStats(tasks: PlanningTask[], blocks: PlanningBlock[], date: string) {
  const dayTasks = filterTasksForDate(tasks, date);
  const dayBlocks = filterBlocksForDate(blocks, date);
  const today = todayString();
  const allTasks = tasks;

  const followUpsOverdue = allTasks.filter(
    (t) =>
      t.type === 'follow_up' &&
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      t.date < today,
  );

  const maxPriorityTasks = dayTasks.filter(
    (t) => t.priority === 'max' && t.status !== 'completed' && t.status !== 'archived',
  );

  const completedToday = dayTasks.filter((t) => t.status === 'completed');
  const pendingToday = dayTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');

  return {
    totalAppointments: dayTasks.filter((t) => t.type === 'meeting' || t.type === 'call').length,
    totalTasks: dayTasks.length,
    totalBlocks: dayBlocks.length,
    followUpsOverdue: followUpsOverdue.length,
    maxPriority: maxPriorityTasks.length,
    freeHours: calculateFreeHoursForDay(tasks, blocks, date),
    completedCount: completedToday.length,
    pendingCount: pendingToday.length,
  };
}

// ============================================
// Default values for new items
// ============================================

export function createDefaultTask(overrides: Partial<PlanningTask> = {}): Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    description: '',
    type: 'general',
    origin: 'manual',
    linkedEntityType: 'none',
    linkedEntityId: '',
    linkedEntityName: '',
    date: todayString(),
    startTime: '',
    endTime: '',
    durationMinutes: 0,
    priority: 'medium',
    status: 'pending',
    isRecurring: false,
    recurrenceRule: '',
    notes: '',
    completionNote: '',
    ...overrides,
  };
}

export function createDefaultBlock(overrides: Partial<PlanningBlock> = {}): Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    category: 'general',
    date: todayString(),
    startTime: '',
    endTime: '',
    durationMinutes: 0,
    priority: 'medium',
    notes: '',
    ...overrides,
  };
}

// ============================================
// Greeting based on time of day
// ============================================

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function generateContextMessage(
  appointments: number,
  tasks: number,
  overdueFollowUps: number,
  freeHours: number,
): string {
  const parts: string[] = [];
  if (appointments > 0) parts.push(`${appointments} compromisso${appointments > 1 ? 's' : ''}`);
  if (tasks > 0) parts.push(`${tasks} tarefa${tasks > 1 ? 's' : ''}`);
  if (overdueFollowUps > 0) parts.push(`${overdueFollowUps} follow-up${overdueFollowUps > 1 ? 's' : ''} vencido${overdueFollowUps > 1 ? 's' : ''}`);
  if (freeHours > 0) parts.push(`${freeHours}h livre${freeHours > 1 ? 's' : ''}`);

  if (parts.length === 0) return 'Nenhum compromisso registrado para hoje.';

  return `Hoje você tem ${parts.join(', ')}.`;
}
