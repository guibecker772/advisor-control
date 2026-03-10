import { useMemo } from 'react';
import { getDaysInMonth, getDay, startOfMonth } from 'date-fns';
import type { PlanningTask, PlanningBlock } from '../domain/planning/planningTypes';
import {
  filterMonthTasks,
  filterPendingTasks,
  filterFollowUps,
  toDateString,
  filterTasksForDate,
  filterBlocksForDate,
  todayString,
} from '../domain/planning/planningUtils';

export interface MonthDayData {
  day: number;
  dateString: string;
  taskCount: number;
  blockCount: number;
  hasMaxPriority: boolean;
  hasFollowUp: boolean;
  isMilestone: boolean;
}

export interface MonthFocus {
  strategicOpen: number;
  followUpsOpen: number;
  milestoneCount: number;
  weeksRemaining: number;
  linkedEntities: string[];
}

export interface MonthAttention {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium';
}

export function useMonthlyPlanning(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
  referenceDate: Date = new Date(),
) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = getDaysInMonth(referenceDate);
  const firstDayOfWeek = getDay(startOfMonth(referenceDate));
  const today = todayString();

  const monthTasks = useMemo(
    () => filterMonthTasks(tasks, referenceDate),
    [tasks, referenceDate],
  );

  const pendingMonthTasks = useMemo(
    () => filterPendingTasks(monthTasks),
    [monthTasks],
  );

  const followUpsOpen = useMemo(
    () =>
      filterFollowUps(monthTasks).filter(
        (t) => t.status !== 'completed' && t.status !== 'archived',
      ),
    [monthTasks],
  );

  const monthDays: MonthDayData[] = useMemo(() => {
    const result: MonthDayData[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = toDateString(date);
      const dayTasks = filterTasksForDate(tasks, dateStr);
      const dayBlocks = filterBlocksForDate(blocks, dateStr);
      result.push({
        day: d,
        dateString: dateStr,
        taskCount: dayTasks.length,
        blockCount: dayBlocks.length,
        hasMaxPriority: dayTasks.some(
          (t) => t.priority === 'max' && t.status !== 'completed',
        ),
        hasFollowUp: dayTasks.some(
          (t) => t.type === 'follow_up' && t.status !== 'completed' && t.status !== 'archived',
        ),
        isMilestone: dayTasks.some(
          (t) => (t.priority === 'max' || t.priority === 'high') && (t.type === 'meeting' || t.type === 'portfolio_review'),
        ),
      });
    }
    return result;
  }, [year, month, daysInMonth, tasks, blocks]);

  const weeksRemaining = useMemo(() => {
    const todayDate = new Date();
    const endOfMonth = new Date(year, month + 1, 0);
    if (todayDate > endOfMonth) return 0;
    const daysLeft = Math.max(0, endOfMonth.getDate() - todayDate.getDate());
    return Math.ceil(daysLeft / 7);
  }, [year, month]);

  const milestones = useMemo(
    () =>
      monthTasks
        .filter(
          (t) =>
            t.priority === 'max' ||
            t.priority === 'high' ||
            t.type === 'meeting' ||
            t.type === 'portfolio_review',
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 15),
    [monthTasks],
  );

  // Month focus data
  const monthFocus: MonthFocus = useMemo(() => {
    const strategicOpen = pendingMonthTasks.filter(
      (t) => t.priority === 'max' || t.priority === 'high',
    ).length;

    const linkedEntities = Array.from(
      new Set(
        pendingMonthTasks
          .filter((t) => t.linkedEntityName)
          .map((t) => t.linkedEntityName),
      ),
    ).slice(0, 5);

    return {
      strategicOpen,
      followUpsOpen: followUpsOpen.length,
      milestoneCount: milestones.length,
      weeksRemaining,
      linkedEntities,
    };
  }, [pendingMonthTasks, followUpsOpen, milestones, weeksRemaining]);

  // Month attentions
  const monthAttentions: MonthAttention[] = useMemo(() => {
    const attentions: MonthAttention[] = [];

    // Overdue tasks in this month
    const overdueInMonth = monthTasks.filter(
      (t) => t.date < today && t.status !== 'completed' && t.status !== 'archived',
    );
    if (overdueInMonth.length > 3) {
      attentions.push({
        id: 'overdue-accumulation',
        title: `${overdueInMonth.length} tarefas atrasadas no mês`,
        description: 'Acúmulo de pendências pode comprometer a execução.',
        severity: 'high',
      });
    }

    // Weeks with no tasks (empty weeks)
    const weekTaskCounts: number[] = [0, 0, 0, 0, 0];
    for (const day of monthDays) {
      const weekIndex = Math.min(4, Math.floor((day.day - 1) / 7));
      weekTaskCounts[weekIndex] += day.taskCount;
    }
    const emptyWeeks = weekTaskCounts.filter((c) => c === 0).length;
    if (emptyWeeks > 0 && weeksRemaining > 0) {
      attentions.push({
        id: 'empty-weeks',
        title: `${emptyWeeks} semana(s) sem atividade planejada`,
        description: 'Considere distribuir melhor as atividades do mês.',
        severity: 'medium',
      });
    }

    // Activity concentration at end of month
    const lastWeekTasks = monthDays
      .filter((d) => d.day > daysInMonth - 7)
      .reduce((sum, d) => sum + d.taskCount, 0);
    const firstWeekTasks = monthDays
      .filter((d) => d.day <= 7)
      .reduce((sum, d) => sum + d.taskCount, 0);
    if (lastWeekTasks > firstWeekTasks * 2 && lastWeekTasks > 5) {
      attentions.push({
        id: 'end-concentration',
        title: 'Concentração de atividades no fim do mês',
        description: 'Redistribua tarefas para evitar sobrecarga no fechamento.',
        severity: 'medium',
      });
    }

    // Follow-ups without progress
    if (followUpsOpen.length >= 5) {
      attentions.push({
        id: 'followup-backlog',
        title: `${followUpsOpen.length} follow-ups em aberto`,
        description: 'Alto volume de follow-ups pode indicar perda de controle do pipeline.',
        severity: 'high',
      });
    }

    return attentions;
  }, [monthTasks, monthDays, followUpsOpen, today, weeksRemaining, daysInMonth]);

  return {
    year,
    month,
    daysInMonth,
    firstDayOfWeek,
    monthTasks,
    pendingMonthTasks,
    followUpsOpen,
    monthDays,
    weeksRemaining,
    milestones,
    monthFocus,
    monthAttentions,
  };
}
