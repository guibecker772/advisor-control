import { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Select } from '../ui';
import type { PlanningBlock } from '../../domain/planning/planningTypes';
import { BLOCK_CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '../../domain/planning/planningConstants';
import { createDefaultBlock, calculateDurationMinutes } from '../../domain/planning/planningUtils';
import { toastSuccess } from '../../lib/toast';

interface BlockFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PlanningBlock, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: PlanningBlock | null;
}

export default function BlockFormModal({ isOpen, onClose, onSave, initialData }: BlockFormModalProps) {
  const isEditing = Boolean(initialData?.id);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => createDefaultBlock());

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title,
          category: initialData.category,
          date: initialData.date,
          startTime: initialData.startTime,
          endTime: initialData.endTime,
          durationMinutes: initialData.durationMinutes,
          priority: initialData.priority,
          notes: initialData.notes,
        });
      } else {
        setFormData(createDefaultBlock());
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
      toastSuccess(isEditing ? 'Bloco atualizado' : 'Bloco criado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Bloco' : 'Novo Bloco de Trabalho'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!formData.title.trim()}>
            {isEditing ? 'Salvar' : 'Criar Bloco'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Título"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Ex: Prospecção, Revisão de carteira..."
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoria"
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value as typeof formData.category)}
            options={BLOCK_CATEGORY_OPTIONS}
          />
          <Select
            label="Prioridade"
            value={formData.priority}
            onChange={(e) => updateField('priority', e.target.value as typeof formData.priority)}
            options={PRIORITY_OPTIONS}
          />
        </div>
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
        <Textarea
          label="Observações"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Anotações sobre o bloco..."
          rows={2}
        />
      </div>
    </Modal>
  );
}
