import { useState, useEffect, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventInput } from '@fullcalendar/core';
import { 
  Calendar, 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Bell
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { calendarEventRepository } from '../../services/repositories';
import type { CalendarEvent, CalendarMetrics, MetricsPeriod } from '../../domain/types/calendar';
import { 
  MEETING_TYPE_COLORS, 
  getEffectiveMeetingType, 
  calculateMetrics 
} from '../../domain/types/calendar';

import EventModal from './EventModal';
import MetricsCards from './MetricsCards';
import NotificationPanel from './NotificationPanel';

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

export default function AgendasPage() {
  const { user } = useAuth();
  const ownerUid = user?.uid || 'dev';

  // Estados
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<CalendarView>('dayGridMonth');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  
  // Métricas
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  
  // Notificações panel
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  // Referência ao calendário
  const [calendarApi, setCalendarApi] = useState<any>(null);

  // Carregar eventos
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const all = await calendarEventRepository.getAll(ownerUid);
      setEvents(all.filter(e => e.status !== 'cancelled'));
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Converter eventos para formato FullCalendar
  const calendarEvents: EventInput[] = useMemo(() => {
    return events.map(event => {
      const meetingType = getEffectiveMeetingType(event);
      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        backgroundColor: MEETING_TYPE_COLORS[meetingType],
        borderColor: MEETING_TYPE_COLORS[meetingType],
        extendedProps: {
          ...event,
          meetingType,
        },
      };
    });
  }, [events]);

  // Calcular métricas
  const metrics: CalendarMetrics = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let label: string;

    switch (metricsPeriod) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        label = 'Esta Semana';
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = format(now, 'MMMM yyyy', { locale: ptBR });
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        label = format(now, 'yyyy');
        break;
      case 'custom':
        startDate = parseISO(customDateRange.start);
        endDate = parseISO(customDateRange.end);
        label = `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`;
        break;
    }

    return calculateMetrics(events, startDate, endDate, label);
  }, [events, metricsPeriod, customDateRange]);

  // Handlers
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setSelectedEvent(null);
    setSelectedDateRange({ start: selectInfo.start, end: selectInfo.end });
    setModalOpen(true);
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventData = clickInfo.event.extendedProps as CalendarEvent;
    setSelectedEvent({ ...eventData, id: clickInfo.event.id });
    setSelectedDateRange(null);
    setModalOpen(true);
  }, []);

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setSelectedDateRange(null);
  };

  const handleEventSave = async (eventData: CalendarEvent) => {
    try {
      if (eventData.id) {
        // Atualizar
        await calendarEventRepository.update(eventData.id, eventData, ownerUid);
        toast.success('Evento atualizado!');
      } else {
        // Criar
        await calendarEventRepository.create(eventData, ownerUid);
        toast.success('Evento criado!');
      }
      handleModalClose();
      loadEvents();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast.error('Erro ao salvar evento');
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      await calendarEventRepository.update(eventId, { status: 'cancelled' }, ownerUid);
      toast.success('Evento cancelado!');
      handleModalClose();
      loadEvents();
    } catch (error) {
      console.error('Erro ao cancelar evento:', error);
      toast.error('Erro ao cancelar evento');
    }
  };

  // Navegação do calendário
  const handlePrev = () => {
    if (calendarApi) {
      calendarApi.prev();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleNext = () => {
    if (calendarApi) {
      calendarApi.next();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleToday = () => {
    if (calendarApi) {
      calendarApi.today();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
    if (calendarApi) {
      calendarApi.changeView(view);
    }
  };

  // Título do período atual
  const periodTitle = useMemo(() => {
    if (!calendarApi) return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    
    switch (currentView) {
      case 'timeGridDay':
        return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
      case 'timeGridWeek':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'd MMM', { locale: ptBR })} - ${format(weekEnd, 'd MMM yyyy', { locale: ptBR })}`;
      default:
        return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    }
  }, [currentDate, currentView, calendarApi]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agendas</h1>
            <p className="text-sm text-gray-500">Gerencie suas reuniões e compromissos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
          </button>
          
          <button
            onClick={loadEvents}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          
          <button
            onClick={() => {
              setSelectedEvent(null);
              setSelectedDateRange(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Evento</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <MetricsCards 
        metrics={metrics}
        period={metricsPeriod}
        onPeriodChange={setMetricsPeriod}
        customDateRange={customDateRange}
        onCustomDateChange={setCustomDateRange}
      />

      {/* Painel de Notificações (colapsável) */}
      {notificationPanelOpen && (
        <NotificationPanel onClose={() => setNotificationPanelOpen(false)} />
      )}

      {/* Controles do Calendário */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          {/* Navegação */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-2 capitalize">
              {periodTitle}
            </h2>
          </div>
          
          {/* Seletores de Visualização */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewChange('timeGridDay')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currentView === 'timeGridDay'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => handleViewChange('timeGridWeek')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currentView === 'timeGridWeek'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => handleViewChange('dayGridMonth')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currentView === 'dayGridMonth'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEETING_TYPE_COLORS.R1 }} />
            <span>R1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEETING_TYPE_COLORS.R2 }} />
            <span>R2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEETING_TYPE_COLORS.areas_cross }} />
            <span>Áreas Cross</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEETING_TYPE_COLORS.outro }} />
            <span>Outro</span>
          </div>
        </div>

        {/* Calendário */}
        <div className="fc-custom">
          <FullCalendar
            ref={(el) => {
              if (el) {
                setCalendarApi(el.getApi());
              }
            }}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={currentView}
            headerToolbar={false}
            locale="pt-br"
            events={calendarEvents}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            firstDay={1}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={true}
            nowIndicator={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
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
              month: 'Mês',
              week: 'Semana',
              day: 'Dia',
            }}
          />
        </div>
      </div>

      {/* Modal de Evento */}
      {modalOpen && (
        <EventModal
          event={selectedEvent}
          dateRange={selectedDateRange}
          onClose={handleModalClose}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
        />
      )}
    </div>
  );
}
