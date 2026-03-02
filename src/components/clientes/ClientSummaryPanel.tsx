import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  FileText,
  Link2,
  UserRoundCheck,
} from 'lucide-react';

import type { Cliente, ClienteReuniao } from '../../domain/types';
import type { CalendarEvent } from '../../domain/types/calendar';
import { calendarEventRepository, clienteReuniaoRepository } from '../../services/repositories';
import { Badge, BaseCard, Button, EmptyState, ErrorState, Tooltip } from '../ui';

type TimelineStatus = 'loading' | 'ready' | 'error';

interface ClientTimelineItem {
  id: string;
  timestamp: number;
  dateLabel: string;
  title: string;
  description: string;
  source: 'agenda' | 'interaction';
}

interface ClientSummaryPanelProps {
  client: Cliente;
  ownerUid?: string;
  isPwLinked: boolean;
  openingPlanning?: boolean;
  openingExport?: boolean;
  canOpenPlanning: boolean;
  canOpenExport: boolean;
  canCreateEvent: boolean;
  planningDisabledReason?: string;
  exportDisabledReason?: string;
  createEventDisabledReason?: string;
  onLinkPw: () => void;
  onOpenPlanning: () => void;
  onOpenExport: () => void;
  onCreateEvent: () => void;
  onViewAgendas: () => void;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMonthYear(mes: number, ano: number): string {
  const date = new Date(ano, Math.max(0, mes - 1), 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function resolveMeetingTimestamp(reuniao: ClienteReuniao): number {
  const updatedAt = parseTimestamp(reuniao.updatedAt);
  if (updatedAt > 0) return updatedAt;

  const createdAt = parseTimestamp(reuniao.createdAt);
  if (createdAt > 0) return createdAt;

  const fallback = new Date(reuniao.ano, reuniao.mes - 1, 1).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
}

function getRelatedClientValue(event: CalendarEvent): string | null {
  const rawEvent = event as CalendarEvent & Record<string, unknown>;
  const keys = [
    'clienteId',
    'clientId',
    'clienteNome',
    'clienteName',
    'clientName',
    'cliente',
    'prospectNome',
    'prospectName',
    'prospect',
  ];

  for (const key of keys) {
    const value = rawEvent[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }

  return null;
}

function eventBelongsToClient(event: CalendarEvent, clientId: string, normalizedClientName: string): boolean {
  const relatedValue = getRelatedClientValue(event);
  if (relatedValue) {
    if (relatedValue === clientId) return true;
    if (normalizeText(relatedValue) === normalizedClientName) return true;
  }

  const normalizedTitle = normalizeText(event.title || '');
  if (normalizedClientName && normalizedTitle.includes(normalizedClientName)) {
    return true;
  }

  return false;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`timeline-skeleton-${index}`}
          className="rounded-lg p-3 animate-pulse"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="h-3 w-28 rounded" style={{ backgroundColor: 'var(--color-surface-3)' }} />
          <div className="mt-2 h-4 w-56 rounded" style={{ backgroundColor: 'var(--color-surface-3)' }} />
          <div className="mt-2 h-3 w-40 rounded" style={{ backgroundColor: 'var(--color-surface-3)' }} />
        </div>
      ))}
    </div>
  );
}

function ActionWithTooltip({
  tooltip,
  children,
}: {
  tooltip?: string;
  children: ReactNode;
}) {
  if (!tooltip) return <>{children}</>;
  return (
    <Tooltip content={tooltip}>
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
}

export default function ClientSummaryPanel({
  client,
  ownerUid,
  isPwLinked,
  openingPlanning = false,
  openingExport = false,
  canOpenPlanning,
  canOpenExport,
  canCreateEvent,
  planningDisabledReason,
  exportDisabledReason,
  createEventDisabledReason,
  onLinkPw,
  onOpenPlanning,
  onOpenExport,
  onCreateEvent,
  onViewAgendas,
}: ClientSummaryPanelProps) {
  const [timelineStatus, setTimelineStatus] = useState<TimelineStatus>('loading');
  const [timelineItems, setTimelineItems] = useState<ClientTimelineItem[]>([]);
  const [nextMeeting, setNextMeeting] = useState<ClientTimelineItem | null>(null);

  const normalizedClientName = useMemo(
    () => normalizeText(client.nome || ''),
    [client.nome],
  );

  const loadTimeline = useCallback(async () => {
    const clientId = client.id;
    if (!ownerUid || !clientId) {
      setTimelineItems([]);
      setNextMeeting(null);
      setTimelineStatus('ready');
      return;
    }

    try {
      setTimelineStatus('loading');
      const [reunioes, allEvents] = await Promise.all([
        clienteReuniaoRepository.getByCliente(ownerUid, clientId),
        calendarEventRepository.getAll(ownerUid),
      ]);

      const relatedEvents = allEvents.filter((event) =>
        eventBelongsToClient(event, clientId, normalizedClientName),
      );

      const eventItems: ClientTimelineItem[] = relatedEvents
        .map((event) => {
          const timestamp = parseTimestamp(event.start);
          return {
            id: `agenda-${event.id || event.start || Math.random().toString(36).slice(2)}`,
            timestamp,
            dateLabel: formatDateTime(event.start),
            title: event.title || 'Evento de agenda',
            description: 'Agenda do cliente',
            source: 'agenda' as const,
          };
        })
        .filter((item) => item.timestamp > 0);

      const reuniaoItems: ClientTimelineItem[] = reunioes
        .map((reuniao) => {
          const timestamp = resolveMeetingTimestamp(reuniao);
          const periodLabel = formatMonthYear(reuniao.mes, reuniao.ano);
          const statusLabel = reuniao.realizada ? 'Reuniao realizada' : 'Reuniao pendente';

          return {
            id: `interacao-${reuniao.id || `${reuniao.mes}-${reuniao.ano}`}`,
            timestamp,
            dateLabel: periodLabel,
            title: statusLabel,
            description: reuniao.observacoes?.trim() || 'Sem observacoes registradas',
            source: 'interaction' as const,
          };
        })
        .filter((item) => item.timestamp > 0);

      const merged = [...eventItems, ...reuniaoItems].sort((left, right) => right.timestamp - left.timestamp);
      const now = Date.now();
      const next = eventItems
        .filter((item) => item.timestamp >= now)
        .sort((left, right) => left.timestamp - right.timestamp)[0] || null;

      setTimelineItems(merged.slice(0, 10));
      setNextMeeting(next);
      setTimelineStatus('ready');
    } catch (error) {
      console.error('Erro ao carregar timeline do cliente:', error);
      setTimelineStatus('error');
    }
  }, [client.id, normalizedClientName, ownerUid]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const latestInteraction = timelineItems[0] || null;
  const quickNotes = client.observacoes?.trim() || '';
  const shouldRenderSummaryCards = Boolean(nextMeeting || latestInteraction || quickNotes);

  return (
    <div className="space-y-4">
      <BaseCard variant="elevated" padding="lg">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  {client.nome}
                </h3>
                {client.status && (
                  <Badge variant="info">{client.status}</Badge>
                )}
                {client.perfilInvestidor && (
                  <Badge variant="gold">{client.perfilInvestidor}</Badge>
                )}
              </div>

              {isPwLinked ? (
                <Badge variant="success">
                  <UserRoundCheck className="w-3 h-3 mr-1" />
                  Vinculado ao Private Wealth
                </Badge>
              ) : (
                <ActionWithTooltip tooltip={!canOpenPlanning ? planningDisabledReason : undefined}>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Link2 className="w-4 h-4" />}
                    onClick={onLinkPw}
                    disabled={!canOpenPlanning || openingPlanning}
                  >
                    Vincular ao PW
                  </Button>
                </ActionWithTooltip>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionWithTooltip tooltip={!canOpenPlanning ? planningDisabledReason : undefined}>
              <Button
                variant="primary"
                leftIcon={<CalendarClock className="w-4 h-4" />}
                onClick={onOpenPlanning}
                loading={openingPlanning}
                disabled={!canOpenPlanning || openingPlanning}
              >
                Abrir Planejamento (PW)
              </Button>
            </ActionWithTooltip>

            <ActionWithTooltip tooltip={!canOpenExport ? exportDisabledReason : undefined}>
              <Button
                variant="secondary"
                leftIcon={<FileText className="w-4 h-4" />}
                onClick={onOpenExport}
                loading={openingExport}
                disabled={!canOpenExport || openingExport}
              >
                Gerar Relatorio (Private Wealth)
              </Button>
            </ActionWithTooltip>

            <ActionWithTooltip tooltip={!canCreateEvent ? createEventDisabledReason : undefined}>
              <Button
                variant="ghost"
                leftIcon={<CalendarClock className="w-4 h-4" />}
                onClick={onCreateEvent}
                disabled={!canCreateEvent}
              >
                Criar Evento
              </Button>
            </ActionWithTooltip>

            <Button
              variant="ghost"
              leftIcon={<CalendarDays className="w-4 h-4" />}
              onClick={onViewAgendas}
            >
              Ver Agendas
            </Button>
          </div>
        </div>
      </BaseCard>

      {shouldRenderSummaryCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {nextMeeting && (
            <BaseCard variant="default" padding="md">
              <p className="text-xs uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Proxima reuniao
              </p>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {nextMeeting.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {nextMeeting.dateLabel}
              </p>
            </BaseCard>
          )}

          {latestInteraction && (
            <BaseCard variant="default" padding="md">
              <p className="text-xs uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Ultima interacao
              </p>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {latestInteraction.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {latestInteraction.dateLabel}
              </p>
            </BaseCard>
          )}

          {quickNotes && (
            <BaseCard variant="default" padding="md">
              <p className="text-xs uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Notas rapidas
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text)' }}>
                {quickNotes}
              </p>
            </BaseCard>
          )}
        </div>
      )}

      <BaseCard variant="default" padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Timeline
            </h4>
          </div>

          {timelineStatus === 'loading' && <TimelineSkeleton />}

          {timelineStatus === 'error' && (
            <ErrorState
              title="Erro ao carregar timeline"
              description="Nao foi possivel carregar os eventos e interacoes deste cliente."
              onRetry={() => {
                void loadTimeline();
              }}
              retryLabel="Tentar novamente"
            />
          )}

          {timelineStatus === 'ready' && timelineItems.length === 0 && (
            <EmptyState
              title="Sem interacoes registradas"
              description="Ainda nao existem eventos ou registros de reuniao para este cliente."
              primaryAction={canCreateEvent ? { label: 'Criar evento', onClick: onCreateEvent } : undefined}
            />
          )}

          {timelineStatus === 'ready' && timelineItems.length > 0 && (
            <ul className="space-y-2">
              {timelineItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {item.title}
                    </p>
                    <Badge variant={item.source === 'agenda' ? 'info' : 'neutral'}>
                      {item.source === 'agenda' ? 'Agenda' : 'Interacao'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.dateLabel}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BaseCard>
    </div>
  );
}
