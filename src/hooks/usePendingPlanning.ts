import { useMemo, useState } from 'react';
import type { PlanningTask, TaskType, TaskOrigin, TaskPriority, TaskStatus } from '../domain/planning/planningTypes';
import {
  filterPendingTasks,
  filterOverdueTasks,
  filterTodayTasks,
  filterWeekTasks,
  sortByPriority,
  todayString,
} from '../domain/planning/planningUtils';

export type ImpactType = 'revenue' | 'relationship' | 'operational';

export interface PendingFilters {
  timeRange: 'all' | 'overdue' | 'today' | 'week' | 'no_date';
  type: TaskType | 'all';
  origin: TaskOrigin | 'all';
  priority: TaskPriority | 'all';
  status: TaskStatus | 'all';
  search: string;
  impact: ImpactType | 'all';
  entityType: 'all' | 'client' | 'prospect' | 'offer';
}

const defaultFilters: PendingFilters = {
  timeRange: 'all',
  type: 'all',
  origin: 'all',
  priority: 'all',
  status: 'all',
  search: '',
  impact: 'all',
  entityType: 'all',
};

export interface PendingChipCounts {
  overdue: number;
  today: number;
  highPriority: number;
  followUp: number;
  withClient: number;
  withProspect: number;
  withOffer: number;
  noDate: number;
}

/** Classify a task by its commercial impact. */
export function deriveImpact(task: PlanningTask): ImpactType {
  // Revenue: meetings, portfolio reviews, offers, prospecting
  if (
    task.type === 'meeting' ||
    task.type === 'portfolio_review' ||
    task.type === 'prospecting'
  ) {
    return 'revenue';
  }
  // Revenue: tasks linked to prospects or with high/max priority follow-ups
  if (task.linkedEntityType === 'prospect') {
    return 'revenue';
  }
  // Relationship: follow-ups, calls, linked to existing clients
  if (
    task.type === 'follow_up' ||
    task.type === 'call' ||
    task.linkedEntityType === 'client'
  ) {
    return 'relationship';
  }
  return 'operational';
}

export function usePendingPlanning(tasks: PlanningTask[]) {
  const [filters, setFilters] = useState<PendingFilters>(defaultFilters);
  const today = todayString();

  const pendingTasks = useMemo(() => filterPendingTasks(tasks), [tasks]);

  // Chip counts — computed from ALL pending (before filters)
  const chipCounts: PendingChipCounts = useMemo(() => {
    const overdue = pendingTasks.filter((t) => t.date && t.date < today).length;
    const todayCount = pendingTasks.filter((t) => t.date === today).length;
    const highPriority = pendingTasks.filter(
      (t) => t.priority === 'max' || t.priority === 'high',
    ).length;
    const followUp = pendingTasks.filter((t) => t.type === 'follow_up').length;
    const withClient = pendingTasks.filter((t) => t.linkedEntityType === 'client').length;
    const withProspect = pendingTasks.filter((t) => t.linkedEntityType === 'prospect').length;
    const withOffer = pendingTasks.filter((t) => t.linkedEntityType === 'offer').length;
    const noDate = pendingTasks.filter((t) => !t.date).length;

    return { overdue, today: todayCount, highPriority, followUp, withClient, withProspect, withOffer, noDate };
  }, [pendingTasks, today]);

  const filteredTasks = useMemo(() => {
    let result = pendingTasks;

    // Time range filter
    if (filters.timeRange === 'overdue') {
      result = filterOverdueTasks(result);
    } else if (filters.timeRange === 'today') {
      result = filterTodayTasks(result);
    } else if (filters.timeRange === 'week') {
      result = filterWeekTasks(result);
    } else if (filters.timeRange === 'no_date') {
      result = result.filter((t) => !t.date);
    }

    // Type filter
    if (filters.type !== 'all') {
      result = result.filter((t) => t.type === filters.type);
    }

    // Origin filter
    if (filters.origin !== 'all') {
      result = result.filter((t) => t.origin === filters.origin);
    }

    // Priority filter
    if (filters.priority !== 'all') {
      result = result.filter((t) => t.priority === filters.priority);
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status);
    }

    // Impact filter
    if (filters.impact !== 'all') {
      result = result.filter((t) => deriveImpact(t) === filters.impact);
    }

    // Entity type filter
    if (filters.entityType !== 'all') {
      result = result.filter((t) => t.linkedEntityType === filters.entityType);
    }

    // Search filter
    if (filters.search.trim()) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(term) ||
          (t.linkedEntityName || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term),
      );
    }

    return sortByPriority(result);
  }, [pendingTasks, filters]);

  const hasActiveFilters = useMemo(
    () =>
      filters.timeRange !== 'all' ||
      filters.type !== 'all' ||
      filters.origin !== 'all' ||
      filters.priority !== 'all' ||
      filters.status !== 'all' ||
      filters.impact !== 'all' ||
      filters.entityType !== 'all' ||
      filters.search.trim() !== '',
    [filters],
  );

  const clearFilters = () => setFilters(defaultFilters);

  const updateFilter = <K extends keyof PendingFilters>(key: K, value: PendingFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    filteredTasks,
    totalPending: pendingTasks.length,
    chipCounts,
    hasActiveFilters,
    deriveImpact,
  };
}
