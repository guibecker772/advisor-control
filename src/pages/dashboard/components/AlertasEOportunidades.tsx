import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarClock,
  Clock3,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Cliente, ClienteReuniao, MonthlyGoals, OfferReservation, Prospect } from '../../../domain/types';
import type { CalendarEvent } from '../../../domain/types/calendar';
import { InlineEmpty, SectionCard } from '../../../components/ui';
import { normalizeOfferStatus } from '../../../domain/offers';

type AlertTone = 'danger' | 'warning' | 'info' | 'success';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  count?: number;
  to?: string;
  icon: LucideIcon;
  tone: AlertTone;
}

interface AlertasEOportunidadesProps {
  clientes: Cliente[];
  prospects: Prospect[];
  offers: OfferReservation[];
  monthlyGoal: MonthlyGoals | null;
  reunioesMes: ClienteReuniao[];
  calendarEvents?: CalendarEvent[];
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysUntilBirthday(today: Date, birthMonth: number, birthDay: number): number | null {
  const currentYear = today.getFullYear();
  let nextBirthday = new Date(currentYear, birthMonth - 1, birthDay);
  if (!Number.isFinite(nextBirthday.getTime())) return null;
  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, birthMonth - 1, birthDay);
  }
  const diff = nextBirthday.getTime() - today.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function getToneColor(tone: AlertTone): string {
  if (tone === 'danger') return 'var(--color-danger)';
  if (tone === 'warning') return 'var(--color-warning)';
  if (tone === 'success') return 'var(--color-success)';
  return 'var(--color-info)';
}

function getToneBackground(tone: AlertTone): string {
  if (tone === 'danger') return 'var(--color-danger-bg)';
  if (tone === 'warning') return 'var(--color-warning-bg)';
  if (tone === 'success') return 'var(--color-success-bg)';
  return 'var(--color-info-bg)';
}

export function AlertasEOportunidades({
  clientes,
  prospects,
  offers,
  monthlyGoal,
  reunioesMes,
  calendarEvents = [],
}: AlertasEOportunidadesProps) {
  const alertas = useMemo<AlertItem[]>(() => {
    const today = startOfDay(new Date());
    const todayIso = today.toISOString().split('T')[0];
    const sevenDaysLimit = addDays(today, 7);
    const openProspects = prospects.filter((prospect) => !['ganho', 'perdido'].includes(prospect.status || 'novo'));
    const items: AlertItem[] = [];

    const prospectsAtrasados = openProspects.filter((prospect) => {
      if (!prospect.proximoContato) return false;
      return prospect.proximoContato <= todayIso;
    });
    if (prospectsAtrasados.length > 0) {
      items.push({
        id: 'prospects-atrasados',
        title: 'Prospects com contato vencido',
        description: 'Existem prospects aguardando follow-up imediato.',
        count: prospectsAtrasados.length,
        to: '/prospects',
        icon: Clock3,
        tone: 'danger',
      });
    }

    const ofertasExpirando = offers.filter((offer) => {
      if (!offer.reservationEndDate) return false;
      const status = normalizeOfferStatus(offer.status, {
        reservaEfetuada: offer.reservaEfetuada,
        reservaLiquidada: offer.reservaLiquidada,
      });
      if (status === 'CANCELADA' || status === 'LIQUIDADA') return false;
      const endDate = parseDateOnly(offer.reservationEndDate);
      if (!endDate) return false;
      const normalizedEnd = startOfDay(endDate);
      return normalizedEnd >= today && normalizedEnd <= sevenDaysLimit;
    });
    if (ofertasExpirando.length > 0) {
      items.push({
        id: 'ofertas-expirando',
        title: 'Ofertas encerrando em 7 dias',
        description: 'Acompanhe prazos para não perder oportunidades.',
        count: ofertasExpirando.length,
        to: '/ofertas',
        icon: CalendarClock,
        tone: 'warning',
      });
    }

    if (!monthlyGoal) {
      items.push({
        id: 'metas-nao-definidas',
        title: 'Metas mensais não configuradas',
        description: 'Defina metas para acompanhar os resultados do mês.',
        to: '/metas',
        icon: Target,
        tone: 'warning',
      });
    }

    const clientesAtivos = clientes.filter((cliente) => cliente.status === 'ativo');
    const clientesComReuniao = new Set(
      reunioesMes
        .filter((reuniao) => reuniao.realizada)
        .map((reuniao) => reuniao.clienteId),
    );
    const clientesSemReuniao = clientesAtivos.filter((cliente) => {
      if (!cliente.id) return false;
      return !clientesComReuniao.has(cliente.id);
    });
    if (clientesSemReuniao.length > 0) {
      items.push({
        id: 'clientes-sem-reuniao',
        title: 'Clientes sem reunião no mês',
        description: 'Considere revisar agenda para manter o relacionamento ativo.',
        count: clientesSemReuniao.length,
        to: '/clientes',
        icon: Users,
        tone: 'info',
      });
    }

    const prospectsSemProximoContato = openProspects.filter((prospect) => !prospect.proximoContato);
    if (prospectsSemProximoContato.length > 0) {
      items.push({
        id: 'prospects-sem-proximo-passo',
        title: 'Prospects sem próximo passo',
        description: 'Defina um próximo contato para reduzir risco de perda.',
        count: prospectsSemProximoContato.length,
        to: '/prospects',
        icon: UserPlus,
        tone: 'warning',
      });
    }

    const aniversariantesProximos = clientesAtivos.filter((cliente) => {
      if (!cliente.birthDay || !cliente.birthMonth) return false;
      const diff = daysUntilBirthday(today, cliente.birthMonth, cliente.birthDay);
      return diff !== null && diff >= 0 && diff <= 7;
    });
    if (aniversariantesProximos.length > 0) {
      items.push({
        id: 'aniversariantes-proximos',
        title: 'Aniversariantes nos próximos 7 dias',
        description: 'Ótimo momento para contato de relacionamento.',
        count: aniversariantesProximos.length,
        to: '/clientes',
        icon: Bell,
        tone: 'success',
      });
    }

    const eventosHoje = calendarEvents.filter((event) => {
      if (event.status === 'cancelled') return false;
      const eventDate = parseDateOnly(event.start);
      if (!eventDate) return false;
      const normalizedEventDate = startOfDay(eventDate);
      return normalizedEventDate.getTime() === today.getTime();
    });
    if (eventosHoje.length > 0) {
      items.push({
        id: 'eventos-hoje',
        title: 'Eventos agendados para hoje',
        description: 'Confira os compromissos para manter a rotina em dia.',
        count: eventosHoje.length,
        to: '/agendas',
        icon: CalendarClock,
        tone: 'info',
      });
    }

    return items.slice(0, 5);
  }, [clientes, prospects, offers, monthlyGoal, reunioesMes, calendarEvents]);

  return (
    <SectionCard title="Alertas e Oportunidades" subtitle="Prioridades para o dia" className="h-full">
      {alertas.length === 0 ? (
        <InlineEmpty message="Tudo certo por aqui. Sem pendências críticas hoje." />
      ) : (
        <ul className="space-y-3">
          {alertas.map((alerta) => {
            const Icon = alerta.icon;
            const content = (
              <div
                className="rounded-lg border p-3 transition-colors hover:bg-[var(--color-surface-3)]"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  borderColor: 'var(--color-border-subtle)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getToneBackground(alerta.tone) }}
                  >
                    <Icon className="w-4 h-4" style={{ color: getToneColor(alerta.tone) }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {alerta.title}
                      </p>
                      {typeof alerta.count === 'number' && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: getToneColor(alerta.tone),
                            backgroundColor: getToneBackground(alerta.tone),
                          }}
                        >
                          {alerta.count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {alerta.description}
                    </p>
                  </div>
                </div>
              </div>
            );

            return (
              <li key={alerta.id}>
                {alerta.to ? (
                  <Link to={alerta.to} className="block rounded-lg focus-gold">
                    {content}
                  </Link>
                ) : content}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
