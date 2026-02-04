// ============================================
// MODO DE TESTE - Firestore desativado
// Usando localStorage para persistência local
// ============================================

import type { 
  Cliente, 
  ClienteReuniao,
  Prospect,
  ProspectInteracao,
  Cross, 
  Reserva, 
  OfferReservation,
  CustodiaReceita, 
  PlanoReceitas, 
  Salario,
  CaptacaoLancamento,
  MonthlyGoals 
} from '../domain/types';
import type {
  CalendarEvent,
  CalendarAccount,
  Notification,
  EventReminder,
} from '../domain/types/calendar';

// Gerar ID único
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Factory para criar repositório genérico com localStorage
export function createRepository<T extends { id?: string; ownerUid?: string; mes?: number; ano?: number; status?: string; clienteId?: string }>(
  collectionName: string
) {
  const getStorageKey = (ownerUid: string) => `metas_${collectionName}_${ownerUid}`;

  const loadData = (ownerUid: string): T[] => {
    const key = getStorageKey(ownerUid);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  };

  const saveData = (ownerUid: string, data: T[]) => {
    const key = getStorageKey(ownerUid);
    localStorage.setItem(key, JSON.stringify(data));
  };

  return {
    async getAll(ownerUid: string): Promise<T[]> {
      return loadData(ownerUid);
    },

    async getById(id: string, ownerUid: string): Promise<T | null> {
      const data = loadData(ownerUid);
      return data.find(item => item.id === id) || null;
    },

    async create(inputData: Omit<T, 'id'>, ownerUid: string): Promise<T> {
      const data = loadData(ownerUid);
      const now = new Date().toISOString();
      const newItem = {
        ...inputData,
        id: generateId(),
        ownerUid,
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      
      data.push(newItem);
      saveData(ownerUid, data);
      console.log(`✅ Criado em ${collectionName}:`, newItem);
      return newItem;
    },

    async update(id: string, updateData: Partial<T>, ownerUid: string): Promise<T | null> {
      const data = loadData(ownerUid);
      const index = data.findIndex(item => item.id === id);
      if (index === -1) return null;
      
      const updated = {
        ...data[index],
        ...updateData,
        updatedAt: new Date().toISOString(),
      } as T;
      
      data[index] = updated;
      saveData(ownerUid, data);
      console.log(`✅ Atualizado em ${collectionName}:`, updated);
      return updated;
    },

    async delete(id: string, ownerUid: string): Promise<boolean> {
      const data = loadData(ownerUid);
      const index = data.findIndex(item => item.id === id);
      if (index === -1) return false;
      
      data.splice(index, 1);
      saveData(ownerUid, data);
      console.log(`✅ Excluído de ${collectionName}: ${id}`);
      return true;
    },

    // Queries específicas
    async getByMonth(ownerUid: string, mes: number, ano: number): Promise<T[]> {
      const data = loadData(ownerUid);
      return data.filter(item => item.mes === mes && item.ano === ano);
    },

    async getByYear(ownerUid: string, ano: number): Promise<T[]> {
      const data = loadData(ownerUid);
      return data.filter(item => item.ano === ano).sort((a, b) => (a.mes || 0) - (b.mes || 0));
    },

    async getByStatus(ownerUid: string, status: string): Promise<T[]> {
      const data = loadData(ownerUid);
      return data.filter(item => item.status === status);
    },

    async getByCliente(ownerUid: string, clienteId: string): Promise<T[]> {
      const data = loadData(ownerUid);
      return data.filter(item => item.clienteId === clienteId);
    },
  };
}

// Exporta repositórios específicos
export const clienteRepository = createRepository<Cliente>('clientes');
export const clienteReuniaoRepository = createRepository<ClienteReuniao>('cliente_reunioes');
export const prospectRepository = createRepository<Prospect>('prospects');
export const prospectInteracaoRepository = createRepository<ProspectInteracao>('prospect_interacoes');
export const crossRepository = createRepository<Cross>('cross');
export const reservaRepository = createRepository<Reserva>('reservas');
export const offerReservationRepository = createRepository<OfferReservation>('offer_reservations');
export const custodiaReceitaRepository = createRepository<CustodiaReceita>('custodia_receita');
export const planoReceitasRepository = createRepository<PlanoReceitas>('plano_receitas');
export const salarioRepository = createRepository<Salario>('salarios');
export const captacaoLancamentoRepository = createRepository<CaptacaoLancamento>('captacoes');
export const monthlyGoalsRepository = createRepository<MonthlyGoals>('monthly_goals');

// ============== REPOSITORIES PARA AGENDAS ==============
export const calendarEventRepository = createRepository<CalendarEvent>('calendar_events');
export const calendarAccountRepository = createRepository<CalendarAccount>('calendar_accounts');
export const notificationRepository = createRepository<Notification>('notifications');
export const eventReminderRepository = createRepository<EventReminder>('event_reminders');
