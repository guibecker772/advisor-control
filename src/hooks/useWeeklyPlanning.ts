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

  return {
    weekDays,
    weekData,
    unscheduledTasks,
    weekPriorities,
    overdueForWeek,
    weekGoals,
  };
}
