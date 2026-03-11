import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationRepository,
  calendarEventRepository,
  eventReminderRepository,
  planningTaskRepository,
  planningBlockRepository,
  automationPreferencesRepository,
} from '../services/repositories';
import type { Notification } from '../domain/types/calendar';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { addMinutes, isBefore, isAfter, parseISO } from 'date-fns';
import {
  computeOverdueFollowUps,
  computeRelationshipAlerts,
  computeFreeSlotSuggestions,
  computeSmartBanner,
  computeWeeklyPace,
  detectPostMeetingPrompts,
} from '../domain/planning/planningIntelligence';
import { scanForAlerts } from '../domain/planning/planningIntegration';
import { generatePlanningNotifications } from '../domain/planning/planningNotifications';
import { todayString, filterTasksForDate } from '../domain/planning/planningUtils';

interface NotificationContextData {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextData | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ownerUid = user?.uid;

  // Carregar notificações
  const loadNotifications = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const all = await notificationRepository.getAll(ownerUid);
      // Smart sort: priority-weighted with unread bonus and recency
      const PRIORITY_W: Record<string, number> = { critical: 40, high: 30, normal: 10, low: 0 };
      const CATEGORY_W: Record<string, number> = { urgente: 50, hoje: 30, sugestoes: 10, planejamento: 5, agenda: 0 };
      const now = Date.now();
      const sorted = all.sort((a, b) => {
        const scoreA =
          (PRIORITY_W[a.priority ?? 'normal'] ?? 10) +
          (CATEGORY_W[a.category ?? 'agenda'] ?? 0) +
          (a.read ? 0 : 20) +
          Math.max(0, 10 - (now - new Date(a.createdAt || 0).getTime()) / 3_600_000);
        const scoreB =
          (PRIORITY_W[b.priority ?? 'normal'] ?? 10) +
          (CATEGORY_W[b.category ?? 'agenda'] ?? 0) +
          (b.read ? 0 : 20) +
          Math.max(0, 10 - (now - new Date(b.createdAt || 0).getTime()) / 3_600_000);
        return scoreB - scoreA;
      });
      setNotifications(sorted);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, ownerUid]);

  // Verificar e criar lembretes para eventos futuros
  const checkAndCreateReminders = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) return;

    try {
      const events = await calendarEventRepository.getAll(ownerUid);
      const existingReminders = await eventReminderRepository.getAll(ownerUid);
      const now = new Date();
      
      // Para cada evento futuro não cancelado
      for (const event of events) {
        if (event.status === 'cancelled') continue;
        
        const eventStart = parseISO(event.start);
        if (isBefore(eventStart, now)) continue; // Evento já passou
        
        // Verificar se precisamos criar lembretes de 60 e 30 min
        const reminder60At = addMinutes(eventStart, -60);
        const reminder30At = addMinutes(eventStart, -30);
        
        // Lembrete de 60 min
        const has60 = existingReminders.some(
          r => r.eventId === event.id && r.minutesBefore === 60
        );
        if (!has60 && isAfter(reminder60At, now)) {
          await eventReminderRepository.create({
            eventId: event.id!,
            minutesBefore: 60,
            remindAt: reminder60At.toISOString(),
          }, ownerUid);
        }
        
        // Lembrete de 30 min
        const has30 = existingReminders.some(
          r => r.eventId === event.id && r.minutesBefore === 30
        );
        if (!has30 && isAfter(reminder30At, now)) {
          await eventReminderRepository.create({
            eventId: event.id!,
            minutesBefore: 30,
            remindAt: reminder30At.toISOString(),
          }, ownerUid);
        }
      }
    } catch (error) {
      console.error('Erro ao criar lembretes:', error);
    }
  }, [authLoading, ownerUid]);

  // Disparar notificações para lembretes que chegaram no horário
  const triggerDueReminders = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) return;

    try {
      const reminders = await eventReminderRepository.getAll(ownerUid);
      const events = await calendarEventRepository.getAll(ownerUid);
      const now = new Date();
      
      for (const reminder of reminders) {
        // Se já foi enviado, pular
        if (reminder.notificationSentAt) continue;
        
        const remindAt = parseISO(reminder.remindAt);
        
        // Se chegou a hora (ou passou até 5 min)
        if (isBefore(remindAt, now) && isAfter(addMinutes(remindAt, 5), now)) {
          const event = events.find(e => e.id === reminder.eventId);
          if (!event || event.status === 'cancelled') continue;
          
          // Criar notificação in-app
          const notificationType = reminder.minutesBefore === 60 ? 'reminder_60min' : 'reminder_30min';
          const timeLabel = reminder.minutesBefore === 60 ? '1 hora' : '30 minutos';
          
          await notificationRepository.create({
            type: notificationType,
            category: 'agenda',
            priority: reminder.minutesBefore === 30 ? 'high' : 'normal',
            eventId: event.id,
            eventTitle: event.title,
            eventStart: event.start,
            title: `Lembrete: ${event.title}`,
            message: `Sua reunião começa em ${timeLabel}`,
            actionLabel: 'Ver agenda',
            actionRoute: '/agendas',
            actions: [{ label: 'Ver agenda', route: '/agendas', variant: 'primary' }],
            read: false,
          }, ownerUid);
          
          // Marcar como enviado
          await eventReminderRepository.update(reminder.id!, {
            notificationSentAt: now.toISOString(),
          }, ownerUid);
          
          // Mostrar toast
          toast(`🔔 ${event.title} em ${timeLabel}`, {
            duration: 5000,
            icon: '📅',
          });
        }
      }
      
      // Recarregar notificações
      await loadNotifications();
    } catch (error) {
      console.error('Erro ao disparar lembretes:', error);
    }
  }, [authLoading, ownerUid, loadNotifications]);

  // Gerar notificações do Planejamento (dedup por dedupKey)
  const checkAndCreatePlanningNotifications = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) return;

    try {
      const [tasks, blocks, existingNotifs, prefsArr, calendarEvents] = await Promise.all([
        planningTaskRepository.getAll(ownerUid),
        planningBlockRepository.getAll(ownerUid),
        notificationRepository.getAll(ownerUid),
        automationPreferencesRepository.getAll(ownerUid),
        calendarEventRepository.getAll(ownerUid),
      ]);

      const automationPrefs = prefsArr.length > 0 ? prefsArr[0] : undefined;
      const today = todayString();
      const todayTasks = filterTasksForDate(tasks, today);

      // Compute intelligence outputs
      const weeklyPace = computeWeeklyPace(tasks, blocks);
      const overdueFollowUpAlerts = computeOverdueFollowUps(tasks);
      const relationshipAlerts = computeRelationshipAlerts(tasks, {
        clientNoContactDays: automationPrefs?.alertThresholds?.clientNoContactDays,
        prospectCoolingDays: automationPrefs?.alertThresholds?.prospectIdleDays,
      });
      const automationAlerts = scanForAlerts(
        tasks, today,
        automationPrefs?.alertThresholds,
        automationPrefs?.rulePreferences,
      );
      const freeSlots = computeFreeSlotSuggestions(tasks, blocks, weeklyPace);
      const smartBanner = computeSmartBanner(tasks, blocks, weeklyPace);

      // Generate candidates
      const postMeetingPrompts = detectPostMeetingPrompts(calendarEvents, tasks, today);

      const candidates = generatePlanningNotifications({
        tasks,
        overdueFollowUpAlerts,
        relationshipAlerts,
        automationAlerts,
        freeSlots,
        smartBanner,
        todayTaskCount: todayTasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length,
        weeklyPace,
        calendarEvents,
        postMeetingPrompts,
      });

      if (candidates.length === 0) return;

      // Dedup: check existing notifications by dedupKey
      const existingDedupKeys = new Set(
        existingNotifs
          .filter(n => n.dedupKey)
          .map(n => n.dedupKey),
      );

      const newCandidates = candidates.filter(
        c => c.dedupKey && !existingDedupKeys.has(c.dedupKey),
      );

      // Persist new notifications
      for (const candidate of newCandidates) {
        await notificationRepository.create({
          ...candidate,
          message: candidate.message ?? '',
          category: candidate.category ?? 'agenda',
          priority: candidate.priority ?? 'normal',
          actions: (candidate.actions ?? []).map(a => ({
            ...a,
            variant: a.variant ?? 'secondary',
          })),
          read: false,
        }, ownerUid);
      }

      if (newCandidates.length > 0) {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Erro ao gerar notificações do Planejamento:', error);
    }
  }, [authLoading, ownerUid, loadNotifications]);

  // Inicialização e polling
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!ownerUid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    
    loadNotifications();
    checkAndCreateReminders();
    
    // Verificar a cada 1 minuto (calendar) / 5 min (planning)
    let planningTickCount = 0;
    checkIntervalRef.current = setInterval(() => {
      checkAndCreateReminders();
      triggerDueReminders();
      // Planning scan a cada 5 ciclos (~5 min) para não sobrecarregar
      planningTickCount++;
      if (planningTickCount >= 5) {
        planningTickCount = 0;
        checkAndCreatePlanningNotifications();
      }
    }, 60000); // 1 minuto
    
    // Verificação inicial após 5 segundos
    const initialCheck = setTimeout(() => {
      triggerDueReminders();
    }, 5000);

    // Planning: primeira verificação após 10 segundos
    const initialPlanningCheck = setTimeout(() => {
      checkAndCreatePlanningNotifications();
    }, 10000);
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      clearTimeout(initialCheck);
      clearTimeout(initialPlanningCheck);
    };
  }, [authLoading, ownerUid, loadNotifications, checkAndCreateReminders, triggerDueReminders, checkAndCreatePlanningNotifications]);

  // Marcar como lida
  const markAsRead = useCallback(async (id: string) => {
    if (!ownerUid) return;

    try {
      await notificationRepository.update(id, {
        read: true,
        readAt: new Date().toISOString(),
      }, ownerUid);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }, [ownerUid]);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    if (!ownerUid) return;

    try {
      const now = new Date().toISOString();
      const unread = notifications.filter(n => !n.read);
      await Promise.all(
        unread.map(n => notificationRepository.update(n.id!, { read: true, readAt: now }, ownerUid))
      );
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: now })));
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  }, [notifications, ownerUid]);

  // Deletar notificação
  const deleteNotification = useCallback(async (id: string) => {
    if (!ownerUid) return;

    try {
      await notificationRepository.delete(id, ownerUid);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  }, [ownerUid]);

  // Limpar todas
  const clearAll = useCallback(async () => {
    if (!ownerUid) return;

    try {
      await Promise.all(notifications.map(n => notificationRepository.delete(n.id!, ownerUid)));
      setNotifications([]);
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
    }
  }, [notifications, ownerUid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        refresh: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
