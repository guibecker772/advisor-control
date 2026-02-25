import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type CollectionReference,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import type {
  CaptacaoLancamento,
  Cliente,
  ClienteReuniao,
  Cross,
  CustodiaReceita,
  MonthlyGoals,
  OfferReservation,
  PlanoReceitas,
  Prospect,
  ProspectInteracao,
  Reserva,
  Salario,
} from '../domain/types';
import type {
  CalendarAccount,
  CalendarEvent,
  EventReminder,
  Notification,
} from '../domain/types/calendar';
import { repairMojibakePayload } from '../lib/mojibake';

type RepositoryEntity = {
  id?: string;
  ownerUid?: string;
  createdAt?: string;
  updatedAt?: string;
  mes?: number;
  ano?: number;
  status?: string;
  clienteId?: string;
  [key: string]: unknown;
};

type DataDriver = 'local' | 'firestore';

const runtimeEnv = import.meta.env;
const requestedDriver = (runtimeEnv.VITE_DATA_DRIVER ?? '').toString().trim().toLowerCase();

function resolveDataDriver(): DataDriver {
  if (requestedDriver === 'local' || requestedDriver === 'firestore') {
    return requestedDriver;
  }

  return runtimeEnv.MODE === 'test' ? 'local' : 'firestore';
}

export const activeDataDriver: DataDriver = resolveDataDriver();
export const isLocalDataDriver = activeDataDriver === 'local';
export const isFirestoreDataDriver = activeDataDriver === 'firestore';

const inMemoryStorage = new Map<string, string>();

function getStorageApi(): Pick<Storage, 'getItem' | 'setItem'> {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }

  return {
    getItem(key: string) {
      return inMemoryStorage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      inMemoryStorage.set(key, value);
    },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByUpdatedAtDesc<T extends RepositoryEntity>(data: T[]): T[] {
  return [...data].sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt));
}

function sortByMesAsc<T extends RepositoryEntity>(data: T[]): T[] {
  return [...data].sort((a, b) => (a.mes || 0) - (b.mes || 0));
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([entryKey, entryValue]) => [entryKey, stripUndefined(entryValue)]);
    return Object.fromEntries(entries);
  }

  return value;
}

function toTypedEntity<T extends RepositoryEntity>(data: DocumentData, id: string, ownerUid: string): T {
  return {
    ...(data as Record<string, unknown>),
    id,
    ownerUid,
  } as T;
}

let firestorePromise: Promise<Firestore> | null = null;

async function getFirestoreDb(): Promise<Firestore> {
  if (isLocalDataDriver) {
    throw new Error('[repositories] Firestore driver nao esta ativo.');
  }

  if (!firestorePromise) {
    firestorePromise = import('./firebase').then((module) => {
      if (!module.db) {
        throw new Error(module.firebaseInit.message || 'Firestore nao inicializado.');
      }
      return module.db;
    });
  }

  return firestorePromise;
}

async function getCollectionRef(
  ownerUid: string,
  collectionName: string,
): Promise<CollectionReference<DocumentData>> {
  const database = await getFirestoreDb();
  return collection(database, 'users', ownerUid, collectionName);
}

function getStorageKey(collectionName: string, ownerUid: string): string {
  return `metas_${collectionName}_${ownerUid}`;
}

function loadLocalData<T extends RepositoryEntity>(collectionName: string, ownerUid: string): T[] {
  const storage = getStorageApi();
  const raw = storage.getItem(getStorageKey(collectionName, ownerUid));
  const parsed = raw ? (JSON.parse(raw) as T[]) : [];
  const repaired = repairMojibakePayload(parsed);

  if (repaired.changed) {
    saveLocalData(collectionName, ownerUid, repaired.value);
  }

  return repaired.value;
}

function saveLocalData<T extends RepositoryEntity>(collectionName: string, ownerUid: string, data: T[]): void {
  const storage = getStorageApi();
  storage.setItem(getStorageKey(collectionName, ownerUid), JSON.stringify(data));
}

async function getAllFirestore<T extends RepositoryEntity>(collectionName: string, ownerUid: string): Promise<T[]> {
  const ref = await getCollectionRef(ownerUid, collectionName);
  const snapshot = await getDocs(ref);
  const items = snapshot.docs.map((docSnapshot) => toTypedEntity<T>(docSnapshot.data(), docSnapshot.id, ownerUid));
  return sortByUpdatedAtDesc(items);
}

async function getByIdFirestore<T extends RepositoryEntity>(
  collectionName: string,
  id: string,
  ownerUid: string,
): Promise<T | null> {
  const ref = await getCollectionRef(ownerUid, collectionName);
  const documentRef = doc(ref, id);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    return null;
  }

  return toTypedEntity<T>(snapshot.data(), snapshot.id, ownerUid);
}

async function createFirestore<T extends RepositoryEntity>(
  collectionName: string,
  inputData: Omit<T, 'id'>,
  ownerUid: string,
): Promise<T> {
  const ref = await getCollectionRef(ownerUid, collectionName);
  const documentRef = doc(ref);
  const now = nowIso();
  const newItem = {
    ...(inputData as Record<string, unknown>),
    id: documentRef.id,
    ownerUid,
    createdAt: now,
    updatedAt: now,
  } as T;

  await setDoc(documentRef, stripUndefined(newItem) as DocumentData);
  return newItem;
}

async function updateFirestore<T extends RepositoryEntity>(
  collectionName: string,
  id: string,
  updateData: Partial<T>,
  ownerUid: string,
): Promise<T | null> {
  const ref = await getCollectionRef(ownerUid, collectionName);
  const documentRef = doc(ref, id);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    return null;
  }

  const existingData = snapshot.data() as Record<string, unknown>;
  const now = nowIso();
  const updatedItem = {
    ...existingData,
    ...(updateData as Record<string, unknown>),
    id,
    ownerUid,
    createdAt: (existingData.createdAt as string | undefined) || now,
    updatedAt: now,
  } as T;

  await setDoc(documentRef, stripUndefined(updatedItem) as DocumentData, { merge: true });
  return updatedItem;
}

async function deleteFirestore(collectionName: string, id: string, ownerUid: string): Promise<boolean> {
  const ref = await getCollectionRef(ownerUid, collectionName);
  const documentRef = doc(ref, id);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    return false;
  }

  await deleteDoc(documentRef);
  return true;
}

async function queryBySingleFieldFirestore<T extends RepositoryEntity>(
  collectionName: string,
  ownerUid: string,
  field: 'ano' | 'mes' | 'status' | 'clienteId',
  value: number | string,
): Promise<T[]> {
  const ref = await getCollectionRef(ownerUid, collectionName);

  try {
    const snapshot = await getDocs(query(ref, where(field, '==', value)));
    const items = snapshot.docs.map((docSnapshot) => toTypedEntity<T>(docSnapshot.data(), docSnapshot.id, ownerUid));
    return sortByUpdatedAtDesc(items);
  } catch (error) {
    console.warn(`[repositories] Firestore query fallback (${collectionName}.${field}):`, error);
    const all = await getAllFirestore<T>(collectionName, ownerUid);
    return all.filter((item) => (item[field] as number | string | undefined) === value);
  }
}

async function getByMonthFirestore<T extends RepositoryEntity>(
  collectionName: string,
  ownerUid: string,
  mes: number,
  ano: number,
): Promise<T[]> {
  const ref = await getCollectionRef(ownerUid, collectionName);

  try {
    // This query may require a composite index on (mes, ano) depending on Firestore settings.
    const snapshot = await getDocs(query(ref, where('mes', '==', mes), where('ano', '==', ano)));
    const items = snapshot.docs.map((docSnapshot) => toTypedEntity<T>(docSnapshot.data(), docSnapshot.id, ownerUid));
    return sortByUpdatedAtDesc(items);
  } catch (error) {
    console.warn(`[repositories] Firestore month query fallback (${collectionName}):`, error);
    const byYear = await queryBySingleFieldFirestore<T>(collectionName, ownerUid, 'ano', ano);
    return byYear.filter((item) => item.mes === mes);
  }
}

async function getByYearFirestore<T extends RepositoryEntity>(
  collectionName: string,
  ownerUid: string,
  ano: number,
): Promise<T[]> {
  const byYear = await queryBySingleFieldFirestore<T>(collectionName, ownerUid, 'ano', ano);
  return sortByMesAsc(byYear);
}

export function createRepository<
  T extends {
    id?: string;
    ownerUid?: string;
    mes?: number;
    ano?: number;
    status?: string;
    clienteId?: string;
  },
>(collectionName: string) {
  return {
    async getAll(ownerUid: string): Promise<T[]> {
      if (isLocalDataDriver) {
        return loadLocalData<T>(collectionName, ownerUid);
      }

      return getAllFirestore<T>(collectionName, ownerUid);
    },

    async getById(id: string, ownerUid: string): Promise<T | null> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        return data.find((item) => item.id === id) || null;
      }

      return getByIdFirestore<T>(collectionName, id, ownerUid);
    },

    async create(inputData: Omit<T, 'id'>, ownerUid: string): Promise<T> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        const now = nowIso();
        const newItem = {
          ...(inputData as Record<string, unknown>),
          id: generateId(),
          ownerUid,
          createdAt: now,
          updatedAt: now,
        } as unknown as T;

        data.push(newItem);
        saveLocalData(collectionName, ownerUid, data);
        return newItem;
      }

      return createFirestore<T>(collectionName, inputData, ownerUid);
    },

    async update(id: string, updateData: Partial<T>, ownerUid: string): Promise<T | null> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        const index = data.findIndex((item) => item.id === id);
        if (index === -1) return null;

        const updated = {
          ...(data[index] as Record<string, unknown>),
          ...(updateData as Record<string, unknown>),
          updatedAt: nowIso(),
        } as unknown as T;

        data[index] = updated;
        saveLocalData(collectionName, ownerUid, data);
        return updated;
      }

      return updateFirestore<T>(collectionName, id, updateData, ownerUid);
    },

    async delete(id: string, ownerUid: string): Promise<boolean> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        const index = data.findIndex((item) => item.id === id);
        if (index === -1) return false;

        data.splice(index, 1);
        saveLocalData(collectionName, ownerUid, data);
        return true;
      }

      return deleteFirestore(collectionName, id, ownerUid);
    },

    async getByMonth(ownerUid: string, mes: number, ano: number): Promise<T[]> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        return data.filter((item) => item.mes === mes && item.ano === ano);
      }

      return getByMonthFirestore<T>(collectionName, ownerUid, mes, ano);
    },

    async getByYear(ownerUid: string, ano: number): Promise<T[]> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        return data
          .filter((item) => item.ano === ano)
          .sort((a, b) => (a.mes || 0) - (b.mes || 0));
      }

      return getByYearFirestore<T>(collectionName, ownerUid, ano);
    },

    async getByStatus(ownerUid: string, status: string): Promise<T[]> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        return data.filter((item) => item.status === status);
      }

      return queryBySingleFieldFirestore<T>(collectionName, ownerUid, 'status', status);
    },

    async getByCliente(ownerUid: string, clienteId: string): Promise<T[]> {
      if (isLocalDataDriver) {
        const data = loadLocalData<T>(collectionName, ownerUid);
        return data.filter((item) => item.clienteId === clienteId);
      }

      return queryBySingleFieldFirestore<T>(collectionName, ownerUid, 'clienteId', clienteId);
    },
  };
}

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

export const calendarEventRepository = createRepository<CalendarEvent>('calendar_events');
export const calendarAccountRepository = createRepository<CalendarAccount>('calendar_accounts');
export const notificationRepository = createRepository<Notification>('notifications');
export const eventReminderRepository = createRepository<EventReminder>('event_reminders');
