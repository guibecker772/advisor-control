// ==========================================
// Enums / Constants as union types
// ==========================================

export type TaskType =
  | 'meeting'
  | 'call'
  | 'follow_up'
  | 'prospecting'
  | 'admin'
  | 'portfolio_review'
  | 'offer'
  | 'post_meeting'
  | 'general';

export type TaskOrigin =
  | 'manual'
  | 'agenda'
  | 'client'
  | 'prospect'
  | 'offer'
  | 'cross'
  | 'goal'
  | 'system';

export type LinkedEntityType =
  | 'client'
  | 'prospect'
  | 'offer'
  | 'cross'
  | 'goal'
  | 'none';

export type TaskPriority = 'max' | 'high' | 'medium' | 'low';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'postponed' | 'archived';

export type BlockCategory =
  | 'prospecting'
  | 'follow_up'
  | 'meetings'
  | 'admin'
  | 'study'
  | 'review'
  | 'offer'
  | 'deep_work'
  | 'general';

export type ChecklistPeriodType = 'weekly' | 'monthly';

// ==========================================
// Entities
// ==========================================

export interface PlanningTask {
  id?: string;
  ownerUid?: string;
  title: string;
  description: string;
  type: TaskType;
  origin: TaskOrigin;
  linkedEntityType: LinkedEntityType;
  linkedEntityId: string;
  linkedEntityName: string;
  date: string; // ISO date string YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  isRecurring: boolean;
  recurrenceRule: string;
  notes: string;
  completionNote: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanningBlock {
  id?: string;
  ownerUid?: string;
  title: string;
  category: BlockCategory;
  date: string; // ISO date string YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  priority: TaskPriority;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyReview {
  id?: string;
  ownerUid?: string;
  date: string; // ISO date string YYYY-MM-DD
  completedCount: number;
  pendingCount: number;
  rescheduledCount: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt: string;
  periodType: ChecklistPeriodType;
  sortOrder: number;
}

export interface WeeklyChecklistState {
  id?: string;
  ownerUid?: string;
  weekKey: string; // e.g. "2026-W11"
  items: ChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthlyChecklistState {
  id?: string;
  ownerUid?: string;
  monthKey: string; // e.g. "2026-03"
  items: ChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// Form input types (for creating/editing)
// ==========================================

// ==========================================
// Automation Preferences (per-user)
// ==========================================

/** Thresholds that control when alerts fire. */
export interface AlertThresholds {
  /** Days without contact before a prospect is considered idle. Default: 7 */
  prospectIdleDays: number;
  /** Days without contact before a client alert fires. Default: 14 */
  clientNoContactDays: number;
  /** Max tasks per day before overflow alert. Default: 10 */
  overflowTaskLimit: number;
  /** Minimum overdue non-follow-up tasks to trigger reactivation opportunity. Default: 3 */
  reactivationThreshold: number;
}

/** Thresholds for suggestion engine. */
export interface SuggestionThresholds {
  /** Minimum free hours in a day to suggest a prospecting block. Default: 2 */
  freeHoursForBlock: number;
  /** Max pending tasks before "high pending" warning. Default: 10 */
  highPendingLimit: number;
}

/** Per-trigger toggle + priority override. */
export interface AutomationRulePreference {
  enabled: boolean;
  priority: TaskPriority;
}

/** All automation rule toggles keyed by trigger name. */
export interface AutomationRulePreferences {
  meeting_created: AutomationRulePreference;
  prospect_idle: AutomationRulePreference;
  offer_pending: AutomationRulePreference;
  client_no_contact: AutomationRulePreference;
  goal_behind: AutomationRulePreference;
  cross_opportunity: AutomationRulePreference;
}

/** Complete automation preferences document stored per user. */
export interface AutomationPreferences {
  id?: string;
  ownerUid?: string;
  alertThresholds: AlertThresholds;
  suggestionThresholds: SuggestionThresholds;
  rulePreferences: AutomationRulePreferences;
  createdAt?: string;
  updatedAt?: string;
}

export type PlanningTaskInput = Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

export type PlanningBlockInput = Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

export type DailyReviewInput = Omit<DailyReview, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

/** Checklist summary data for cross-component usage. */
export interface ChecklistSummary {
  weeklyProgress: number;
  weeklyTotal: number;
  weeklyChecked: number;
  weeklyPending: ChecklistItem[];
  monthlyProgress: number;
  monthlyTotal: number;
  monthlyChecked: number;
  monthlyPending: ChecklistItem[];
}
