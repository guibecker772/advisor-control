import { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Select } from '../ui';
import type { PlanningTask } from '../../domain/planning/planningTypes';
import {
  TASK_TYPE_OPTIONS,
  TASK_ORIGIN_OPTIONS,
  LINKED_ENTITY_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../domain/planning/planningConstants';
import { createDefaultTask, calculateDurationMinutes } from '../../domain/planning/planningUtils';
import { toastSuccess } from '../../lib/toast';
import { useAuth } from '../../contexts/AuthContext';
import { clienteRepository, prospectRepository } from '../../services/repositories';
import type { Cliente, Prospect } from '../../domain/types';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PlanningTask, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: PlanningTask | null;
}

export default function TaskFormModal({ isOpen, onClose, onSave, initialData }: TaskFormModalProps) {
  const isEditing = Boolean(initialData?.id);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(() => createDefaultTask());

  const { user } = useAuth();
  const [entityOptions, setEntityOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [entitySearch, setEntitySearch] = useState('');

  // Load entity options when entity type changes
  useEffect(() => {
    async function loadEntities() {
      if (!user?.uid) return;
      if (formData.linkedEntityType === 'client') {
        const clients = await clienteRepository.getAll(user.uid);
        setEntityOptions(clients.map((c: Cliente) => ({ id: c.id ?? '', name: c.nome })));
      } else if (formData.linkedEntityType === 'prospect') {
        const prospects = await prospectRepository.getAll(user.uid);
        setEntityOptions(prospects.map((p: Prospect) => ({ id: p.id ?? '', name: p.nome })));
      } else {
        setEntityOptions([]);
      }
      setEntitySearch('');
    }
    loadEntities();
  }, [formData.linkedEntityType, user?.uid]);

  const filteredEntities = entityOptions.filter((e) =>
    e.name.toLowerCase().includes(entitySearch.toLowerCase()),
  );

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title,
          description: initialData.description,
          type: initialData.type,
          origin: initialData.origin,
          linkedEntityType: initialData.linkedEntityType,
          linkedEntityId: initialData.linkedEntityId,
          linkedEntityName: initialData.linkedEntityName,
          date: initialData.date,
          startTime: initialData.startTime,
          endTime: initialData.endTime,
          durationMinutes: initialData.durationMinutes,
          priority: initialData.priority,
          status: initialData.status,
          isRecurring: initialData.isRecurring,
          recurrenceRule: initialData.recurrenceRule,
          notes: initialData.notes,
          completionNote: initialData.completionNote,
        });
      } else {
        setFormData(createDefaultTask());
      }
    }
  }, [isOpen, initialData]);

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'startTime' || key === 'endTime') {
        updated.durationMinutes = calculateDurationMinutes(
          key === 'startTime' ? (value as string) : prev.startTime,
          key === 'endTime' ? (value as string) : prev.endTime,
        );
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);
    try {
      await onSave(formData);
      toastSuccess(isEditing ? 'Tarefa atualizada' : 'Tarefa criada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!formData.title.trim()}>
            {isEditing ? 'Salvar' : 'Criar Tarefa'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Título"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Ex: Reunião com cliente, Follow-up prospect..."
        />

        <Textarea
          label="Descrição"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Detalhes da tarefa..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo"
            value={formData.type}
            onChange={(e) => updateField('type', e.target.value as typeof formData.type)}
            options={TASK_TYPE_OPTIONS}
          />
          <Select
            label="Prioridade"
            value={formData.priority}
            onChange={(e) => updateField('priority', e.target.value as typeof formData.priority)}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Origem"
            value={formData.origin}
            onChange={(e) => updateField('origin', e.target.value as typeof formData.origin)}
            options={TASK_ORIGIN_OPTIONS}
          />
          <Select
            label="Vínculo"
            value={formData.linkedEntityType}
            onChange={(e) => updateField('linkedEntityType', e.target.value as typeof formData.linkedEntityType)}
            options={LINKED_ENTITY_OPTIONS}
          />
        </div>

        {formData.linkedEntityType !== 'none' && (
          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gold)' }}>
                {formData.linkedEntityType === 'client' ? 'Cliente' : formData.linkedEntityType === 'prospect' ? 'Prospect' : formData.linkedEntityType === 'offer' ? 'Oferta' : formData.linkedEntityType === 'cross' ? 'Cross Selling' : 'Meta'}
              </span>
              {formData.linkedEntityName && (
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--color-surface-3)]"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => {
                    updateField('linkedEntityId', '');
                    updateField('linkedEntityName', '');
                    setEntitySearch('');
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
            {(formData.linkedEntityType === 'client' || formData.linkedEntityType === 'prospect') && entityOptions.length > 0 ? (
              <div>
                <Input
                  label={`Buscar ${formData.linkedEntityType === 'client' ? 'Cliente' : 'Prospect'}`}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  placeholder="Digite para buscar..."
                />
                {entitySearch && filteredEntities.length > 0 && (
                  <div
                    className="mt-1 max-h-32 overflow-y-auto rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {filteredEntities.slice(0, 5).map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-2)]"
                        style={{ color: 'var(--color-text)' }}
                        onClick={() => {
                          updateField('linkedEntityId', entity.id);
                          updateField('linkedEntityName', entity.name);
                          setEntitySearch('');
                        }}
                      >
                        {entity.name}
                      </button>
                    ))}
                  </div>
                )}
                {formData.linkedEntityName && (
                  <div
                    className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-gold-bg)', border: '1px solid var(--color-gold)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--color-gold)' }}>
                      {formData.linkedEntityType === 'client' ? 'Cliente' : 'Prospect'} — {formData.linkedEntityName}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Input
                label="Nome do Vínculo"
                value={formData.linkedEntityName}
                onChange={(e) => updateField('linkedEntityName', e.target.value)}
                placeholder="Ex: João Silva, Oferta CDB 120%..."
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => updateField('date', e.target.value)}
          />
          <Input
            label="Início"
            type="time"
            value={formData.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
          />
          <Input
            label="Fim"
            type="time"
            value={formData.endTime}
            onChange={(e) => updateField('endTime', e.target.value)}
          />
        </div>

        {formData.durationMinutes > 0 && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Duração: {Math.floor(formData.durationMinutes / 60) > 0 ? `${Math.floor(formData.durationMinutes / 60)}h` : ''}{formData.durationMinutes % 60 > 0 ? `${formData.durationMinutes % 60}min` : ''}
          </p>
        )}

        <Textarea
          label="Observações"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Anotações adicionais..."
          rows={2}
        />
      </div>
    </Modal>
  );
}
