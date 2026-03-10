import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { ChecklistItem, WeeklyChecklistState, MonthlyChecklistState } from '../domain/planning/planningTypes';
import * as planningService from '../services/planningService';
import { getWeekKey, getMonthKey } from '../domain/planning/planningUtils';

export function useChecklistPlanning() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;

  const [weeklyChecklist, setWeeklyChecklist] = useState<WeeklyChecklistState | null>(null);
  const [monthlyChecklist, setMonthlyChecklist] = useState<MonthlyChecklistState | null>(null);
  const [loading, setLoading] = useState(true);

  const currentWeekKey = getWeekKey();
  const currentMonthKey = getMonthKey();

  const loadChecklists = useCallback(async () => {
    if (authLoading || !ownerUid) {
      setWeeklyChecklist(null);
      setMonthlyChecklist(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [weekly, monthly] = await Promise.all([
        planningService.getWeeklyChecklist(currentWeekKey, ownerUid),
        planningService.getMonthlyChecklist(currentMonthKey, ownerUid),
      ]);
      setWeeklyChecklist(weekly);
      setMonthlyChecklist(monthly);
    } catch (error) {
      console.error('[useChecklistPlanning] Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid, currentWeekKey, currentMonthKey]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  const toggleWeeklyItem = useCallback(
    async (itemId: string) => {
      if (!ownerUid || !weeklyChecklist) return;
      const updatedItems = weeklyChecklist.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checked: !item.checked,
              checkedAt: !item.checked ? new Date().toISOString() : '',
            }
          : item,
      );
      setWeeklyChecklist((prev) => (prev ? { ...prev, items: updatedItems } : prev));
      await planningService.saveWeeklyChecklist(currentWeekKey, updatedItems, ownerUid);
    },
    [ownerUid, weeklyChecklist, currentWeekKey],
  );

  const toggleMonthlyItem = useCallback(
    async (itemId: string) => {
      if (!ownerUid || !monthlyChecklist) return;
      const updatedItems = monthlyChecklist.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checked: !item.checked,
              checkedAt: !item.checked ? new Date().toISOString() : '',
            }
          : item,
      );
      setMonthlyChecklist((prev) => (prev ? { ...prev, items: updatedItems } : prev));
      await planningService.saveMonthlyChecklist(currentMonthKey, updatedItems, ownerUid);
    },
    [ownerUid, monthlyChecklist, currentMonthKey],
  );

  const weeklyProgress = weeklyChecklist && weeklyChecklist.items.length > 0
    ? Math.round(
        (weeklyChecklist.items.filter((i) => i.checked).length / weeklyChecklist.items.length) *
          100,
      )
    : 0;

  const monthlyProgress = monthlyChecklist && monthlyChecklist.items.length > 0
    ? Math.round(
        (monthlyChecklist.items.filter((i) => i.checked).length /
          monthlyChecklist.items.length) *
          100,
      )
    : 0;

  return {
    weeklyChecklist,
    monthlyChecklist,
    loading,
    currentWeekKey,
    currentMonthKey,
    toggleWeeklyItem,
    toggleMonthlyItem,
    weeklyProgress,
    monthlyProgress,
    reload: loadChecklists,
  };
}
