import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Trash2, MapPin, Users, FileText, Clock, Tag } from 'lucide-react';
import { format, parseISO, addHours } from 'date-fns';

import type { CalendarEvent, CalendarEventInput } from '../../domain/types/calendar';
import { 
  calendarEventSchema, 
  MEETING_TYPES, 
  MEETING_TYPE_LABELS, 
  detectMeetingType 
} from '../../domain/types/calendar';

interface EventModalProps {
  event: CalendarEvent | null;
  dateRange: { start: Date; end: Date } | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}

export default function EventModal({ 
  event, 
  dateRange, 
  onClose, 
  onSave, 
  onDelete 
}: EventModalProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [autoDetectedType, setAutoDetectedType] = useState<string>('outro');

  const isEditing = !!event?.id;

  // Valores padrão
  const getDefaultValues = (): Partial<CalendarEvent> => {
    if (event) {
      return {
        ...event,
        start: event.start ? format(parseISO(event.start), "yyyy-MM-dd'T'HH:mm") : '',
        end: event.end ? format(parseISO(event.end), "yyyy-MM-dd'T'HH:mm") : '',
      };
    }
    
    if (dateRange) {
      return {
        title: '',
        description: '',
        location: '',
        start: format(dateRange.start, "yyyy-MM-dd'T'HH:mm"),
        end: format(dateRange.end || addHours(dateRange.start, 1), "yyyy-MM-dd'T'HH:mm"),
        allDay: false,
        attendees: '',
        internalNotes: '',
        meetingTypeOverride: false,
      };
    }
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
    const defaultEnd = addHours(defaultStart, 1);
    
    return {
      title: '',
      description: '',
      location: '',
      start: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
      end: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
      allDay: false,
      attendees: '',
      internalNotes: '',
      meetingTypeOverride: false,
    };
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CalendarEventInput>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: getDefaultValues(),
  });

  const title = watch('title');
  const meetingTypeOverride = watch('meetingTypeOverride');
  const meetingType = watch('meetingType');
  const allDay = watch('allDay');

  // Auto-detectar tipo ao mudar título
  useEffect(() => {
    if (title) {
      const detected = detectMeetingType(title);
      setAutoDetectedType(detected);
      if (!meetingTypeOverride) {
        setValue('meetingType', detected);
      }
    }
  }, [title, meetingTypeOverride, setValue]);

  const handleFormSubmit = async (data: CalendarEventInput) => {
    setSaving(true);
    try {
      // Converter datas para ISO - fazer parse do schema para garantir defaults
      const parsed = calendarEventSchema.parse(data);
      const eventData: CalendarEvent = {
        ...parsed,
        start: new Date(parsed.start).toISOString(),
        end: new Date(parsed.end).toISOString(),
      };
      await onSave(eventData);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setDeleting(true);
    try {
      await onDelete(event.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative rounded-xl shadow-xl w-full max-w-lg transform transition-all" style={{ backgroundColor: 'var(--color-surface)' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {isEditing ? 'Editar Evento' : 'Novo Evento'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover-light rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Título *
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder="Ex: R1 - João Silva"
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              {errors.title && (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.title.message}</p>
              )}
              {title && !meetingTypeOverride && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Tipo detectado: <span className="font-medium">{MEETING_TYPE_LABELS[autoDetectedType as keyof typeof MEETING_TYPE_LABELS]}</span>
                </p>
              )}
            </div>

            {/* Tipo de Reunião */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo de Reunião</label>
              </div>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={meetingTypeOverride && meetingType === 'acompanhamento'}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setValue('meetingTypeOverride', true);
                      setValue('meetingType', 'acompanhamento');
                      return;
                    }
                    if (meetingType === 'acompanhamento') {
                      setValue('meetingTypeOverride', false);
                    }
                  }}
                  className="rounded"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                Marcar como reunião de acompanhamento
              </label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register('meetingTypeOverride')}
                    className="rounded"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  Selecionar manualmente
                </label>
              </div>
              {meetingTypeOverride && (
                <select
                  {...register('meetingType')}
                  className="w-full px-3 py-2 rounded-lg focus-gold"
                  style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  {MEETING_TYPES.map(type => (
                    <option key={type} value={type}>
                      {MEETING_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Data/Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Início *</label>
                </div>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  {...register('start')}
                  className="w-full px-3 py-2 rounded-lg focus-gold"
                  style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
                {errors.start && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.start.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fim *</label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  {...register('end')}
                  className="w-full px-3 py-2 rounded-lg focus-gold"
                  style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
                {errors.end && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-danger)' }}>{errors.end.message}</p>
                )}
              </div>
            </div>

            {/* Dia inteiro */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register('allDay')}
                className="rounded"
                style={{ borderColor: 'var(--color-border)' }}
              />
              Dia inteiro
            </label>

            {/* Local/Link */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Local / Link</label>
              </div>
              <input
                type="text"
                {...register('location')}
                placeholder="Endereço ou link da reunião"
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>

            {/* Convidados */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Convidados</label>
              </div>
              <input
                type="text"
                {...register('attendees')}
                placeholder="E-mails separados por vírgula"
                className="w-full px-3 py-2 rounded-lg focus-gold"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Descrição
              </label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Detalhes do evento..."
                className="w-full px-3 py-2 rounded-lg focus-gold resize-none"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>

            {/* Observações Internas */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Observações Internas
                </label>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>(apenas no app)</span>
              </div>
              <textarea
                {...register('internalNotes')}
                rows={3}
                placeholder="Anotações privadas sobre esta reunião..."
                className="w-full px-3 py-2 rounded-lg focus-gold resize-none"
                style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-80"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 className="w-4 h-4" />
                  Cancelar Evento
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 hover-light rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
                >
                  {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Evento'}
                </button>
              </div>
            </div>
          </form>

          {/* Confirmação de exclusão */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 rounded-xl flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="text-center">
                <Trash2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-danger)' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Cancelar este evento?</h3>
                <p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>Esta ação não pode ser desfeita.</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 hover-light rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-danger)', color: 'var(--color-text-inverse)' }}
                  >
                    {deleting ? 'Cancelando...' : 'Sim, Cancelar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
