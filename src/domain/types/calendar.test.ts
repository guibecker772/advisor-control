import { describe, it, expect } from 'vitest';
import { 
  detectMeetingType, 
  getEffectiveMeetingType, 
  calculateMetrics,
  calendarEventSchema,
  type CalendarEventInput 
} from './calendar';

// Helper para criar eventos de teste com todos os campos required
const createTestEvent = (input: CalendarEventInput) => {
  return calendarEventSchema.parse(input);
};

describe('detectMeetingType', () => {
  describe('R1 - Primeira Reunião', () => {
    it('deve detectar "R1" no título', () => {
      expect(detectMeetingType('R1 - João Silva')).toBe('R1');
      expect(detectMeetingType('Reunião R1 com cliente')).toBe('R1');
      expect(detectMeetingType('r1 prospect')).toBe('R1');
    });

    it('deve detectar "1ª reunião"', () => {
      expect(detectMeetingType('1ª Reunião - Maria')).toBe('R1');
      expect(detectMeetingType('1a reunião com prospect')).toBe('R1');
    });

    it('deve detectar "primeira reunião"', () => {
      expect(detectMeetingType('Primeira Reunião - Carlos')).toBe('R1');
      expect(detectMeetingType('primeira reuniao')).toBe('R1');
    });

    it('não deve detectar R1 em palavras como "AR1" ou "CR1"', () => {
      expect(detectMeetingType('AR1 - Reunião')).not.toBe('R1');
    });
  });

  describe('R2 - Segunda Reunião', () => {
    it('deve detectar "R2" no título', () => {
      expect(detectMeetingType('R2 - João Silva')).toBe('R2');
      expect(detectMeetingType('Reunião R2 com cliente')).toBe('R2');
      expect(detectMeetingType('r2 prospect')).toBe('R2');
    });

    it('deve detectar "2ª reunião"', () => {
      expect(detectMeetingType('2ª Reunião - Maria')).toBe('R2');
      expect(detectMeetingType('2a reunião com prospect')).toBe('R2');
    });

    it('deve detectar "segunda reunião"', () => {
      expect(detectMeetingType('Segunda Reunião - Carlos')).toBe('R2');
      expect(detectMeetingType('segunda reuniao')).toBe('R2');
    });
  });

  describe('Áreas Cross', () => {
    it('deve detectar "áreas cross"', () => {
      expect(detectMeetingType('Reunião Áreas Cross')).toBe('areas_cross');
      expect(detectMeetingType('áreas cross - seguros')).toBe('areas_cross');
    });

    it('deve detectar "area cross" (singular)', () => {
      expect(detectMeetingType('Área Cross - Previdência')).toBe('areas_cross');
      expect(detectMeetingType('area cross cambio')).toBe('areas_cross');
    });

    it('deve detectar "cross" isolado', () => {
      expect(detectMeetingType('Cross Selling - João')).toBe('areas_cross');
      expect(detectMeetingType('Reunião de Cross')).toBe('areas_cross');
    });

    it('não deve detectar "cross" dentro de outras palavras', () => {
      expect(detectMeetingType('Microsoft Word')).not.toBe('areas_cross');
    });
  });

  describe('Outro', () => {
    it('deve retornar "outro" para títulos genéricos', () => {
      expect(detectMeetingType('Reunião com cliente')).toBe('outro');
      expect(detectMeetingType('Call de acompanhamento')).toBe('outro');
      expect(detectMeetingType('Almoço de negócios')).toBe('outro');
    });
  });
});

describe('getEffectiveMeetingType', () => {
  it('deve usar tipo detectado quando não há override', () => {
    const event = createTestEvent({
      title: 'R1 - Prospect',
      start: '2025-01-01T10:00:00',
      end: '2025-01-01T11:00:00',
      meetingTypeOverride: false,
    });
    expect(getEffectiveMeetingType(event)).toBe('R1');
  });

  it('deve usar tipo manual quando há override', () => {
    const event = createTestEvent({
      title: 'Reunião genérica',
      start: '2025-01-01T10:00:00',
      end: '2025-01-01T11:00:00',
      meetingType: 'R2',
      meetingTypeOverride: true,
    });
    expect(getEffectiveMeetingType(event)).toBe('R2');
  });

  it('deve ignorar meetingType se override for false', () => {
    const event = createTestEvent({
      title: 'R1 - João',
      start: '2025-01-01T10:00:00',
      end: '2025-01-01T11:00:00',
      meetingType: 'R2', // Isso seria ignorado
      meetingTypeOverride: false,
    });
    expect(getEffectiveMeetingType(event)).toBe('R1');
  });
});

describe('calculateMetrics', () => {
  const baseEvent: CalendarEventInput = {
    title: '',
    start: '2025-01-15T10:00:00',
    end: '2025-01-15T11:00:00',
    status: 'confirmed',
  };

  const events = [
    createTestEvent({ ...baseEvent, title: 'R1 - Cliente 1' }),
    createTestEvent({ ...baseEvent, title: 'R1 - Cliente 2' }),
    createTestEvent({ ...baseEvent, title: 'R2 - Cliente 3' }),
    createTestEvent({ ...baseEvent, title: 'Área Cross - Seguros' }),
    createTestEvent({ ...baseEvent, title: 'Cross Previdência' }),
    createTestEvent({ ...baseEvent, title: 'Reunião qualquer' }),
    createTestEvent({ ...baseEvent, title: 'R1 - Cancelado', status: 'cancelled' }),
  ];

  it('deve contar corretamente R1, R2 e Áreas Cross', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const metrics = calculateMetrics(events, start, end, 'Janeiro 2025');

    expect(metrics.r1Count).toBe(2); // R1 Cliente 1, R1 Cliente 2 (não o cancelado)
    expect(metrics.r2Count).toBe(1); // R2 Cliente 3
    expect(metrics.areasCrossCount).toBe(2); // Área Cross Seguros, Cross Previdência
    expect(metrics.totalMeetings).toBe(6); // Todos menos o cancelado
  });

  it('não deve contar eventos cancelados', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const metrics = calculateMetrics(events, start, end, 'Test');

    // Temos 7 eventos, mas 1 está cancelado
    expect(metrics.totalMeetings).toBe(6);
  });

  it('deve filtrar por período corretamente', () => {
    const eventsMultiMonth = [
      createTestEvent({ ...baseEvent, title: 'R1 - Jan', start: '2025-01-15T10:00:00' }),
      createTestEvent({ ...baseEvent, title: 'R1 - Fev', start: '2025-02-15T10:00:00' }),
      createTestEvent({ ...baseEvent, title: 'R2 - Mar', start: '2025-03-15T10:00:00' }),
    ];

    // Apenas Janeiro
    const janMetrics = calculateMetrics(
      eventsMultiMonth,
      new Date('2025-01-01'),
      new Date('2025-01-31'),
      'Janeiro'
    );
    expect(janMetrics.r1Count).toBe(1);
    expect(janMetrics.totalMeetings).toBe(1);

    // Janeiro e Fevereiro
    const janFevMetrics = calculateMetrics(
      eventsMultiMonth,
      new Date('2025-01-01'),
      new Date('2025-02-28'),
      'Jan-Fev'
    );
    expect(janFevMetrics.r1Count).toBe(2);
    expect(janFevMetrics.totalMeetings).toBe(2);
  });

  it('deve retornar zeros para período sem eventos', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    const metrics = calculateMetrics(events, start, end, 'Janeiro 2024');

    expect(metrics.r1Count).toBe(0);
    expect(metrics.r2Count).toBe(0);
    expect(metrics.areasCrossCount).toBe(0);
    expect(metrics.totalMeetings).toBe(0);
  });

  it('deve incluir informações do período no resultado', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const metrics = calculateMetrics(events, start, end, 'Janeiro 2025');

    expect(metrics.period.label).toBe('Janeiro 2025');
    expect(metrics.period.start).toBe(start.toISOString());
    expect(metrics.period.end).toBe(end.toISOString());
  });
});
