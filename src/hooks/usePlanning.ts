import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { PlanningTask, PlanningBlock, DailyReview } from '../domain/planning/planningTypes';
import * as planningService from '../services/planningService';
import { subscribeDataInvalidation, emitDataInvalidation } from '../lib/dataInvalidation';

export function usePlanning() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;

  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [blocks, setBlocks] = useState<PlanningBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (authLoading || !ownerUid) {
      setTasks([]);
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [taskList, blockList] = await Promise.all([
        planningService.listTasks(ownerUid),
        planningService.listBlocks(ownerUid),
      ]);
      setTasks(taskList);
      setBlocks(blockList);
    } catch (error) {
      console.error('[usePlanning] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribeDataInvalidation(['planning'], () => loadData());
  }, [loadData]);

  const addTask = useCallback(
    async (data: Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>) => {
      if (!ownerUid) return null;
      const task = await planningService.createTask(data, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return task;
    },
    [ownerUid, loadData],
  );

  const editTask = useCallback(
    async (id: string, data: Partial<PlanningTask>) => {
      if (!ownerUid) return null;
      const updated = await planningService.updateTask(id, data, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const completeTask = useCallback(
    async (id: string, completionNote = '') => {
      if (!ownerUid) return null;
      const updated = await planningService.completeTask(id, completionNote, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const rescheduleTask = useCallback(
    async (id: string, newDate: string, startTime = '', endTime = '') => {
      if (!ownerUid) return null;
      const updated = await planningService.rescheduleTask(id, newDate, startTime, endTime, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const postponeTask = useCallback(
    async (id: string) => {
      if (!ownerUid) return null;
      const updated = await planningService.postponeTask(id, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const archiveTask = useCallback(
    async (id: string) => {
      if (!ownerUid) return null;
      const updated = await planningService.archiveTask(id, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const removeTask = useCallback(
    async (id: string) => {
      if (!ownerUid) return false;
      const result = await planningService.deleteTask(id, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return result;
    },
    [ownerUid, loadData],
  );

  const addBlock = useCallback(
    async (data: Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>) => {
      if (!ownerUid) return null;
      const block = await planningService.createBlock(data, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return block;
    },
    [ownerUid, loadData],
  );

  const editBlock = useCallback(
    async (id: string, data: Partial<PlanningBlock>) => {
      if (!ownerUid) return null;
      const updated = await planningService.updateBlock(id, data, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return updated;
    },
    [ownerUid, loadData],
  );

  const removeBlock = useCallback(
    async (id: string) => {
      if (!ownerUid) return false;
      const result = await planningService.deleteBlock(id, ownerUid);
      await loadData();
      emitDataInvalidation(['planning']);
      return result;
    },
    [ownerUid, loadData],
  );

  return {
    tasks,
    blocks,
    loading,
    reload: loadData,
    addTask,
    editTask,
    completeTask,
    rescheduleTask,
    postponeTask,
    archiveTask,
    removeTask,
    addBlock,
    editBlock,
    removeBlock,
  };
}
