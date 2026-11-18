import { DayRecord } from '../types';

export type DayRecordPatch = Partial<Omit<
  DayRecord,
  'date' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'syncRevision' | 'completionPercentage'
>>;

export type DayMutationStatus = 'pending' | 'syncing' | 'conflict' | 'recovery' | 'failed';

export interface DayMutationConflict {
  field: keyof DayRecordPatch;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
}

export interface DayMutation {
  id: string;
  uid: string;
  date: string;
  patch: DayRecordPatch;
  baseValues: Partial<DayRecord>;
  baseRecord: DayRecord;
  baseRevision: number;
  baseKnownOnCloud?: boolean;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: DayMutationStatus;
  lastAttemptAt?: number;
  lastError?: string;
  conflicts?: DayMutationConflict[];
  conflictRecord?: DayRecord;
  remoteDeleted?: boolean;
  lockOwner?: string;
  lockExpiresAt?: number;
}

export interface DayOutboxStore {
  enqueue(operation: DayMutation): Promise<void>;
  enqueueMany(operations: DayMutation[]): Promise<void>;
  list(uid: string): Promise<DayMutation[]>;
  update(id: string, updates: Partial<DayMutation>): Promise<DayMutation>;
  claim(id: string, owner: string, now: number, leaseMs: number): Promise<DayMutation | null>;
  updateClaim(id: string, owner: string, updates: Partial<DayMutation>): Promise<DayMutation | null>;
  removeClaim(id: string, owner: string): Promise<boolean>;
  remove(id: string): Promise<void>;
  removeForUid(uid: string): Promise<void>;
}

export const DAY_RECORD_MUTABLE_FIELDS: readonly (keyof DayRecordPatch)[] = [
  'dayOfWeek',
  'notes',
  'mood',
  'energy',
  'sleep',
  'dailyReflection',
  'tomorrowFirstAction',
  'schedule',
  'habits',
  'academics',
  'dsa',
  'workout',
  'project',
  'skills',
  'dayStart',
  'outcomes',
  'focusSessions',
  'recoveryDecisions',
  'behavioralReview',
  'tomorrowHandoff',
  'creditEvents',
  'customTrackerValues',
];

const DATABASE_NAME = 'daily-os-day-outbox';
const DATABASE_VERSION = 2;
const STORE_NAME = 'dayMutations';
const CROSS_TAB_EVENT_KEY = 'daily-os-day-outbox-event';
const listeners = new Set<(uid: string) => void>();
let databasePromise: Promise<IDBDatabase> | null = null;
let crossTabNotificationsInitialized = false;
let broadcastChannel: BroadcastChannel | null = null;
let notificationSequence = 0;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable; the day change could not be stored safely.'));
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (store && !store.indexNames.contains('uid')) {
        store.createIndex('uid', 'uid', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('Could not open the day outbox.'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('The day outbox is blocked by another browser tab.'));
    };
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

function notifyLocalListeners(uid: string): void {
  listeners.forEach((listener) => {
    try {
      listener(uid);
    } catch (error) {
      console.error('A day outbox change listener failed.', error);
    }
  });
}

function initializeCrossTabNotifications(): void {
  if (crossTabNotificationsInitialized || typeof window === 'undefined') return;
  crossTabNotificationsInitialized = true;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('daily-os-day-outbox');
      broadcastChannel.onmessage = (event: MessageEvent<{ uid?: unknown }>) => {
        if (typeof event.data?.uid === 'string') notifyLocalListeners(event.data.uid);
      };
      return;
    } catch (error) {
      console.warn('BroadcastChannel is unavailable; using storage events for outbox notifications.', error);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== CROSS_TAB_EVENT_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as { uid?: unknown };
      if (typeof message.uid === 'string') notifyLocalListeners(message.uid);
    } catch (error) {
      console.warn('An outbox cross-tab notification could not be read.', error);
    }
  });
}

function notify(uid: string): void {
  notifyLocalListeners(uid);
  initializeCrossTabNotifications();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ uid });
    } catch (error) {
      console.warn('Outbox changes could not be broadcast to other tabs.', error);
    }
  } else if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CROSS_TAB_EVENT_KEY, JSON.stringify({
        uid,
        nonce: `${Date.now()}-${++notificationSequence}`,
      }));
    } catch (error) {
      console.warn('Outbox changes could not be broadcast to other tabs.', error);
    }
  }
}

function createTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let result: T;
    let request: IDBRequest<T>;

    try {
      request = action(transaction.objectStore(STORE_NAME));
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error ?? new Error('The day outbox request failed.'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error('The day outbox transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('The day outbox transaction was aborted.'));
  }));
}

export function createDayMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('A secure random source is unavailable; the day change could not be queued.');
}

export function areDayValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areDayValuesEqual(value, right[index]));
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]
      && areDayValuesEqual(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key]
      ));
}

export function diffDayRecord(base: DayRecord, updated: DayRecord): DayRecordPatch {
  const patch: Partial<Record<keyof DayRecordPatch, unknown>> = {};
  DAY_RECORD_MUTABLE_FIELDS.forEach((field) => {
    if (!areDayValuesEqual(base[field], updated[field])) patch[field] = updated[field];
  });
  return patch as DayRecordPatch;
}

export function createDayMutation(
  uid: string,
  baseRecord: DayRecord,
  patch: DayRecordPatch,
  createdAt = Date.now()
): DayMutation {
  const baseValues: Partial<DayRecord> = {};
  (Object.keys(patch) as Array<keyof DayRecordPatch>).forEach((field) => {
    Object.assign(baseValues, { [field]: baseRecord[field] });
  });
  return {
    id: createDayMutationId(),
    uid,
    date: baseRecord.date,
    patch,
    baseValues,
    baseRecord,
    baseRevision: baseRecord.syncRevision ?? 0,
    baseKnownOnCloud: typeof baseRecord.syncRevision === 'number',
    createdAt,
    attempts: 0,
    nextAttemptAt: createdAt,
    status: 'pending',
  };
}

export const indexedDbDayOutbox: DayOutboxStore = {
  async enqueue(operation) {
    await indexedDbDayOutbox.enqueueMany([operation]);
  },

  async enqueueMany(operations) {
    if (operations.length === 0) return;
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      try {
        operations.forEach((operation) => store.add(operation));
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not enqueue the day changes.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The day changes could not be queued atomically.'));
    });
    new Set(operations.map((operation) => operation.uid)).forEach(notify);
  },

  async list(uid) {
    const operations = await createTransaction('readonly', (store) => store.index('uid').getAll(uid));
    return operations.sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  },

  async update(id, updates) {
    const database = await openDatabase();
    const result = await new Promise<DayMutation>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let updated: DayMutation | undefined;
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as DayMutation | undefined;
        if (!current) {
          transaction.abort();
          reject(new Error('The queued day change no longer exists.'));
          return;
        }
        updated = { ...current, ...updates };
        store.put(updated);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read the queued day change.'));
      transaction.oncomplete = () => {
        if (updated) resolve(updated);
        else reject(new Error('The queued day change was not updated.'));
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not update the queued day change.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The queued day change update was aborted.'));
    });
    notify(result.uid);
    return result;
  },

  async claim(id, owner, now, leaseMs) {
    const database = await openDatabase();
    const result = await new Promise<DayMutation | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let claimed: DayMutation | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as DayMutation | undefined;
        if (
          !current
          || current.status === 'conflict'
          || current.status === 'recovery'
          || current.status === 'failed'
          || current.nextAttemptAt > now
          || (current.status === 'syncing' && (current.lockExpiresAt ?? 0) > now && current.lockOwner !== owner)
        ) return;
        claimed = {
          ...current,
          status: 'syncing',
          lastAttemptAt: now,
          nextAttemptAt: now + leaseMs,
          lockOwner: owner,
          lockExpiresAt: now + leaseMs,
          lastError: undefined,
        };
        store.put(claimed);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not claim the queued day change.'));
      transaction.oncomplete = () => {
        if (claimed) notify(claimed.uid);
        resolve(claimed);
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not claim the queued day change.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The day change claim was aborted.'));
    });
    return result;
  },

  async updateClaim(id, owner, updates) {
    const database = await openDatabase();
    return new Promise<DayMutation | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let updated: DayMutation | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as DayMutation | undefined;
        if (!current || current.status !== 'syncing' || current.lockOwner !== owner) return;
        updated = { ...current, ...updates };
        store.put(updated);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not update the claimed day change.'));
      transaction.oncomplete = () => {
        if (updated) notify(updated.uid);
        resolve(updated);
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not update the claimed day change.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The claimed day change update was aborted.'));
    });
  },

  async removeClaim(id, owner) {
    const database = await openDatabase();
    return new Promise<boolean>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let removed = false;
      let uid: string | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as DayMutation | undefined;
        if (!current || current.status !== 'syncing' || current.lockOwner !== owner) return;
        uid = current.uid;
        removed = true;
        store.delete(id);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not acknowledge the claimed day change.'));
      transaction.oncomplete = () => {
        if (uid) notify(uid);
        resolve(removed);
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not acknowledge the claimed day change.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The claimed day change acknowledgment was aborted.'));
    });
  },

  async remove(id) {
    const database = await openDatabase();
    const uid = await new Promise<string | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let operationUid: string | null = null;
      const request = store.get(id);
      request.onsuccess = () => {
        const operation = request.result as DayMutation | undefined;
        if (operation) {
          operationUid = operation.uid;
          store.delete(id);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read the queued day change.'));
      transaction.oncomplete = () => resolve(operationUid);
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the queued day change.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The day outbox removal was aborted.'));
    });
    if (uid) notify(uid);
  },

  async removeForUid(uid) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).index('uid').openCursor(uid);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Could not enumerate the user day outbox.'));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear the user day outbox.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The user day outbox clear was aborted.'));
    });
    notify(uid);
  },
};

export function subscribeToDayOutbox(listener: (uid: string) => void): () => void {
  initializeCrossTabNotifications();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function closeDayOutboxDatabase(): Promise<void> {
  const database = await databasePromise;
  database?.close();
  databasePromise = null;
}
