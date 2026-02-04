import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationRepository, calendarEventRepository, eventReminderRepository } from '../services/repositories';
import type { Notification } from '../domain/types/calendar';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { addMinutes, isBefore, isAfter, parseISO } from 'date-fns';

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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ownerUid = user?.uid || 'dev';

  // Carregar notificações
  const loadNotifications = useCallback(async () => {
    try {
      const all = await notificationRepository.getAll(ownerUid);
      // Ordenar por data de criação (mais recentes primeiro)
      const sorted = all.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setNotifications(sorted);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);

  // Verificar e criar lembretes para eventos futuros
  const checkAndCreateReminders = useCallback(async () => {
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
  }, [ownerUid]);

  // Disparar notificações para lembretes que chegaram no horário
  const triggerDueReminders = useCallback(async () => {
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
            eventId: event.id,
            eventTitle: event.title,
            eventStart: event.start,
            title: `Lembrete: ${event.title}`,
            message: `Sua reunião começa em ${timeLabel}`,
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
  }, [ownerUid, loadNotifications]);

  // Inicialização e polling
  useEffect(() => {
    if (!ownerUid) return;
    
    loadNotifications();
    checkAndCreateReminders();
    
    // Verificar a cada 1 minuto
    checkIntervalRef.current = setInterval(() => {
      checkAndCreateReminders();
      triggerDueReminders();
    }, 60000); // 1 minuto
    
    // Verificação inicial após 5 segundos
    const initialCheck = setTimeout(() => {
      triggerDueReminders();
    }, 5000);
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      clearTimeout(initialCheck);
    };
  }, [ownerUid, loadNotifications, checkAndCreateReminders, triggerDueReminders]);

  // Marcar como lida
  const markAsRead = useCallback(async (id: string) => {
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
    try {
      await notificationRepository.delete(id, ownerUid);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  }, [ownerUid]);

  // Limpar todas
  const clearAll = useCallback(async () => {
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
