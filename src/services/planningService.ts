import type {
  PlanningTask,
  PlanningBlock,
  DailyReview,
  WeeklyChecklistState,
  MonthlyChecklistState,
  ChecklistItem,
  AutomationPreferences,
} from '../domain/planning/planningTypes';
import {
  planningTaskRepository,
  planningBlockRepository,
  dailyReviewRepository,
  weeklyChecklistRepository,
  monthlyChecklistRepository,
  automationPreferencesRepository,
} from './repositories';
import { DEFAULT_WEEKLY_CHECKLIST, DEFAULT_MONTHLY_CHECKLIST, DEFAULT_AUTOMATION_PREFERENCES } from '../domain/planning/planningConstants';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ==========================================
// Tasks
// ==========================================

export async function listTasks(ownerUid: string): Promise<PlanningTask[]> {
  return planningTaskRepository.getAll(ownerUid);
}

export async function createTask(
  data: Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>,
  ownerUid: string,
): Promise<PlanningTask> {
  return planningTaskRepository.create(data as Omit<PlanningTask, 'id'>, ownerUid);
}

export async function updateTask(
  id: string,
  data: Partial<PlanningTask>,
  ownerUid: string,
): Promise<PlanningTask | null> {
  return planningTaskRepository.update(id, data, ownerUid);
}

export async function completeTask(
  id: string,
  completionNote: string,
  ownerUid: string,
): Promise<PlanningTask | null> {
  return planningTaskRepository.update(id, { status: 'completed', completionNote }, ownerUid);
}

export async function rescheduleTask(
  id: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  ownerUid: string,
): Promise<PlanningTask | null> {
  return planningTaskRepository.update(
    id,
    { date: newDate, startTime: newStartTime, endTime: newEndTime, status: 'pending' },
    ownerUid,
  );
}

export async function postponeTask(id: string, ownerUid: string): Promise<PlanningTask | null> {
  return planningTaskRepository.update(id, { status: 'postponed' }, ownerUid);
}

export async function archiveTask(id: string, ownerUid: string): Promise<PlanningTask | null> {
  return planningTaskRepository.update(id, { status: 'archived' }, ownerUid);
}

export async function deleteTask(id: string, ownerUid: string): Promise<boolean> {
  return planningTaskRepository.delete(id, ownerUid);
}

// ==========================================
// Blocks
// ==========================================

export async function listBlocks(ownerUid: string): Promise<PlanningBlock[]> {
  return planningBlockRepository.getAll(ownerUid);
}

export async function createBlock(
  data: Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>,
  ownerUid: string,
): Promise<PlanningBlock> {
  return planningBlockRepository.create(data as Omit<PlanningBlock, 'id'>, ownerUid);
}

export async function updateBlock(
  id: string,
  data: Partial<PlanningBlock>,
  ownerUid: string,
): Promise<PlanningBlock | null> {
  return planningBlockRepository.update(id, data, ownerUid);
}

export async function deleteBlock(id: string, ownerUid: string): Promise<boolean> {
  return planningBlockRepository.delete(id, ownerUid);
}

// ==========================================
// Daily Reviews
// ==========================================

export async function listDailyReviews(ownerUid: string): Promise<DailyReview[]> {
  return dailyReviewRepository.getAll(ownerUid);
}

export async function saveDailyReview(
  data: Omit<DailyReview, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>,
  ownerUid: string,
): Promise<DailyReview> {
  // Check if a review already exists for this date
  const all = await dailyReviewRepository.getAll(ownerUid);
  const existing = all.find((r) => r.date === data.date);
  if (existing && existing.id) {
    const updated = await dailyReviewRepository.update(existing.id, data, ownerUid);
    return updated ?? existing;
  }
  return dailyReviewRepository.create(data as Omit<DailyReview, 'id'>, ownerUid);
}

export async function getDailyReview(date: string, ownerUid: string): Promise<DailyReview | null> {
  const all = await dailyReviewRepository.getAll(ownerUid);
  return all.find((r) => r.date === date) ?? null;
}

// ==========================================
// Weekly Checklist
// ==========================================

export async function getWeeklyChecklist(
  weekKey: string,
  ownerUid: string,
): Promise<WeeklyChecklistState> {
  const all = await weeklyChecklistRepository.getAll(ownerUid);
  const existing = all.find((c) => c.weekKey === weekKey);
  if (existing) return existing;

  // Create default checklist for this week
  const defaultItems: ChecklistItem[] = DEFAULT_WEEKLY_CHECKLIST.map((item, index) => ({
    ...item,
    id: generateId() + index,
  }));

  return weeklyChecklistRepository.create(
    { weekKey, items: defaultItems } as Omit<WeeklyChecklistState, 'id'>,
    ownerUid,
  );
}

export async function saveWeeklyChecklist(
  weekKey: string,
  items: ChecklistItem[],
  ownerUid: string,
): Promise<WeeklyChecklistState | null> {
  const all = await weeklyChecklistRepository.getAll(ownerUid);
  const existing = all.find((c) => c.weekKey === weekKey);
  if (existing && existing.id) {
    return weeklyChecklistRepository.update(existing.id, { items }, ownerUid);
  }
  return weeklyChecklistRepository.create(
    { weekKey, items } as Omit<WeeklyChecklistState, 'id'>,
    ownerUid,
  );
}

// ==========================================
// Monthly Checklist
// ==========================================

export async function getMonthlyChecklist(
  monthKey: string,
  ownerUid: string,
): Promise<MonthlyChecklistState> {
  const all = await monthlyChecklistRepository.getAll(ownerUid);
  const existing = all.find((c) => c.monthKey === monthKey);
  if (existing) return existing;

  // Create default checklist for this month
  const defaultItems: ChecklistItem[] = DEFAULT_MONTHLY_CHECKLIST.map((item, index) => ({
    ...item,
    id: generateId() + index,
  }));

  return monthlyChecklistRepository.create(
    { monthKey, items: defaultItems } as Omit<MonthlyChecklistState, 'id'>,
    ownerUid,
  );
}

export async function saveMonthlyChecklist(
  monthKey: string,
  items: ChecklistItem[],
  ownerUid: string,
): Promise<MonthlyChecklistState | null> {
  const all = await monthlyChecklistRepository.getAll(ownerUid);
  const existing = all.find((c) => c.monthKey === monthKey);
  if (existing && existing.id) {
    return monthlyChecklistRepository.update(existing.id, { items }, ownerUid);
  }
  return monthlyChecklistRepository.create(
    { monthKey, items } as Omit<MonthlyChecklistState, 'id'>,
    ownerUid,
  );
}

// ==========================================
// Automation Preferences
// ==========================================

/**
 * Returns the user's automation preferences.
 * Creates a document with defaults if none exists yet.
 */
export async function getAutomationPreferences(
  ownerUid: string,
): Promise<AutomationPreferences> {
  const all = await automationPreferencesRepository.getAll(ownerUid);
  if (all.length > 0) return all[0];

  // First access — persist defaults
  return automationPreferencesRepository.create(
    DEFAULT_AUTOMATION_PREFERENCES as Omit<AutomationPreferences, 'id'>,
    ownerUid,
  );
}

/**
 * Saves (upserts) the user's automation preferences.
 */
export async function saveAutomationPreferences(
  data: Partial<AutomationPreferences>,
  ownerUid: string,
): Promise<AutomationPreferences> {
  const all = await automationPreferencesRepository.getAll(ownerUid);
  if (all.length > 0 && all[0].id) {
    const updated = await automationPreferencesRepository.update(all[0].id, data, ownerUid);
    return updated ?? all[0];
  }

  // No existing document — create with defaults merged
  return automationPreferencesRepository.create(
    { ...DEFAULT_AUTOMATION_PREFERENCES, ...data } as Omit<AutomationPreferences, 'id'>,
    ownerUid,
  );
}
