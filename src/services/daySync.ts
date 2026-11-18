import {
  deleteField,
  doc,
  Firestore,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { calculateCompletionPercentage } from '../constants/templates';
import { CURRENT_DAY_SCHEMA_VERSION, DayRecord } from '../types';
import { normalizeDayRecord, withCurrentSchemaVersion } from '../utils/dayRecord';
import {
  areDayValuesEqual,
  DayMutation,
  DayMutationConflict,
  DayOutboxStore,
  DayRecordPatch,
  DAY_RECORD_MUTABLE_FIELDS,
  createDayMutation,
  createDayMutationId,
} from './dayOutbox';

export interface DayMutationApplyResult {
  record: DayRecord;
  serverRevision: number;
  appliedFields: Array<keyof DayRecordPatch>;
  conflicts: DayMutationConflict[];
}

export class RemoteDayDeletedError extends Error {
  code = 'remote-day-deleted';

  constructor() {
    super('This day existed in the cloud but has since been deleted.');
    this.name = 'RemoteDayDeletedError';
  }
}

export function createDayCacheRecovery(uid: string, cachedRecord: DayRecord): DayMutation {
  const patch: DayRecordPatch = {};
  DAY_RECORD_MUTABLE_FIELDS.forEach((field) => {
    Object.assign(patch, { [field]: cachedRecord[field] });
  });
  const operation = createDayMutation(uid, cachedRecord, patch);
  operation.status = 'recovery';
  operation.baseKnownOnCloud = undefined;
  operation.lastError = 'ambiguous-local-cache';
  return operation;
}

export function getRecoverableCacheOnlyDays(
  cachedDays: Record<string, DayRecord>,
  cloudDays: Record<string, DayRecord>,
  queuedDates: ReadonlySet<string>
): Array<{ date: string; record: DayRecord }> {
  return Object.entries(cachedDays)
    .filter(([date]) => !cloudDays[date] && !queuedDates.has(date))
    .map(([date, record]) => ({ date, record }));
}

export async function applyDayMutationTransaction(
  database: Firestore,
  operation: DayMutation
): Promise<DayMutationApplyResult> {
  const recordRef = doc(database, 'users', operation.uid, 'days', operation.date);
  const syncStateRef = doc(database, 'users', operation.uid, 'daySyncState', operation.date);

  return runTransaction(database, async (transaction) => {
    const [snapshot, syncStateSnapshot] = await Promise.all([
      transaction.get(recordRef),
      transaction.get(syncStateRef),
    ]);
    if (!snapshot.exists() && operation.baseKnownOnCloud !== false) {
      throw new RemoteDayDeletedError();
    }
    const currentRecord = snapshot.exists()
      ? normalizeDayRecord(snapshot.data() as DayRecord)
      : operation.baseRecord;
    const storedRevision = currentRecord.syncRevision;
    if (
      snapshot.exists()
      && storedRevision !== undefined
      && (typeof storedRevision !== 'number' || !Number.isInteger(storedRevision) || storedRevision < 0)
    ) {
      throw new Error('The saved day revision is invalid and cannot be synchronized safely.');
    }
    const recordRevision = snapshot.exists() && typeof storedRevision === 'number' ? storedRevision : 0;
    const stateRevisionValue: unknown = syncStateSnapshot.exists()
      ? syncStateSnapshot.data().revision
      : undefined;
    if (
      syncStateSnapshot.exists()
      && (typeof stateRevisionValue !== 'number' || !Number.isInteger(stateRevisionValue) || stateRevisionValue < 0)
    ) {
      throw new Error('The saved day synchronization metadata is invalid and cannot be synchronized safely.');
    }
    const stateRevision = typeof stateRevisionValue === 'number' ? stateRevisionValue : 0;
    const serverRevision = Math.max(recordRevision, stateRevision);
    const appliedFields: Array<keyof DayRecordPatch> = [];
    const conflicts: DayMutationConflict[] = [];
    const nextRecord = { ...currentRecord };

    (Object.keys(operation.patch) as Array<keyof DayRecordPatch>).forEach((field) => {
      const localValue = operation.patch[field];
      const remoteValue = currentRecord[field];
      const baseValue = operation.baseValues[field];
      if (areDayValuesEqual(remoteValue, localValue)) {
        appliedFields.push(field);
      } else if (areDayValuesEqual(remoteValue, baseValue)) {
        Object.assign(nextRecord, { [field]: localValue });
        appliedFields.push(field);
      } else {
        conflicts.push({ field, baseValue, localValue, remoteValue });
      }
    });

    const newFields = appliedFields.filter((field) => (
      !areDayValuesEqual(currentRecord[field], operation.patch[field])
    ));

    if (newFields.length > 0 || !snapshot.exists()) {
      const revision = serverRevision + 1;
      const updatedRecord = withCurrentSchemaVersion({
        ...nextRecord,
        completionPercentage: calculateCompletionPercentage(nextRecord),
        syncRevision: revision,
        updatedAt: new Date().toISOString(),
      });
      const metadata = {
        completionPercentage: updatedRecord.completionPercentage,
        schemaVersion: CURRENT_DAY_SCHEMA_VERSION,
        syncRevision: revision,
        updatedAt: updatedRecord.updatedAt,
        lastSyncedAt: serverTimestamp(),
      };
      const syncState = {
        revision,
        committedAt: serverTimestamp(),
      };

      if (snapshot.exists()) {
        const updates: Record<string, unknown> = { ...metadata };
        newFields.forEach((field) => {
          updates[field] = operation.patch[field] === undefined
            ? deleteField()
            : operation.patch[field];
        });
        transaction.update(recordRef, updates);
      } else {
        const createdRecord: Record<string, unknown> = {
          ...operation.baseRecord,
          ...operation.patch,
          ...metadata,
        };
        Object.keys(createdRecord).forEach((key) => {
          if (createdRecord[key] === undefined) delete createdRecord[key];
        });
        transaction.set(recordRef, createdRecord);
      }
      if (syncStateSnapshot.exists()) {
        transaction.update(syncStateRef, syncState);
      } else {
        transaction.set(syncStateRef, syncState);
      }

      return {
        record: updatedRecord,
        serverRevision: revision,
        appliedFields,
        conflicts,
      };
    }

    return {
      record: currentRecord,
      serverRevision,
      appliedFields,
      conflicts,
    };
  });
}

export function reconcileDayRecordWithMutations(
  serverRecord: DayRecord,
  operations: DayMutation[]
): DayRecord {
  const record = operations
    .filter((operation) => operation.date === serverRecord.date)
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .reduce<DayRecord>((current, operation) => ({ ...current, ...operation.patch }), serverRecord);
  return {
    ...record,
    completionPercentage: calculateCompletionPercentage(record),
  };
}

export interface DayOutboxProcessDependencies {
  store: DayOutboxStore;
  apply: (operation: DayMutation) => Promise<DayMutationApplyResult>;
  isActive: () => boolean;
  onApplied?: (operation: DayMutation, result: DayMutationApplyResult) => void;
  now?: () => number;
  random?: () => number;
}

const RETRYABLE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'network-request-failed',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code.split('/').pop() || code;
  }
  return 'invalid-data';
}

function retryDelay(attempts: number, random: () => number): number {
  const capped = Math.min(5 * 60 * 1000, 1000 * (2 ** Math.min(attempts, 18)));
  return Math.round(capped * (0.8 + random() * 0.4));
}

export async function processDayOutbox(
  uid: string,
  dependencies: DayOutboxProcessDependencies
): Promise<void> {
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const owner = createDayMutationId();
  const operations = await dependencies.store.list(uid);

  for (const operation of operations) {
    if (!dependencies.isActive()) return;
    if (
      operation.uid !== uid
      || operation.status === 'conflict'
      || operation.status === 'recovery'
      || operation.status === 'failed'
    ) continue;
    if (operation.nextAttemptAt > now()) continue;

    const claimedOperation = await dependencies.store.claim(operation.id, owner, now(), 60_000);
    if (!claimedOperation) continue;

    try {
      const result = await dependencies.apply(claimedOperation);
      if (!dependencies.isActive()) return;
      dependencies.onApplied?.(claimedOperation, result);

      if (result.conflicts.length > 0) {
        const conflictPatch: DayRecordPatch = {};
        const baseValues = { ...claimedOperation.baseValues };
        result.conflicts.forEach((conflict) => {
          Object.assign(conflictPatch, { [conflict.field]: conflict.localValue });
          Object.assign(baseValues, { [conflict.field]: conflict.remoteValue });
        });
        await dependencies.store.updateClaim(claimedOperation.id, owner, {
          patch: conflictPatch,
          baseValues,
          baseRevision: result.serverRevision,
          status: 'conflict',
          conflicts: result.conflicts,
          conflictRecord: result.record,
          lastError: 'conflict',
          lockOwner: undefined,
          lockExpiresAt: undefined,
          nextAttemptAt: 0,
        });
      } else {
        await dependencies.store.removeClaim(claimedOperation.id, owner);
      }
    } catch (error) {
      if (!dependencies.isActive()) return;
      if (error instanceof RemoteDayDeletedError) {
        await dependencies.store.updateClaim(claimedOperation.id, owner, {
          status: 'recovery',
          remoteDeleted: true,
          lastError: 'remote-day-deleted',
          lockOwner: undefined,
          lockExpiresAt: undefined,
          nextAttemptAt: 0,
        });
        continue;
      }
      const attempts = claimedOperation.attempts + 1;
      const code = getErrorCode(error);
      const retryable = RETRYABLE_ERROR_CODES.has(code);
      await dependencies.store.updateClaim(claimedOperation.id, owner, {
        attempts,
        nextAttemptAt: retryable ? now() + retryDelay(attempts, random) : 0,
        status: retryable ? 'pending' : 'failed',
        lastError: code,
        lockOwner: undefined,
        lockExpiresAt: undefined,
      });
    }
  }
}

export async function resolveDayMutationRecovery(
  store: DayOutboxStore,
  operation: DayMutation,
  choice: 'local' | 'remote',
  now = Date.now()
): Promise<void> {
  if (operation.status !== 'recovery') {
    throw new Error('Only a day change awaiting recovery can be resolved.');
  }
  if (choice === 'remote') {
    await store.remove(operation.id);
    return;
  }
  await store.update(operation.id, {
    status: 'pending',
    baseKnownOnCloud: false,
    remoteDeleted: undefined,
    lastError: undefined,
    attempts: 0,
    nextAttemptAt: now,
    lockOwner: undefined,
    lockExpiresAt: undefined,
  });
}

export async function resolveDayMutationConflict(
  store: DayOutboxStore,
  operation: DayMutation,
  choice: 'local' | 'remote',
  latestCloudRecord: DayRecord | null,
  now = Date.now()
): Promise<void> {
  if (operation.status !== 'conflict') {
    throw new Error('Only a conflicted day change can be resolved.');
  }
  if (choice === 'remote') {
    await store.remove(operation.id);
    return;
  }

  if (!latestCloudRecord) {
    throw new Error('The latest cloud day is required to safely keep local edits.');
  }
  const baseValues = { ...operation.baseValues };
  (Object.keys(operation.patch) as Array<keyof DayRecordPatch>).forEach((field) => {
    Object.assign(baseValues, { [field]: latestCloudRecord[field] });
  });
  await store.update(operation.id, {
    status: 'pending',
    conflicts: undefined,
    baseRecord: latestCloudRecord,
    baseValues,
    baseRevision: latestCloudRecord.syncRevision ?? 0,
    baseKnownOnCloud: true,
    lastError: undefined,
    attempts: 0,
    nextAttemptAt: now,
    conflictRecord: undefined,
    remoteDeleted: undefined,
  });
}
