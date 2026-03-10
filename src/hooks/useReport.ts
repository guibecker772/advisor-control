import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { DailyReview, ChecklistItem } from '../domain/planning/planningTypes';
import type { ReportMetrics } from '../domain/planning/reportMetrics';
import { computeWeekReport, computeMonthReport } from '../domain/planning/reportMetrics';
import * as planningService from '../services/planningService';
import { getWeekKey, getMonthKey } from '../domain/planning/planningUtils';
import type { PlanningTask, PlanningBlock } from '../domain/planning/planningTypes';

export type ReportPeriod = 'week' | 'month';

export function useReport(
  tasks: PlanningTask[],
  blocks: PlanningBlock[],
) {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;

  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [reviews, setReviews] = useState<DailyReview[]>([]);
  const [weekChecklistItems, setWeekChecklistItems] = useState<ChecklistItem[]>([]);
  const [monthChecklistItems, setMonthChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExtraData = useCallback(async () => {
    if (authLoading || !ownerUid) {
      setReviews([]);
      setWeekChecklistItems([]);
      setMonthChecklistItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [reviewList, weekCl, monthCl] = await Promise.all([
        planningService.listDailyReviews(ownerUid),
        planningService.getWeeklyChecklist(getWeekKey(), ownerUid),
        planningService.getMonthlyChecklist(getMonthKey(), ownerUid),
      ]);
      setReviews(reviewList);
      setWeekChecklistItems(weekCl?.items ?? []);
      setMonthChecklistItems(monthCl?.items ?? []);
    } catch (error) {
      console.error('[useReport] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid]);

  useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

  const metrics: ReportMetrics | null = useMemo(() => {
    if (loading) return null;
    const checklistItems = period === 'week' ? weekChecklistItems : monthChecklistItems;
    if (period === 'week') {
      return computeWeekReport(tasks, blocks, reviews, checklistItems);
    }
    return computeMonthReport(tasks, blocks, reviews, checklistItems);
  }, [period, tasks, blocks, reviews, weekChecklistItems, monthChecklistItems, loading]);

  return {
    period,
    setPeriod,
    metrics,
    loading,
    reload: loadExtraData,
  };
}
