import { CalendarClock, FileText, User } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { CalendarEvent } from '../../domain/types/calendar';
import { MEETING_TYPE_LABELS } from '../../domain/types/calendar';
import { Badge, Button, Modal } from '../../components/ui';

type ChipVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface EventDetailDialogProps {
  isOpen: boolean;
  event: CalendarEvent | null;
  readOnly: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function parseDateSafe(dateValue: string): Date | null {
  const parsed = parseISO(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getStatusData(status?: string): { label: string; variant: ChipVariant; persisted: boolean } {
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

function getCategoryData(event: CalendarEvent): { label: string; persisted: boolean } {
  if (event.meetingType) {
    return { label: MEETING_TYPE_LABELS[event.meetingType], persisted: true };
  }
  return { label: 'Reuniao', persisted: false };
}

function getRelatedClientOrProspect(event: CalendarEvent): string | null {
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

function formatEventDateRange(event: CalendarEvent): string {
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
    return `${format(start, "d 'de' MMM yyyy HH:mm", { locale: ptBR })} - ${format(end, "d 'de' MMM yyyy HH:mm", { locale: ptBR })}`;
  }

  return format(start, "d 'de' MMM yyyy HH:mm", { locale: ptBR });
}

export default function EventDetailDialog({
  isOpen,
  event,
  readOnly,
  onClose,
  onEdit,
  onDelete,
}: EventDetailDialogProps) {
  if (!event) return null;

  const statusData = getStatusData(event.status);
  const categoryData = getCategoryData(event);
  const relatedContact = getRelatedClientOrProspect(event);
  const notes = (event.internalNotes && event.internalNotes.trim()) || (event.description && event.description.trim()) || null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do evento" size="md">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={statusData.variant}>{statusData.label}</Badge>
            <Badge variant="neutral">{categoryData.label}</Badge>
          </div>
        </div>

        <div
          className="rounded-lg p-3 space-y-3"
          style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-start gap-2">
            <CalendarClock className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Data e horario
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                {formatEventDateRange(event)}
              </p>
            </div>
          </div>

          {relatedContact && (
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Cliente / Prospect
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {relatedContact}
                </p>
              </div>
            </div>
          )}

          {notes && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Notas
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                  {notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {!readOnly && (onEdit || onDelete) && (
          <div className="flex items-center justify-end gap-2 pt-2">
            {onDelete && (
              <Button variant="danger" onClick={onDelete}>
                Cancelar evento
              </Button>
            )}
            {onEdit && (
              <Button variant="primary" onClick={onEdit}>
                Editar
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
