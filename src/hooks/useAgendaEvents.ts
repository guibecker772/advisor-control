import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { CalendarEvent } from '../domain/types/calendar';
import { calendarEventRepository } from '../services/repositories';

export function useAgendaEvents() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (authLoading || !ownerUid) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await calendarEventRepository.getAll(ownerUid);
      setEvents(all.filter((e) => e.status !== 'cancelled'));
    } catch (error) {
      console.error('[useAgendaEvents] Erro ao carregar eventos:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { events, loading, reload: loadEvents };
}
