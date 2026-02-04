import { z } from 'zod';

// ============== TIPOS DE REUNIÃO ==============
export const MEETING_TYPES = ['R1', 'R2', 'areas_cross', 'outro'] as const;
export type MeetingType = typeof MEETING_TYPES[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  R1: 'R1 - Primeira Reunião',
  R2: 'R2 - Segunda Reunião',
  areas_cross: 'Áreas Cross',
  outro: 'Outro',
};

export const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  R1: '#3B82F6', // blue-500
  R2: '#10B981', // emerald-500
  areas_cross: '#8B5CF6', // violet-500
  outro: '#6B7280', // gray-500
};

// ============== EVENTO DE CALENDÁRIO ==============
export const calendarEventSchema = z.object({
  id: z.string().optional(),
  googleEventId: z.string().optional(), // ID do evento no Google Calendar (para sync)
  
  // Dados básicos do evento
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional().default(''),
  location: z.string().optional().default(''),
  
  // Datas/horários
  start: z.string().min(1, 'Data/hora de início é obrigatória'), // ISO string
  end: z.string().min(1, 'Data/hora de fim é obrigatória'), // ISO string
  allDay: z.boolean().optional().default(false),
  timezone: z.string().optional().default('America/Sao_Paulo'),
  
  // Tipo de reunião (R1/R2/Áreas Cross/Outro)
  meetingType: z.enum(MEETING_TYPES).optional(), // null = auto-detect
  meetingTypeOverride: z.boolean().optional().default(false), // true se usuário selecionou manualmente
  
  // Convidados (emails separados por vírgula)
  attendees: z.string().optional().default(''),
  
  // Observações internas (apenas no app, não vai para Google)
  internalNotes: z.string().optional().default(''),
  
  // Status do evento
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional().default('confirmed'),
  
  // Recorrência (apenas para exibição, não criamos recorrência própria)
  recurringEventId: z.string().optional(), // ID do evento pai se for instância de recorrência
  
  // Sync status
  syncStatus: z.enum(['local', 'synced', 'pending_sync', 'sync_error']).optional().default('local'),
  lastSyncAt: z.string().optional(),
  
  // Metadata
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CalendarEvent = z.output<typeof calendarEventSchema>;
export type CalendarEventInput = z.input<typeof calendarEventSchema>;

// ============== CONTA DO GOOGLE CALENDAR ==============
export const calendarAccountSchema = z.object({
  id: z.string().optional(),
  provider: z.literal('google').default('google'),
  email: z.string().email().optional(),
  
  // Tokens (em produção, criptografar!)
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.string().optional(), // ISO string
  
  // Calendário principal
  calendarId: z.string().optional().default('primary'),
  
  // Sync token para incremental sync
  syncToken: z.string().optional(),
  
  // Status
  connected: z.boolean().default(false),
  lastSyncAt: z.string().optional(),
  
  // Metadata
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CalendarAccount = z.output<typeof calendarAccountSchema>;
export type CalendarAccountInput = z.input<typeof calendarAccountSchema>;

// ============== NOTIFICAÇÃO IN-APP ==============
export const notificationSchema = z.object({
  id: z.string().optional(),
  
  // Tipo de notificação
  type: z.enum(['reminder_60min', 'reminder_30min', 'event_created', 'event_updated', 'sync_error']),
  
  // Referência ao evento
  eventId: z.string().optional(),
  eventTitle: z.string().optional(),
  eventStart: z.string().optional(),
  
  // Conteúdo
  title: z.string().min(1),
  message: z.string().optional().default(''),
  
  // Status
  read: z.boolean().default(false),
  readAt: z.string().optional(),
  
  // Metadata
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
});

export type Notification = z.output<typeof notificationSchema>;
export type NotificationInput = z.input<typeof notificationSchema>;

// ============== LEMBRETE DE EVENTO ==============
export const eventReminderSchema = z.object({
  id: z.string().optional(),
  eventId: z.string().min(1),
  
  // Tipo: 60 ou 30 minutos antes
  minutesBefore: z.number(), // 60 ou 30
  
  // Quando deve ser disparado
  remindAt: z.string(), // ISO string
  
  // Status de envio
  notificationSentAt: z.string().optional(),
  emailSentAt: z.string().optional(),
  
  // Metadata
  ownerUid: z.string().optional(),
  createdAt: z.string().optional(),
});

export type EventReminder = z.output<typeof eventReminderSchema>;
export type EventReminderInput = z.input<typeof eventReminderSchema>;

// ============== MÉTRICAS ==============
export interface CalendarMetrics {
  r1Count: number;
  r2Count: number;
  areasCrossCount: number;
  totalMeetings: number;
  period: {
    start: string;
    end: string;
    label: string;
  };
}

export type MetricsPeriod = 'week' | 'month' | 'year' | 'custom';

// ============== HELPERS ==============

/**
 * Detecta o tipo de reunião baseado no título
 */
export function detectMeetingType(title: string): MeetingType {
  const normalized = title.toLowerCase().trim();
  
  // R1: contém "r1" ou "1ª reunião" ou "primeira reunião"
  if (/\br1\b/.test(normalized) || /1[ªa]\s*reuni[aã]o/.test(normalized) || /primeira\s*reuni[aã]o/.test(normalized)) {
    return 'R1';
  }
  
  // R2: contém "r2" ou "2ª reunião" ou "segunda reunião"
  if (/\br2\b/.test(normalized) || /2[ªa]\s*reuni[aã]o/.test(normalized) || /segunda\s*reuni[aã]o/.test(normalized)) {
    return 'R2';
  }
  
  // Áreas Cross: contém "área(s) cross", "areas cross", "cross"
  if (/[aá]reas?\s*cross/.test(normalized) || /\bcross\b/.test(normalized)) {
    return 'areas_cross';
  }
  
  return 'outro';
}

/**
 * Retorna o tipo efetivo do evento (override > detect)
 */
export function getEffectiveMeetingType(event: CalendarEvent): MeetingType {
  if (event.meetingTypeOverride && event.meetingType) {
    return event.meetingType;
  }
  return detectMeetingType(event.title);
}

/**
 * Calcula métricas de reuniões para um período
 */
export function calculateMetrics(events: CalendarEvent[], startDate: Date, endDate: Date, periodLabel: string): CalendarMetrics {
  const filteredEvents = events.filter(event => {
    if (event.status === 'cancelled') return false;
    const eventStart = new Date(event.start);
    return eventStart >= startDate && eventStart <= endDate;
  });
  
  let r1Count = 0;
  let r2Count = 0;
  let areasCrossCount = 0;
  
  filteredEvents.forEach(event => {
    const type = getEffectiveMeetingType(event);
    switch (type) {
      case 'R1':
        r1Count++;
        break;
      case 'R2':
        r2Count++;
        break;
      case 'areas_cross':
        areasCrossCount++;
        break;
    }
  });
  
  return {
    r1Count,
    r2Count,
    areasCrossCount,
    totalMeetings: filteredEvents.length,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      label: periodLabel,
    },
  };
}
