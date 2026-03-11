import { useState, useMemo, useCallback } from 'react';
import { Modal, Button, Textarea, Badge } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import * as planningService from '../../services/planningService';
import { toastSuccess, toastError } from '../../lib/toast';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  Target,
  CalendarRange,
  CalendarDays,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  PRIORITY_LABELS,
  PRIORITY_BADGE_VARIANT,
  TASK_TYPE_LABELS,
  LINKED_ENTITY_LABELS,
} from '../../domain/planning/planningConstants';
import type { PlanningTask, ChecklistSummary } from '../../domain/planning/planningTypes';

export type { ChecklistSummary };

interface DailyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    completedCount: number;
    pendingCount: number;
  };
  date: string;
  overflowTasks?: PlanningTask[];
  tomorrowTasks?: PlanningTask[];
  tomorrowPriority1?: PlanningTask | null;
  tomorrowMainPending?: PlanningTask | null;
  tomorrowTasksCount?: number;
  onPostponeTask?: (id: string) => void;
  checklistSummary?: ChecklistSummary;
  onGoToChecklist?: () => void;
}

export default function DailyReviewModal({
  isOpen,
  onClose,
  stats,
  date,
  overflowTasks = [],
  tomorrowTasks = [],
  tomorrowPriority1 = null,
  tomorrowMainPending = null,
  tomorrowTasksCount = 0,
  onPostponeTask,
  checklistSummary,
  onGoToChecklist,
}: DailyReviewModalProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Batch overflow selection — all pre-selected by default
  const [selectedOverflow, setSelectedOverflow] = useState<Set<string>>(
    () => new Set(overflowTasks.map((t) => t.id!)),
  );

  // Priority #1 picker
  const [pickedPriority1Id, setPickedPriority1Id] = useState<string | null>(
    () => tomorrowPriority1?.id ?? null,
  );
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  const toggleOverflow = useCallback((id: string) => {
    setSelectedOverflow((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOverflow = useCallback(() => {
    setSelectedOverflow((prev) =>
      prev.size === overflowTasks.length
        ? new Set<string>()
        : new Set(overflowTasks.map((t) => t.id!)),
    );
  }, [overflowTasks]);

  // Candidates for priority #1: tomorrow tasks + selected overflow
  const priorityCandidates = useMemo(() => {
    const selectedOverflowTasks = overflowTasks.filter(
      (t) => t.id && selectedOverflow.has(t.id),
    );
    const ids = new Set<string>();
    const result: PlanningTask[] = [];
    for (const t of [...tomorrowTasks, ...selectedOverflowTasks]) {
      if (t.id && !ids.has(t.id)) {
        ids.add(t.id);
        result.push(t);
      }
    }
    return result;
  }, [tomorrowTasks, overflowTasks, selectedOverflow]);

  const pickedPriority1 = useMemo(
    () => priorityCandidates.find((t) => t.id === pickedPriority1Id) ?? tomorrowPriority1,
    [priorityCandidates, pickedPriority1Id, tomorrowPriority1],
  );

  const rescheduledCount = selectedOverflow.size;
  const totalAll = stats.completedCount + stats.pendingCount;
  const completionRate = totalAll > 0 ? Math.round((stats.completedCount / totalAll) * 100) : 0;

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      // Batch-postpone selected overflow tasks
      if (onPostponeTask) {
        for (const id of selectedOverflow) {
          await onPostponeTask(id);
        }
      }

      await planningService.saveDailyReview(
        {
          date,
          completedCount: stats.completedCount,
          pendingCount: stats.pendingCount,
          rescheduledCount,
          notes,
        },
        user.uid,
      );
      toastSuccess('Revisão do dia salva');
      setNotes('');
      onClose();
    } catch {
      toastError('Erro ao salvar revisão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Revisão do Dia"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar Revisão
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Resumo visual */}
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: completionRate >= 80
              ? 'var(--color-success-bg)'
              : completionRate >= 50
                ? 'var(--color-warning-bg)'
                : 'var(--color-danger-bg)',
            border: `1px solid ${
              completionRate >= 80
                ? 'var(--color-success)'
                : completionRate >= 50
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)'
            }`,
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-5 h-5" style={{
              color: completionRate >= 80
                ? 'var(--color-success)'
                : completionRate >= 50
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
            }} />
            <p className="text-sm font-semibold" style={{
              color: completionRate >= 80
                ? 'var(--color-success)'
                : completionRate >= 50
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
            }}>
              {completionRate >= 80
                ? 'Excelente! Dia produtivo.'
                : completionRate >= 50
                  ? 'Dia razoável. Algumas tarefas ficaram pendentes.'
                  : 'Dia difícil. Muitas pendências acumularam.'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold" style={{
              color: completionRate >= 80
                ? 'var(--color-success)'
                : completionRate >= 50
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
            }}>
              {completionRate}%
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              taxa de conclusão
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className="text-center p-3 rounded-xl"
            style={{ backgroundColor: 'var(--color-success-bg)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
              {stats.completedCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Concluídas
            </p>
          </div>
          <div
            className="text-center p-3 rounded-xl"
            style={{ backgroundColor: 'var(--color-warning-bg)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>
              {stats.pendingCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Pendentes
            </p>
          </div>
          <div
            className="text-center p-3 rounded-xl"
            style={{ backgroundColor: 'var(--color-info-bg)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowRight className="w-4 h-4" style={{ color: 'var(--color-info)' }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-info)' }}>
              {rescheduledCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              P/ transbordo
            </p>
          </div>
        </div>

        {/* Transbordo — batch selection */}
        {overflowTasks.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                  Transbordo — {overflowTasks.length} tarefa(s)
                </p>
              </div>
              <button
                onClick={toggleAllOverflow}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-info-bg)]"
                style={{ color: 'var(--color-info)' }}
              >
                {selectedOverflow.size === overflowTasks.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Selecione as tarefas que deseja adiar para amanhã:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overflowTasks.map((task) => {
                const isSelected = task.id ? selectedOverflow.has(task.id) : false;
                return (
                  <button
                    key={task.id}
                    onClick={() => task.id && toggleOverflow(task.id)}
                    className="w-full flex items-center gap-2 rounded-lg p-2 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-info-bg)'
                        : 'var(--color-surface-2)',
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-info)' }} />
                    ) : (
                      <Square className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    )}
                    <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {task.title}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedOverflow.size > 0 && (
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-info)' }}>
                {selectedOverflow.size} tarefa(s) serão adiadas ao salvar
              </p>
            )}
          </div>
        )}

        {/* Prioridade #1 de amanhã — selectable */}
        {(pickedPriority1 || priorityCandidates.length > 0) && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-gold-bg)',
              border: '1px solid var(--color-gold)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gold)' }}>
                  Prioridade #1 de amanhã
                </p>
              </div>
              {priorityCandidates.length > 1 && (
                <button
                  onClick={() => setShowPriorityPicker((v) => !v)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-gold-bg)]"
                  style={{ color: 'var(--color-gold)' }}
                >
                  Trocar
                  {showPriorityPicker ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>

            {pickedPriority1 && !showPriorityPicker && (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {pickedPriority1.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={PRIORITY_BADGE_VARIANT[pickedPriority1.priority]}>
                    {PRIORITY_LABELS[pickedPriority1.priority]}
                  </Badge>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {TASK_TYPE_LABELS[pickedPriority1.type]}
                  </span>
                  {pickedPriority1.linkedEntityName && (
                    <span className="text-xs" style={{ color: 'var(--color-gold)' }}>
                      {LINKED_ENTITY_LABELS[pickedPriority1.linkedEntityType]} — {pickedPriority1.linkedEntityName}
                    </span>
                  )}
                </div>
              </>
            )}

            {showPriorityPicker && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto mt-2">
                {priorityCandidates.map((task) => {
                  const isPicked = task.id === pickedPriority1?.id;
                  return (
                    <button
                      key={task.id}
                      onClick={() => {
                        setPickedPriority1Id(task.id!);
                        setShowPriorityPicker(false);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg p-2 text-left transition-colors"
                      style={{
                        backgroundColor: isPicked
                          ? 'var(--color-gold-bg)'
                          : 'var(--color-surface)',
                        border: isPicked ? '1px solid var(--color-gold)' : '1px solid transparent',
                      }}
                    >
                      {isPicked ? (
                        <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-gold)' }} />
                      ) : (
                        <div className="w-3.5 h-3.5 flex-shrink-0 rounded-full border" style={{ borderColor: 'var(--color-text-muted)' }} />
                      )}
                      <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {task.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Principal pendência para amanhã */}
        {tomorrowMainPending && tomorrowMainPending.id !== pickedPriority1?.id && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-danger)' }}>
                Principal pendência para amanhã
              </p>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {tomorrowMainPending.title}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={PRIORITY_BADGE_VARIANT[tomorrowMainPending.priority]}>
                {PRIORITY_LABELS[tomorrowMainPending.priority]}
              </Badge>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {TASK_TYPE_LABELS[tomorrowMainPending.type]}
              </span>
              {tomorrowMainPending.linkedEntityName && (
                <span className="text-xs" style={{ color: 'var(--color-gold)' }}>
                  {tomorrowMainPending.linkedEntityName}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Resumo de amanhã */}
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-info)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Amanhã você tem <strong>{tomorrowTasksCount}</strong> tarefa(s) agendada(s)
            {selectedOverflow.size > 0 && (
              <> + <strong>{selectedOverflow.size}</strong> do transbordo de hoje</>
            )}
            .
          </p>
        </div>

        {/* Disciplina — Checklist semanal e mensal */}
        {checklistSummary && (checklistSummary.weeklyTotal > 0 || checklistSummary.monthlyTotal > 0) && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-gold)' }}
            >
              Disciplina da Semana / Mês
            </p>

            <div className="space-y-3">
              {/* Weekly */}
              {checklistSummary.weeklyTotal > 0 && (
                <div className="flex items-center gap-3">
                  <CalendarRange className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-gold)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        Semanal
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: checklistSummary.weeklyProgress >= 100
                            ? 'var(--color-success)'
                            : checklistSummary.weeklyProgress >= 50
                              ? 'var(--color-gold)'
                              : 'var(--color-warning)',
                        }}
                      >
                        {checklistSummary.weeklyChecked}/{checklistSummary.weeklyTotal}
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: 'var(--color-surface-3)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, checklistSummary.weeklyProgress)}%`,
                          backgroundColor: checklistSummary.weeklyProgress >= 100
                            ? 'var(--color-success)'
                            : checklistSummary.weeklyProgress >= 50
                              ? 'var(--color-gold)'
                              : 'var(--color-warning)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly */}
              {checklistSummary.monthlyTotal > 0 && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-gold)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        Mensal
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: checklistSummary.monthlyProgress >= 100
                            ? 'var(--color-success)'
                            : checklistSummary.monthlyProgress >= 50
                              ? 'var(--color-gold)'
                              : 'var(--color-warning)',
                        }}
                      >
                        {checklistSummary.monthlyChecked}/{checklistSummary.monthlyTotal}
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: 'var(--color-surface-3)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, checklistSummary.monthlyProgress)}%`,
                          backgroundColor: checklistSummary.monthlyProgress >= 100
                            ? 'var(--color-success)'
                            : checklistSummary.monthlyProgress >= 50
                              ? 'var(--color-gold)'
                              : 'var(--color-warning)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pending items preview (up to 3) */}
              {checklistSummary.weeklyPending.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Pendentes da semana:
                  </p>
                  <div className="space-y-1">
                    {checklistSummary.weeklyPending.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Square className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                    {checklistSummary.weeklyPending.length > 3 && (
                      <p className="text-xs pl-5" style={{ color: 'var(--color-text-muted)' }}>
                        + {checklistSummary.weeklyPending.length - 3} item(ns)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              {(checklistSummary.weeklyPending.length > 0 || checklistSummary.monthlyPending.length > 0) && onGoToChecklist && (
                <button
                  onClick={() => { onGoToChecklist(); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--color-gold-bg)]"
                  style={{ color: 'var(--color-gold)' }}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Revisar checklist
                </button>
              )}

              {/* All done */}
              {checklistSummary.weeklyPending.length === 0 && checklistSummary.monthlyPending.length === 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                    Checklists em dia!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <Textarea
          label="Observações do dia"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Como foi o dia? O que ficou pendente? Alguma ação importante para amanhã?"
          rows={3}
        />
      </div>
    </Modal>
  );
}
