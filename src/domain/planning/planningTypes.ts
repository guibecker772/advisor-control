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
  /** Daily focus goal in minutes. Default: 120. */
  focusDailyGoalMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PlanningTaskInput = Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

export type PlanningBlockInput = Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

export type DailyReviewInput = Omit<DailyReview, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;

// ==========================================
// Weekly Pace (goal-driven execution)
// ==========================================

/** Configurable weekly operational target counts. */
export interface WeeklyPaceGoals {
  /** Target number of meetings per week. Default: 5 */
  meetings: number;
  /** Target number of follow-ups completed per week. Default: 10 */
  followUps: number;
  /** Target number of prospecting blocks per week. Default: 3 */
  prospectingBlocks: number;
  /** Target number of new contacts (calls + prospecting tasks) per week. Default: 5 */
  newContacts: number;
}

/** Progress status for a single metric. */
export interface WeeklyPaceMetric {
  label: string;
  actual: number;
  target: number;
  /** 0–100 percentage */
  pct: number;
  /** How many behind target (0 if on pace or ahead). */
  behindBy: number;
  status: 'on_track' | 'behind' | 'critical';
}

/** Overall weekly pace assessment. */
export interface WeeklyPaceStatus {
  weekLabel: string;
  /** Day-of-week index (1=Mon … 5=Fri, 6=Sat, 7=Sun). */
  dayOfWeek: number;
  /** Expected progress % based on day of week (e.g. Wed = 60%). */
  expectedPct: number;
  metrics: {
    meetings: WeeklyPaceMetric;
    followUps: WeeklyPaceMetric;
    prospectingBlocks: WeeklyPaceMetric;
    newContacts: WeeklyPaceMetric;
  };
  /** Number of metrics behind pace. */
  behindCount: number;
  /** Overall assessment. */
  overall: 'on_track' | 'behind' | 'critical';
  /** Actionable summary line. */
  summary: string;
}

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

// ==========================================
// Focus Session History
// ==========================================

/** How a focus session ended. */
export type FocusOutcome = 'completed' | 'interrupted';

/** A single completed focus session record (persisted). */
export interface FocusSessionRecord {
  id?: string;
  ownerUid?: string;
  createdAt?: string;
  updatedAt?: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** What the user was focusing on. */
  label: string;
  /** Source type that triggered the session. */
  sourceType: 'free' | 'task' | 'block';
  /** ID of linked task or block. */
  sourceId?: string;
  /** Category context (e.g. "Prospecção", "Follow-up"). */
  sourceContext?: string;
  /** How the session ended. */
  outcome: FocusOutcome;
  /** Number of full focus cycles completed. */
  cycleCount: number;
  /** Configured focus duration per cycle (minutes). */
  durationMinutes: number;
  /** Total minutes effectively focused (sum of all completed cycles + partial). */
  totalFocusedMinutes: number;
  /** ISO datetime when session started. */
  startedAt: string;
  /** ISO datetime when session ended. */
  endedAt: string;
  /** Optional user note on the session. */
  note?: string;
  /** Whether the linked task was marked as completed after the session. */
  taskCompleted?: boolean;
}
