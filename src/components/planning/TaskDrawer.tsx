import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Button, Badge, Input } from '../ui';
import type { PlanningTask } from '../../domain/planning/planningTypes';
import {
  TASK_TYPE_LABELS,
  TASK_ORIGIN_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  LINKED_ENTITY_LABELS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
} from '../../domain/planning/planningConstants';
import { formatDatePtBR, formatDuration } from '../../domain/planning/planningUtils';
import { getTaskEntityRoute } from '../../domain/planning/planningIntegration';
import { useFocusMode } from '../../contexts/FocusModeContext';
import {
  Check,
  Clock,
  CalendarDays,
  Edit3,
  Archive,
  ArrowRight,
  ExternalLink,
  Target,
} from 'lucide-react';

interface TaskDrawerProps {
  task: PlanningTask | null;
  onClose: () => void;
  onComplete: (id: string) => Promise<void>;
  onPostpone: (id: string) => Promise<void>;
  onReschedule: (id: string, date: string, startTime: string, endTime: string) => Promise<void>;
  onEdit: (task: PlanningTask) => void;
  onArchive: (id: string) => Promise<void>;
}

export default function TaskDrawer({
  task,
  onClose,
  onComplete,
  onPostpone,
  onReschedule,
  onEdit,
  onArchive,
}: TaskDrawerProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [acting, setActing] = useState(false);
  const navigate = useNavigate();
  const { startFromTask, status: focusStatus } = useFocusMode();

  if (!task) return null;

  const isCompleted = task.status === 'completed';
  const isArchived = task.status === 'archived';
  const isActionable = !isCompleted && !isArchived;
  const entityRoute = task ? getTaskEntityRoute(task) : null;

  const handleAction = async (action: () => Promise<void>) => {
    setActing(true);
    try {
      await action();
    } finally {
      setActing(false);
    }
  };

  return (
    <Drawer
      isOpen={Boolean(task)}
      onClose={() => { setShowReschedule(false); onClose(); }}
      title={task.title}
      subtitle={TASK_TYPE_LABELS[task.type]}
      size="md"
      footer={
        isActionable ? (
          <>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={() => handleAction(() => onComplete(task.id!))}
              loading={acting}
            >
              Concluir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Clock className="w-4 h-4" />}
              onClick={() => handleAction(() => onPostpone(task.id!))}
              disabled={acting}
            >
              Adiar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Edit3 className="w-4 h-4" />}
              onClick={() => onEdit(task)}
              disabled={acting}
            >
              Editar
            </Button>
            {focusStatus === 'idle' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Target className="w-4 h-4" />}
                onClick={() => {
                  startFromTask({
                    id: task.id!,
                    title: task.title,
                    context: TASK_TYPE_LABELS[task.type],
                    durationMinutes: task.durationMinutes > 0 ? task.durationMinutes : undefined,
                  });
                  onClose();
                }}
              >
                Focar
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
            {STATUS_LABELS[task.status]}
          </Badge>
        </div>

        {/* Entity link context */}
        {task.linkedEntityType !== 'none' && task.linkedEntityName && (
          <div
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-gold-bg)', border: '1px solid var(--color-gold)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {LINKED_ENTITY_LABELS[task.linkedEntityType]}
              </p>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-gold)' }}>
                {task.linkedEntityName}
              </p>
            </div>
            {entityRoute && (
              <button
                onClick={() => navigate(entityRoute)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-gold)' }}
                title={`Abrir ${LINKED_ENTITY_LABELS[task.linkedEntityType]}`}
              >
                Abrir
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Details */}
        <div className="space-y-3">
          <DetailRow label="Data" value={formatDatePtBR(task.date)} />
          {task.startTime && (
            <DetailRow
              label="Horário"
              value={`${task.startTime} - ${task.endTime}${task.durationMinutes > 0 ? ` (${formatDuration(task.durationMinutes)})` : ''}`}
            />
          )}
          <DetailRow label="Tipo" value={TASK_TYPE_LABELS[task.type]} />
          <DetailRow label="Origem" value={TASK_ORIGIN_LABELS[task.origin]} />
          {task.linkedEntityType !== 'none' && (
            <DetailRow
              label={LINKED_ENTITY_LABELS[task.linkedEntityType]}
              value={task.linkedEntityName || '-'}
            />
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Descri\u00e7\u00e3o
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Observa\u00e7\u00f5es
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {task.notes}
            </p>
          </div>
        )}

        {/* Completion note */}
        {task.completionNote && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-success)' }}>
              Nota de Conclus\u00e3o
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {task.completionNote}
            </p>
          </div>
        )}

        {/* Reschedule */}
        {isActionable && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {!showReschedule ? (
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                leftIcon={<CalendarDays className="w-4 h-4" />}
                onClick={() => {
                  setRescheduleDate(task.date);
                  setRescheduleStart(task.startTime);
                  setRescheduleEnd(task.endTime);
                  setShowReschedule(true);
                }}
              >
                Reagendar
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Reagendar tarefa
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    label="Data"
                  />
                  <Input
                    type="time"
                    value={rescheduleStart}
                    onChange={(e) => setRescheduleStart(e.target.value)}
                    label="In\u00edcio"
                  />
                  <Input
                    type="time"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                    label="Fim"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    leftIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() =>
                      handleAction(() =>
                        onReschedule(task.id!, rescheduleDate, rescheduleStart, rescheduleEnd),
                      )
                    }
                    loading={acting}
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReschedule(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                leftIcon={<Archive className="w-4 h-4" />}
                onClick={() => handleAction(() => onArchive(task.id!))}
                disabled={acting}
              >
                Arquivar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span className="text-sm text-right" style={{ color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}
