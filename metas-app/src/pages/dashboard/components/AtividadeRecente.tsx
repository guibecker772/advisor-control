import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Package,
  Repeat,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrency } from '../../../domain/calculations';
import { getOfferStatusLabel, normalizeOfferStatus } from '../../../domain/offers';
import type { CaptacaoLancamento, Cliente, Cross, OfferReservation, Prospect } from '../../../domain/types';
import type { CalendarEvent } from '../../../domain/types/calendar';
import { InlineEmpty, SectionCard } from '../../../components/ui';

interface AtividadeRecenteProps {
  clientes: Cliente[];
  prospects: Prospect[];
  lancamentosCaptacao: CaptacaoLancamento[];
  offers: OfferReservation[];
  crosses: Cross[];
  calendarEvents?: CalendarEvent[];
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: number;
  icon: LucideIcon;
  to?: string;
}

function parseDate(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getTime();
}

function parseDateOnly(value?: string | null): number | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.getTime();
  }
  return parseDate(value);
}

function getEntityTimestamp(updatedAt?: string, createdAt?: string, fallbackDate?: string): number | null {
  return parseDate(updatedAt) ?? parseDate(createdAt) ?? parseDateOnly(fallbackDate);
}

function formatActivityTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);

  if (sameDay) return `Hoje às ${time}`;
  if (isYesterday) return `Ontem às ${time}`;

  const full = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return full;
}

export function AtividadeRecente({
  clientes,
  prospects,
  lancamentosCaptacao,
  offers,
  crosses,
  calendarEvents = [],
}: AtividadeRecenteProps) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    clientes.forEach((cliente) => {
      const timestamp = getEntityTimestamp(cliente.updatedAt, cliente.createdAt, cliente.dataEntrada);
      if (timestamp === null || !cliente.nome) return;
      items.push({
        id: `cliente-${cliente.id || cliente.nome}-${timestamp}`,
        title: `Cliente: ${cliente.nome}`,
        subtitle: cliente.status === 'ativo' ? 'Cadastro atualizado' : `Status: ${cliente.status || 'indefinido'}`,
        timestamp,
        icon: Users,
        to: '/clientes',
      });
    });

    prospects.forEach((prospect) => {
      const timestamp = getEntityTimestamp(prospect.updatedAt, prospect.createdAt, prospect.proximoContato);
      if (timestamp === null || !prospect.nome) return;
      items.push({
        id: `prospect-${prospect.id || prospect.nome}-${timestamp}`,
        title: `Prospect: ${prospect.nome}`,
        subtitle: prospect.converted ? 'Prospect convertido em cliente' : `Status: ${prospect.status || 'novo'}`,
        timestamp,
        icon: UserPlus,
        to: '/prospects',
      });
    });

    lancamentosCaptacao.forEach((lancamento) => {
      const timestamp = getEntityTimestamp(lancamento.updatedAt, lancamento.createdAt, lancamento.data);
      if (timestamp === null) return;
      const signedValue = lancamento.direcao === 'entrada' ? lancamento.valor : -lancamento.valor;
      items.push({
        id: `captacao-${lancamento.id || timestamp}`,
        title: 'Lançamento de Captação',
        subtitle: `${lancamento.referenciaNome || 'Sem referência'} · ${formatCurrency(signedValue)}`,
        timestamp,
        icon: TrendingUp,
        to: '/captacao',
      });
    });

    offers.forEach((offer) => {
      const timestamp = getEntityTimestamp(offer.updatedAt, offer.createdAt, offer.dataReserva);
      if (timestamp === null || !offer.nomeAtivo) return;
      const normalizedStatus = normalizeOfferStatus(offer.status, {
        reservaEfetuada: offer.reservaEfetuada,
        reservaLiquidada: offer.reservaLiquidada,
      });
      items.push({
        id: `offer-${offer.id || offer.nomeAtivo}-${timestamp}`,
        title: `Oferta: ${offer.nomeAtivo}`,
        subtitle: `Status ${getOfferStatusLabel(normalizedStatus)}`,
        timestamp,
        icon: Package,
        to: '/ofertas',
      });
    });

    crosses.forEach((cross) => {
      const timestamp = getEntityTimestamp(cross.updatedAt, cross.createdAt, cross.dataVenda);
      if (timestamp === null || !cross.produto) return;
      items.push({
        id: `cross-${cross.id || cross.produto}-${timestamp}`,
        title: `Cross: ${cross.produto}`,
        subtitle: `Comissão ${formatCurrency(cross.comissao || 0)}`,
        timestamp,
        icon: Repeat,
        to: '/cross',
      });
    });

    calendarEvents.forEach((event) => {
      const timestamp = getEntityTimestamp(event.updatedAt, event.createdAt, event.start);
      if (timestamp === null || !event.title) return;
      items.push({
        id: `agenda-${event.id || event.title}-${timestamp}`,
        title: `Agenda: ${event.title}`,
        subtitle: event.location || 'Sem local definido',
        timestamp,
        icon: Calendar,
        to: '/agendas',
      });
    });

    return items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [clientes, prospects, lancamentosCaptacao, offers, crosses, calendarEvents]);

  return (
    <SectionCard title="Atividade recente" subtitle="Últimas movimentações registradas" className="h-full">
      {activities.length === 0 ? (
        <InlineEmpty message="Sem atividade registrada ainda." />
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {activities.map((activity) => {
            const Icon = activity.icon;
            const content = (
              <div className="py-3 flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-surface-2)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: 'var(--color-info)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {activity.title}
                    </p>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      {formatActivityTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {activity.subtitle}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={activity.id}>
                {activity.to ? (
                  <Link
                    to={activity.to}
                    className="block px-1 rounded-md transition-colors focus-gold hover:bg-[var(--color-surface-hover)]"
                  >
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

