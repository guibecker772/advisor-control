import { useMemo } from 'react';
import type { PlanningTask, PlanningBlock } from '../domain/planning/planningTypes';
import {
  getWeekDays,
  filterTasksForDate,
  filterBlocksForDate,
  calculateFreeHoursForDay,
  toDateString,
  sortByTime,
  todayString,
  filterOverdueTasks,
} from '../domain/planning/planningUtils';
import { PRIORITY_ORDER } from '../domain/planning/planningConstants';

// ==========================================
// Undated task classification
// ==========================================

export interface UndatedTaskClassified {
  task: PlanningTask;
  /** Age in days since creation (0 if no createdAt). */
  ageDays: number;
  /** Impact category. */
  impact: 'high' | 'medium' | 'low';
  /** Suggested day index in weekDays (best free slot) or -1 if none. */
  suggestedDayIdx: number;
  /** Human-readable suggestion. */
  suggestion: string;
}

export interface UndatedSummary {
  total: number;
  highImpact: number;
  aging: number;
  items: UndatedTaskClassified[];
}

export interface WeekDayData {
  date: Date;
  dateString: string;
  tasks: PlanningTask[];
  blocks: PlanningBlock[];
  totalAppointments: number;
  totalTasks: number;
  freeHours: number;
  isToday: boolean;
  isEmpty: boolean;
  isOverloaded: boolean;
  hasHighPriority: boolean;
  hasCommercialBlock: boolean;
}

export interface WeekGoals {
  meetings: { done: number; target: number };
  followUpsDone: { done: number; target: number };
  newContacts: { done: number; target: number };
  prospectingBlocks: { done: number; target: number };
  tasksCompleted: { done: number; target: number };
}

export function useWeeklyPlanning(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  referenceDate: Date = new Date(),
) {
  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);
  const today = todayString();

  const weekData: WeekDayData[] = useMemo(
    () =>
      weekDays.map((day) => {
        const dateStr = toDateString(day);
        const dayTasks = sortByTime(filterTasksForDate(tasks, dateStr));
        const dayBlocks = sortByTime(filterBlocksForDate(blocks, dateStr));
        const activeTasks = dayTasks.filter((t) => t.status !== 'completed' && t.status !== 'archived');
        return {
          date: day,
          dateString: dateStr,
          tasks: dayTasks,
          blocks: dayBlocks,
          totalAppointments: dayTasks.filter(
            (t) => t.type === 'meeting' || t.type === 'call',
          ).length,
          totalTasks: dayTasks.length,
          freeHours: calculateFreeHoursForDay(tasks, blocks, dateStr),
          isToday: dateStr === today,
          isEmpty: dayTasks.length === 0 && dayBlocks.length === 0,
          isOverloaded: activeTasks.length >= 8 || calculateFreeHoursForDay(tasks, blocks, dateStr) <= 1,
          hasHighPriority: activeTasks.some((t) => t.priority === 'max' || t.priority === 'high'),
          hasCommercialBlock: dayBlocks.some((b) =>
            b.category === 'prospecting' || b.category === 'follow_up',
          ) || dayTasks.some((t) => t.type === 'prospecting'),
        };
      }),
    [weekDays, tasks, blocks, today],
  );

  const unscheduledTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.date &&
          t.status !== 'completed' &&
          t.status !== 'archived',
      ),
    [tasks],
  );

  const weekPriorities = useMemo(() => {
    const allWeekTasks = weekData.flatMap((d) => d.tasks);
    return allWeekTasks
      .filter(
        (t) =>
          t.status !== 'completed' &&
          t.status !== 'archived',
      )
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, 10);
  }, [weekData]);

  // Overdue follow-ups that need rescheduling into the week
  const overdueForWeek = useMemo(() => {
    return filterOverdueTasks(tasks)
      .filter((t) => t.type === 'follow_up')
      .slice(0, 5);
  }, [tasks]);

  // Week operational goals
  const weekGoals: WeekGoals = useMemo(() => {
    const allWeekTasks = weekData.flatMap((d) => d.tasks);
    const allWeekBlocks = weekData.flatMap((d) => d.blocks);

    return {
      meetings: {
        done: allWeekTasks.filter((t) => (t.type === 'meeting' || t.type === 'call') && t.status === 'completed').length,
        target: 10,
      },
      followUpsDone: {
        done: allWeekTasks.filter((t) => t.type === 'follow_up' && t.status === 'completed').length,
        target: 5,
      },
      newContacts: {
        done: allWeekTasks.filter((t) => t.type === 'prospecting' && t.status === 'completed').length,
        target: 3,
      },
      prospectingBlocks: {
        done: allWeekBlocks.filter((b) => b.category === 'prospecting').length,
        target: 2,
      },
      tasksCompleted: {
        done: allWeekTasks.filter((t) => t.status === 'completed').length,
        target: allWeekTasks.length || 1,
      },
    };
  }, [weekData]);

  // Classified undated tasks with suggestions
  const undatedSummary: UndatedSummary = useMemo(() => {
    const nowMs = Date.now();

    // Find the lightest future weekday for placement suggestions
    const futureDays = weekData
      .filter((d) => d.dateString >= today)
      .map((d, _i) => ({
        ...d,
        originalIdx: weekData.indexOf(d),
      }));

    const items: UndatedTaskClassified[] = unscheduledTasks.map((task) => {
      const ageDays = task.createdAt
        ? Math.floor((nowMs - new Date(task.createdAt).getTime()) / 86400000)
        : 0;

      // Impact: high if linked to entity, high/max priority, or follow_up/prospecting
      let impact: UndatedTaskClassified['impact'] = 'low';
      if (
        task.priority === 'max' || task.priority === 'high' ||
        task.linkedEntityType !== 'none' ||
        task.type === 'follow_up' || task.type === 'prospecting' || task.type === 'offer'
      ) {
        impact = 'high';
      } else if (task.type === 'call' || task.type === 'meeting' || ageDays >= 7) {
        impact = 'medium';
      }

      // Suggest the lightest day for this task
      let suggestedDayIdx = -1;
      let suggestion = 'Encaixar na semana';
      if (futureDays.length > 0) {
        // Sort by free hours desc, pick the one with most room
        const best = [...futureDays].sort((a, b) => b.freeHours - a.freeHours)[0];
        if (best.freeHours >= 1) {
          suggestedDayIdx = best.originalIdx;
          suggestion = `Encaixar ${best.dateString === today ? 'hoje' : best.dateString.slice(5).replace('-', '/')}`;
        }
      }

      return { task, ageDays, impact, suggestedDayIdx, suggestion };
    });

    // Sort: high impact first, then aging (oldest first)
    items.sort((a, b) => {
      const impOrd = { high: 0, medium: 1, low: 2 };
      if (impOrd[a.impact] !== impOrd[b.impact]) return impOrd[a.impact] - impOrd[b.impact];
      return b.ageDays - a.ageDays;
    });

    return {
      total: items.length,
      highImpact: items.filter((i) => i.impact === 'high').length,
      aging: items.filter((i) => i.ageDays >= 7).length,
      items,
    };
  }, [unscheduledTasks, weekData, today]);

  return {
    weekDays,
    weekData,
    unscheduledTasks,
    undatedSummary,
    weekPriorities,
    overdueForWeek,
    weekGoals,
  };
}
