import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Clock3,
  PhoneCall,
  Plus,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { Prospect } from '../../../domain/types';
import type { CalendarEvent } from '../../../domain/types/calendar';
import { SectionCard } from '../../../components/ui';

interface HojeWidgetProps {
  prospects: Prospect[];
  calendarEvents: CalendarEvent[];
}

interface HojeItem {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;
  toneBg: string;
  to?: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function HojeWidget({ prospects, calendarEvents }: HojeWidgetProps) {
  const items = useMemo<HojeItem[]>(() => {
    const today = startOfDay(new Date());
    const todayIso = today.toISOString().split('T')[0];
    const result: HojeItem[] = [];

    // Meetings / events for today
    const eventosHoje = calendarEvents
      .filter((event) => {
        if (event.status === 'cancelled') return false;
        const eventDate = parseDateOnly(event.start);
        if (!eventDate) return false;
        return startOfDay(eventDate).getTime() === today.getTime();
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    eventosHoje.forEach((event) => {
      const time = formatTime(event.start);
      result.push({
        id: `event-${event.id}`,
        title: event.title || 'Evento sem título',
        subtitle: time ? `Hoje às ${time}` : 'Hoje',
        icon: Calendar,
        tone: 'var(--color-info)',
        toneBg: 'var(--color-info-bg)',
        to: '/agendas',
      });
    });

    // Overdue follow-ups
    const openProspects = prospects.filter(
      (p) => !['ganho', 'perdido'].includes(p.status || 'novo'),
    );
    const followUpsVencidos = openProspects.filter((p) => {
      if (!p.proximoContato) return false;
      return p.proximoContato <= todayIso;
    });

    followUpsVencidos.forEach((p) => {
      result.push({
        id: `followup-${p.id}`,
        title: p.nome || 'Prospect',
        subtitle: p.proximoContato === todayIso ? 'Follow-up para hoje' : 'Follow-up atrasado',
        icon: p.proximoContato === todayIso ? PhoneCall : Clock3,
        tone: p.proximoContato === todayIso ? 'var(--color-warning)' : 'var(--color-danger)',
        toneBg: p.proximoContato === todayIso ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
        to: '/prospects',
      });
    });

    return result.slice(0, 8);
  }, [prospects, calendarEvents]);

  const quickActions = [
    { label: 'Follow-up', icon: PhoneCall, to: '/prospects' },
    { label: 'Agenda', icon: CalendarPlus, to: '/agendas' },
    { label: 'Captação', icon: TrendingUp, to: '/captacao' },
  ];

  return (
    <SectionCard title="Hoje" subtitle="Prioridades do dia">
      {items.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma pendência para hoje. Bom trabalho!
          </p>
          <div className="flex items-center justify-center gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-surface-3)] focus-gold"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              const inner = (
                <div
                  className="rounded-lg px-3 py-2 flex items-center gap-3 transition-colors hover:bg-[var(--color-surface-3)]"
                  style={{ backgroundColor: 'var(--color-surface-2)' }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: item.toneBg }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: item.tone }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {item.to ? (
                    <Link to={item.to} className="block focus-gold rounded-lg">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-surface-3)] focus-gold"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <Plus className="w-3 h-3" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
