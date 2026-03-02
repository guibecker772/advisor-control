import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventHoveringArg,
  EventInput,
} from '@fullcalendar/core';
import { Bell, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import {
  addHours,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { calendarEventRepository } from '../../services/repositories';
import type { CalendarEvent, CalendarMetrics, MetricsPeriod } from '../../domain/types/calendar';
import { MEETING_TYPE_LABELS, calculateMetrics, getEffectiveMeetingType } from '../../domain/types/calendar';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  IconButton,
  InlineEmpty,
  PageHeader,
  PageSkeleton,
  Tabs,
} from '../../components/ui';

import EventDetailDialog from './EventDetailDialog';
import EventModal from './EventModal';
import MetricsCards from './MetricsCards';
import NotificationPanel from './NotificationPanel';

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
type ChipVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const CALENDAR_VIEW_ITEMS = [
  { value: 'dayGridMonth', label: 'Mes' },
  { value: 'timeGridWeek', label: 'Semana' },
  { value: 'timeGridDay', label: 'Dia' },
] as const;

function isCalendarView(value: string): value is CalendarView {
  return value === 'dayGridMonth' || value === 'timeGridWeek' || value === 'timeGridDay';
}

function capitalizeLabel(label: string): string {
  if (!label) return label;
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}

function formatMonthShort(date: Date): string {
  const month = format(date, 'LLL', { locale: ptBR }).replace('.', '');
  return capitalizeLabel(month);
}

function formatPeriodLabel(view: CalendarView, start: Date, end: Date): string {
  if (view === 'timeGridDay') {
    return `${format(start, 'd')} ${formatMonthShort(start)} ${format(start, 'yyyy')}`;
  }

  if (view === 'timeGridWeek') {
    const weekEnd = subDays(end, 1);
    if (isSameMonth(start, weekEnd)) {
      return `${format(start, 'd')}-${format(weekEnd, 'd')} ${formatMonthShort(weekEnd)} ${format(weekEnd, 'yyyy')}`;
    }
    return `${format(start, 'd')} ${formatMonthShort(start)}-${format(weekEnd, 'd')} ${formatMonthShort(weekEnd)} ${format(weekEnd, 'yyyy')}`;
  }

  return `${formatMonthShort(start)} ${format(start, 'yyyy')}`;
}

function parseDateSafe(isoDate: string): Date | null {
  const parsed = parseISO(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function eventIntersectsVisibleRange(event: CalendarEvent, range: { start: Date; end: Date }): boolean {
  const startDate = parseDateSafe(event.start);
  if (!startDate) return false;
  const endDate = event.end ? parseDateSafe(event.end) ?? addHours(startDate, 1) : addHours(startDate, 1);
  return startDate < range.end && endDate > range.start;
}

function buildQuickCreateRange(date: Date, view: CalendarView, allDay: boolean): { start: Date; end: Date } {
  if (view === 'dayGridMonth' || allDay) {
    const monthStart = new Date(date);
    monthStart.setHours(9, 0, 0, 0);
    return {
      start: monthStart,
      end: addHours(monthStart, 1),
    };
  }

  const slotStart = new Date(date);
  slotStart.setSeconds(0, 0);
  return {
    start: slotStart,
    end: addHours(slotStart, 1),
  };
}

function toSafeDate(dateValue: string, fallback: Date): Date {
  const parsed = parseDateSafe(dateValue);
  return parsed ?? fallback;
}

function getEventStatusData(status?: string): { label: string; variant: ChipVariant; persisted: boolean } {
  if (!status) {
    return { label: 'Confirmado', variant: 'info', persisted: false };
  }

  const normalized = status.toLowerCase();
  if (normalized === 'confirmed') return { label: 'Confirmado', variant: 'success', persisted: true };
  if (normalized === 'tentative') return { label: 'Pendente', variant: 'warning', persisted: true };
  if (normalized === 'completed' || normalized === 'realizado') return { label: 'Realizado', variant: 'success', persisted: true };
  if (normalized === 'cancelled' || normalized === 'cancelado') return { label: 'Cancelado', variant: 'danger', persisted: true };
  return { label: 'Confirmado', variant: 'info', persisted: false };
}

function getEventCategoryData(event: CalendarEvent): { label: string; persisted: boolean } {
  if (event.meetingType) {
    return { label: MEETING_TYPE_LABELS[event.meetingType], persisted: true };
  }
  return { label: 'Reuniao', persisted: false };
}

function getTooltipClientLabel(event: CalendarEvent): string | null {
  const rawEvent = event as CalendarEvent & Record<string, unknown>;
  const candidateKeys = [
    'clienteNome',
    'clienteName',
    'clientName',
    'cliente',
    'prospectNome',
    'prospectName',
    'prospect',
  ];

  for (const key of candidateKeys) {
    const value = rawEvent[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function formatTooltipDate(event: CalendarEvent): string {
  const start = parseDateSafe(event.start);
  if (!start) return 'Horario indisponivel';
  const end = event.end ? parseDateSafe(event.end) : null;

  if (event.allDay) {
    return format(start, "d 'de' MMM yyyy", { locale: ptBR });
  }

  if (end && isSameDay(start, end)) {
    return `${format(start, "d 'de' MMM yyyy", { locale: ptBR })} - ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  }

  if (end) {
    return `${format(start, "d 'de' MMM HH:mm", { locale: ptBR })} - ${format(end, "d 'de' MMM HH:mm", { locale: ptBR })}`;
  }

  return format(start, "d 'de' MMM yyyy - HH:mm", { locale: ptBR });
}

function detectCalendarReadOnly(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const userData = user as Record<string, unknown>;

  if (userData.readOnly === true || userData.isReadOnly === true) return true;

  if (typeof userData.role === 'string') {
    const normalizedRole = userData.role.toLowerCase();
    if (normalizedRole === 'viewer' || normalizedRole === 'readonly' || normalizedRole === 'read_only') {
      return true;
    }
  }

  if (typeof userData.permissions === 'object' && userData.permissions) {
    const permissions = userData.permissions as Record<string, unknown>;
    if (permissions.calendar === 'read') return true;
  }

  return false;
}

export default function AgendasPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ownerUid = user?.uid;
  const calendarRef = useRef<FullCalendar | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const handledQueryRef = useRef<string | null>(null);
  const notificationDropdownRef = useRef<HTMLDivElement | null>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const wasNotificationOpenRef = useRef(false);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<CalendarView>('dayGridMonth');
  const [periodRange, setPeriodRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  const [isDesktopHover, setIsDesktopHover] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    event: CalendarEvent;
    x: number;
    y: number;
  } | null>(null);

  const isReadOnly = detectCalendarReadOnly(user);
  const canManageEvents = Boolean(user) && !isReadOnly;

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncMedia = () => setIsDesktopHover(media.matches);
    syncMedia();
    media.addEventListener('change', syncMedia);
    return () => media.removeEventListener('change', syncMedia);
  }, []);

  useEffect(() => {
    if (!notificationPanelOpen) {
      if (wasNotificationOpenRef.current) {
        notificationTriggerRef.current?.focus();
      }
      wasNotificationOpenRef.current = false;
      return;
    }

    wasNotificationOpenRef.current = true;

    const focusTimer = window.setTimeout(() => {
      const firstInteractive = notificationPanelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      firstInteractive?.focus();
    }, 0);

    const isEventInsideNotificationDropdown = (event: Event): boolean => {
      const dropdownRoot = notificationDropdownRef.current;
      if (!dropdownRoot) return false;
      if (typeof event.composedPath === 'function') {
        return event.composedPath().includes(dropdownRoot);
      }
      return dropdownRoot.contains(event.target as Node | null);
    };

    const handleDocumentPointerUp = (event: PointerEvent) => {
      if (!isEventInsideNotificationDropdown(event)) {
        setNotificationPanelOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationPanelOpen(false);
      }
    };

    document.addEventListener('pointerup', handleDocumentPointerUp);
    document.addEventListener('keydown', handleEscape);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('pointerup', handleDocumentPointerUp);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationPanelOpen]);

  const loadEvents = useCallback(async () => {
    if (authLoading) return;
    if (!ownerUid) {
      setEvents([]);
      setLoadError(null);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    setLoadError(null);

    if (hasLoaded) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const allEvents = await calendarEventRepository.getAll(ownerUid);
      setEvents(allEvents.filter((event) => event.status !== 'cancelled'));
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      setLoadError('Nao foi possivel carregar os eventos da agenda.');
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setHasLoaded(true);
    }
  }, [authLoading, hasLoaded, ownerUid]);

  useEffect(() => {
    if (authLoading) return;
    void loadEvents();
  }, [authLoading, loadEvents]);

  const calendarEvents: EventInput[] = useMemo(() => {
    return events.map((event) => {
      const meetingType = getEffectiveMeetingType(event);
      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        classNames: ['ac-calendar-event', `ac-calendar-event--${meetingType}`],
        extendedProps: {
          ...event,
          meetingType,
        },
      };
    });
  }, [events]);

  const metrics: CalendarMetrics = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let label: string;

    switch (metricsPeriod) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        label = 'Esta semana';
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = `${formatMonthShort(now)} ${format(now, 'yyyy')}`;
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        label = format(now, 'yyyy');
        break;
      case 'custom':
        startDate = toSafeDate(customDateRange.start, now);
        endDate = toSafeDate(customDateRange.end, now);
        label = `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`;
        break;
    }

    return calculateMetrics(events, startDate, endDate, label);
  }, [customDateRange.end, customDateRange.start, events, metricsPeriod]);

  const visibleEvents = useMemo(() => {
    return events.filter((event) => eventIntersectsVisibleRange(event, visibleRange));
  }, [events, visibleRange]);

  const periodLabel = useMemo(() => {
    return formatPeriodLabel(currentView, periodRange.start, periodRange.end);
  }, [currentView, periodRange.end, periodRange.start]);

  const openCreateModal = useCallback(
    (prefillRange?: { start: Date; end: Date }) => {
      if (!canManageEvents) return;
      setSelectedEvent(null);
      setSelectedDateRange(prefillRange ?? null);
      setModalOpen(true);
    },
    [canManageEvents],
  );

  const closeEventDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailEvent(null);
    setDeleteConfirmOpen(false);
    const trigger = detailTriggerRef.current;
    if (trigger) {
      requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  const handleDateClick = useCallback(
    (clickInfo: DateClickArg) => {
      if (!canManageEvents) return;
      const range = buildQuickCreateRange(clickInfo.date, currentView, clickInfo.allDay);
      openCreateModal(range);
    },
    [canManageEvents, currentView, openCreateModal],
  );

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventData = clickInfo.event.extendedProps as CalendarEvent;
    detailTriggerRef.current = clickInfo.el;
    setDetailEvent({ ...eventData, id: clickInfo.event.id });
    setDetailOpen(true);
    setHoverTooltip(null);
  }, []);

  const handleEditFromDetail = useCallback(() => {
    if (!detailEvent || !canManageEvents) return;
    setDetailOpen(false);
    setSelectedEvent(detailEvent);
    setSelectedDateRange(null);
    setModalOpen(true);
  }, [canManageEvents, detailEvent]);

  const closeEventModal = useCallback(() => {
    setModalOpen(false);
    setSelectedEvent(null);
    setSelectedDateRange(null);
  }, []);

  const handleEventSave = useCallback(
    async (eventData: CalendarEvent) => {
      if (!ownerUid) return;

      try {
        if (eventData.id) {
          await calendarEventRepository.update(eventData.id, eventData, ownerUid);
          toast.success('Evento atualizado');
        } else {
          await calendarEventRepository.create(eventData, ownerUid);
          toast.success('Evento criado');
        }
        closeEventModal();
        await loadEvents();
      } catch (error) {
        console.error('Erro ao salvar evento:', error);
        toast.error('Erro ao salvar evento');
      }
    },
    [closeEventModal, loadEvents, ownerUid],
  );

  const cancelEvent = useCallback(
    async (eventId: string) => {
      if (!ownerUid) return;

      await calendarEventRepository.update(eventId, { status: 'cancelled' }, ownerUid);
      toast.success('Evento cancelado');
      await loadEvents();
    },
    [loadEvents, ownerUid],
  );

  const handleEventDeleteFromModal = useCallback(
    async (eventId: string) => {
      try {
        await cancelEvent(eventId);
        closeEventModal();
      } catch (error) {
        console.error('Erro ao cancelar evento:', error);
        toast.error('Erro ao cancelar evento');
      }
    },
    [cancelEvent, closeEventModal],
  );

  const handleEventDeleteFromDetail = useCallback(async () => {
    if (!detailEvent?.id) return;
    try {
      await cancelEvent(detailEvent.id);
      closeEventDetail();
    } catch (error) {
      console.error('Erro ao cancelar evento:', error);
      toast.error('Erro ao cancelar evento');
    }
  }, [cancelEvent, closeEventDetail, detailEvent?.id]);

  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev();
  }, []);

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi().next();
  }, []);

  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today();
  }, []);

  const handleViewChange = useCallback((nextView: CalendarView) => {
    setCurrentView(nextView);
    calendarRef.current?.getApi().changeView(nextView);
  }, []);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const nextView = arg.view.type;
    if (isCalendarView(nextView)) {
      setCurrentView(nextView);
    }
    setPeriodRange({ start: arg.view.currentStart, end: arg.view.currentEnd });
    setVisibleRange({ start: arg.start, end: arg.end });
  }, []);

  const handleEventMouseEnter = useCallback(
    (arg: EventHoveringArg) => {
      if (!isDesktopHover) return;
      const eventData = arg.event.extendedProps as CalendarEvent;
      setHoverTooltip({
        event: { ...eventData, id: arg.event.id },
        x: arg.jsEvent.clientX,
        y: arg.jsEvent.clientY,
      });
    },
    [isDesktopHover],
  );

  const handleEventMouseLeave = useCallback(() => {
    setHoverTooltip(null);
  }, []);

  const renderEventContent = useCallback(
    (content: EventContentArg) => {
      const eventData = content.event.extendedProps as CalendarEvent;
      const statusData = getEventStatusData(eventData.status);
      const categoryData = getEventCategoryData(eventData);
      const showChips = currentView !== 'dayGridMonth';

      return (
        <div className="ac-event-pill">
          <div className="ac-event-main">
            {content.timeText && <span className="ac-event-time">{content.timeText}</span>}
            <span className="ac-event-title">{content.event.title}</span>
          </div>
          {showChips && (
            <div className="ac-event-chip-row">
              <span className={`ac-event-chip ac-event-chip--${statusData.variant}`}>
                {statusData.label}
              </span>
              <span className="ac-event-chip ac-event-chip--neutral">{categoryData.label}</span>
            </div>
          )}
        </div>
      );
    },
    [currentView],
  );

  useEffect(() => {
    if (!hasLoaded) return;

    const queryKey = searchParams.toString();
    if (handledQueryRef.current === queryKey) return;
    handledQueryRef.current = queryKey;

    const quickCreateParam = searchParams.get('quickCreate');
    const todayParam = searchParams.get('today');
    const eventParam = searchParams.get('event');

    if (!quickCreateParam && !todayParam && !eventParam) return;

    const nextParams = new URLSearchParams(searchParams);
    let shouldReplace = false;

    if (todayParam === '1') {
      handleToday();
      nextParams.delete('today');
      shouldReplace = true;
    }

    if (quickCreateParam === '1') {
      openCreateModal();
      nextParams.delete('quickCreate');
      shouldReplace = true;
    }

    if (eventParam) {
      const targetEvent = events.find((event) => event.id === eventParam);
      if (targetEvent) {
        setDetailEvent(targetEvent);
        setDetailOpen(true);
      }
      nextParams.delete('event');
      shouldReplace = true;
    }

    if (shouldReplace) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [events, handleToday, hasLoaded, openCreateModal, searchParams, setSearchParams]);

  if (loading && !hasLoaded) {
    return <PageSkeleton showKpis kpiCount={4} rows={5} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendas"
        subtitle="Gerencie reunioes e compromissos"
        actions={(
          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationDropdownRef}>
              <IconButton
                ref={notificationTriggerRef}
                icon={<Bell className="w-5 h-5" />}
                label="Abrir notificacoes"
                onClick={() => setNotificationPanelOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={notificationPanelOpen}
                aria-controls={notificationPanelOpen ? 'agendas-notification-panel' : undefined}
              />
              {notificationPanelOpen && (
                <div
                  id="agendas-notification-panel"
                  ref={notificationPanelRef}
                  role="dialog"
                  aria-label="Painel de notificacoes"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-toast)] w-[min(26rem,calc(100vw-2rem))] pointer-events-auto"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <NotificationPanel onClose={() => setNotificationPanelOpen(false)} />
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={loadEvents}
              disabled={loading || isRefreshing}
              aria-label="Atualizar eventos"
            >
              Atualizar
            </Button>
            {canManageEvents && (
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => openCreateModal()}
              >
                Criar evento
              </Button>
            )}
          </div>
        )}
      />

      <MetricsCards
        metrics={metrics}
        period={metricsPeriod}
        onPeriodChange={setMetricsPeriod}
        customDateRange={customDateRange}
        onCustomDateChange={setCustomDateRange}
      />

      <div
        className="rounded-xl shadow-sm p-4 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={handlePrev}
              aria-label="Periodo anterior"
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToday}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={handleNext}
              aria-label="Proximo periodo"
            >
              Proximo
            </Button>
            <h2
              className="text-lg font-semibold ml-1"
              style={{ color: 'var(--color-text)' }}
            >
              {periodLabel}
            </h2>
          </div>

          <Tabs
            items={CALENDAR_VIEW_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
            value={currentView}
            onChange={(value) => {
              if (isCalendarView(value)) {
                handleViewChange(value);
              }
            }}
            size="md"
          />
        </div>

        {loadError && events.length === 0 ? (
          <ErrorState
            title="Erro ao carregar agenda"
            description={loadError}
            onRetry={loadEvents}
            retryLabel="Tentar novamente"
          />
        ) : (
          <>
            {!loadError && visibleEvents.length === 0 && (
              <InlineEmpty
                message="Nenhum evento no periodo visivel."
                action={canManageEvents ? { label: 'Criar evento', onClick: () => openCreateModal() } : undefined}
              />
            )}

            <div className="relative">
              <div className="fc-custom">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={currentView}
                  headerToolbar={false}
                  locale="pt-br"
                  timeZone="local"
                  events={calendarEvents}
                  selectable={false}
                  dayMaxEvents
                  weekends
                  firstDay={1}
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  allDaySlot
                  nowIndicator
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  eventMouseEnter={handleEventMouseEnter}
                  eventMouseLeave={handleEventMouseLeave}
                  datesSet={handleDatesSet}
                  eventContent={renderEventContent}
                  height="auto"
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false,
                    hour12: false,
                  }}
                  slotLabelFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  dayHeaderFormat={{
                    weekday: 'short',
                    day: 'numeric',
                  }}
                  buttonText={{
                    today: 'Hoje',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Dia',
                  }}
                />
              </div>

              {isRefreshing && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full animate-spin border-2 border-t-transparent"
                    style={{ borderColor: 'var(--color-gold)' }}
                    aria-label="Atualizando eventos"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <EventModal
          event={selectedEvent}
          dateRange={selectedDateRange}
          onClose={closeEventModal}
          onSave={handleEventSave}
          onDelete={handleEventDeleteFromModal}
        />
      )}

      <EventDetailDialog
        isOpen={detailOpen}
        event={detailEvent}
        readOnly={!canManageEvents}
        onClose={closeEventDetail}
        onEdit={canManageEvents ? handleEditFromDetail : undefined}
        onDelete={canManageEvents ? () => setDeleteConfirmOpen(true) : undefined}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleEventDeleteFromDetail}
        title="Cancelar evento"
        message="Tem certeza que deseja cancelar este evento?"
        confirmText="Cancelar evento"
        cancelText="Voltar"
        variant="danger"
      />

      {isDesktopHover && hoverTooltip && !detailOpen && (
        <div
          className="fixed pointer-events-none rounded-lg px-3 py-2 shadow-lg border max-w-xs"
          style={{
            top: hoverTooltip.y + 12,
            left: hoverTooltip.x + 12,
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-border-subtle)',
            zIndex: 'var(--z-tooltip)',
          }}
        >
          <p className="text-sm font-semibold">{hoverTooltip.event.title}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {formatTooltipDate(hoverTooltip.event)}
          </p>
          {getTooltipClientLabel(hoverTooltip.event) && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {getTooltipClientLabel(hoverTooltip.event)}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Status: {getEventStatusData(hoverTooltip.event.status).label}
          </p>
        </div>
      )}
    </div>
  );
}
