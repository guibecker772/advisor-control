import { useMemo } from 'react';
import type { PlanningTask, PlanningBlock, AutomationPreferences } from '../domain/planning/planningTypes';
import { addDays } from 'date-fns';
import {
  todayString,
  toDateString,
  filterTasksForDate,
  filterBlocksForDate,
  filterOverdueTasks,
  filterMaxPriority,
  calculateDayStats,
  sortByTime,
  sortByPriority,
} from '../domain/planning/planningUtils';
import {
  computeNextAction,
  computeTop5Priorities,
  computeEntityAlerts,
  computeRadar,
  computeFreeSlotSuggestions,
  computeSmartBanner,
} from '../domain/planning/planningIntelligence';
import {
  scanForAlerts,
  scanForOpportunities,
} from '../domain/planning/planningIntegration';

export function useTodayPlanning(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  automationPrefs?: AutomationPreferences,
) {
  const today = todayString();

  const todayTasks = useMemo(() => filterTasksForDate(tasks, today), [tasks, today]);
  const todayBlocks = useMemo(() => filterBlocksForDate(blocks, today), [blocks, today]);
  const overdueTasks = useMemo(() => filterOverdueTasks(tasks), [tasks]);
  const overdueFollowUps = useMemo(
    () => overdueTasks.filter((t) => t.type === 'follow_up'),
    [overdueTasks],
  );
  const maxPriorityTasks = useMemo(() => filterMaxPriority(todayTasks), [todayTasks]);

  const timelineTasks = useMemo(() => sortByTime(todayTasks), [todayTasks]);
  const timelineBlocks = useMemo(() => sortByTime(todayBlocks), [todayBlocks]);

  const priorities = useMemo(
    () =>
      sortByPriority(
        todayTasks.filter(
          (t) => t.status !== 'completed' && t.status !== 'archived',
        ),
      ).slice(0, 5),
    [todayTasks],
  );

  const stats = useMemo(
    () => calculateDayStats(tasks, blocks, today),
    [tasks, blocks, today],
  );

  // Intelligence layer
  const nextAction = useMemo(() => computeNextAction(tasks, blocks), [tasks, blocks]);
  const top5 = useMemo(() => computeTop5Priorities(tasks), [tasks]);
  const entityAlerts = useMemo(() => computeEntityAlerts(tasks), [tasks]);
  const radar = useMemo(() => computeRadar(tasks, blocks), [tasks, blocks]);
  const freeSlots = useMemo(() => computeFreeSlotSuggestions(tasks, blocks), [tasks, blocks]);
  const smartBanner = useMemo(() => computeSmartBanner(tasks, blocks), [tasks, blocks]);

  // Automation layer — structured alerts and opportunities (uses user preferences)
  const alertThresholds = automationPrefs?.alertThresholds;
  const rulePreferences = automationPrefs?.rulePreferences;
  const automationAlerts = useMemo(
    () => scanForAlerts(tasks, today, alertThresholds, rulePreferences),
    [tasks, today, alertThresholds, rulePreferences],
  );
  const automationOpportunities = useMemo(
    () => scanForOpportunities(tasks, today, alertThresholds),
    [tasks, today, alertThresholds],
  );

  // Overflow / tomorrow data
  const tomorrow = useMemo(() => toDateString(addDays(new Date(), 1)), []);

  const overflowTasks = useMemo(
    () =>
      todayTasks.filter(
        (t) => t.status === 'pending' || t.status === 'in_progress',
      ),
    [todayTasks],
  );

  const tomorrowTasks = useMemo(
    () => filterTasksForDate(tasks, tomorrow),
    [tasks, tomorrow],
  );

  const tomorrowPriority1 = useMemo(() => {
    const pendingTomorrow = tomorrowTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'archived',
    );
    const sorted = sortByPriority(pendingTomorrow);
    return sorted.length > 0 ? sorted[0] : null;
  }, [tomorrowTasks]);

  const tomorrowMainPending = useMemo(() => {
    // The main pending for tomorrow: first overdue follow-up, or highest priority overflow task
    const overdueFollowUp = overdueTasks.find((t) => t.type === 'follow_up');
    if (overdueFollowUp) return overdueFollowUp;
    // Otherwise, the hardest overflow task
    const sorted = sortByPriority(overflowTasks);
    return sorted.length > 0 ? sorted[0] : null;
  }, [overdueTasks, overflowTasks]);

  return {
    today,
    todayTasks,
    todayBlocks,
    overdueTasks,
    overdueFollowUps,
    maxPriorityTasks,
    timelineTasks,
    timelineBlocks,
    priorities,
    stats,
    // Intelligence
    nextAction,
    top5,
    entityAlerts,
    radar,
    freeSlots,
    smartBanner,
    // Automation layer
    automationAlerts,
    automationOpportunities,
    // Overflow / tomorrow
    overflowTasks,
    tomorrowTasks,
    tomorrowPriority1,
    tomorrowMainPending,
    tomorrow,
  };
}
