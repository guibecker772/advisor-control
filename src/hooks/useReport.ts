import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { DailyReview, ChecklistItem, FocusSessionRecord } from '../domain/planning/planningTypes';
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
  const [focusSessions, setFocusSessions] = useState<FocusSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExtraData = useCallback(async () => {
    if (authLoading || !ownerUid) {
      setReviews([]);
      setWeekChecklistItems([]);
      setMonthChecklistItems([]);
      setFocusSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [reviewList, weekCl, monthCl, focusList] = await Promise.all([
        planningService.listDailyReviews(ownerUid),
        planningService.getWeeklyChecklist(getWeekKey(), ownerUid),
        planningService.getMonthlyChecklist(getMonthKey(), ownerUid),
        planningService.listFocusSessions(ownerUid),
      ]);
      setReviews(reviewList);
      setWeekChecklistItems(weekCl?.items ?? []);
      setMonthChecklistItems(monthCl?.items ?? []);
      setFocusSessions(focusList);
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
      return computeWeekReport(tasks, blocks, reviews, checklistItems, undefined, focusSessions);
    }
    return computeMonthReport(tasks, blocks, reviews, checklistItems, undefined, focusSessions);
  }, [period, tasks, blocks, reviews, weekChecklistItems, monthChecklistItems, focusSessions, loading]);

  return {
    period,
    setPeriod,
    metrics,
    loading,
    reload: loadExtraData,
  };
}
