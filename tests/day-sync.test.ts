import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, createDefaultDayRecord } from '../src/constants/templates';
import {
  closeDayOutboxDatabase,
  createDayMutation,
  diffDayRecord,
  indexedDbDayOutbox,
} from '../src/services/dayOutbox';
import {
  DayMutationApplyResult,
  processDayOutbox,
  reconcileDayRecordWithMutations,
  RemoteDayDeletedError,
  createDayCacheRecovery,
  getRecoverableCacheOnlyDays,
  resolveDayMutationConflict,
  resolveDayMutationRecovery,
} from '../src/services/daySync';
import { DayRecord } from '../src/types';

function updatedRecord(base: DayRecord): DayRecord {
  return {
    ...base,
    academics: { ...base.academics, timeSpent: '60 minutes' },
    updatedAt: new Date(2000).toISOString(),
  };
}

function successfulApply(operation: ReturnType<typeof createDayMutation>): DayMutationApplyResult {
  return {
    record: { ...operation.baseRecord, ...operation.patch, syncRevision: operation.baseRevision + 1 },
    serverRevision: operation.baseRevision + 1,
    appliedFields: Object.keys(operation.patch) as DayMutationApplyResult['appliedFields'],
    conflicts: [],
  };
}

async function main() {
  const uidA = 'user-a';
  const uidB = 'user-b';
  await indexedDbDayOutbox.removeForUid(uidA);
  await indexedDbDayOutbox.removeForUid(uidB);

  const base = createDefaultDayRecord('2026-10-10', DEFAULT_SETTINGS);
  const changed = updatedRecord(base);
  const operation = createDayMutation(uidA, base, diffDayRecord(base, changed), 1000);
  await indexedDbDayOutbox.enqueue(operation);

  const atomicUid = 'atomic-bulk-import';
  const atomicBase = createDefaultDayRecord('2026-10-11', DEFAULT_SETTINGS);
  const duplicate = createDayMutation(atomicUid, atomicBase, { notes: 'already queued' }, 1000);
  const fresh = createDayMutation(
    atomicUid,
    createDefaultDayRecord('2026-10-12', DEFAULT_SETTINGS),
    { notes: 'must roll back' },
    1000
  );
  await indexedDbDayOutbox.enqueue(duplicate);
  await assert.rejects(indexedDbDayOutbox.enqueueMany([fresh, duplicate]));
  assert.deepEqual((await indexedDbDayOutbox.list(atomicUid)).map(({ id }) => id), [duplicate.id]);
  await indexedDbDayOutbox.removeForUid(atomicUid);
  console.log('PASS: Bulk outbox enqueue rolls back atomically on a duplicate operation.');

  await processDayOutbox(uidA, {
    store: indexedDbDayOutbox,
    apply: async () => {
      const error = new Error('offline');
      Object.assign(error, { code: 'firestore/unavailable' });
      throw error;
    },
    isActive: () => true,
    now: () => 1000,
    random: () => 0,
  });
  const failedAttempt = (await indexedDbDayOutbox.list(uidA))[0];
  assert.equal(failedAttempt.status, 'pending');
  assert.equal(failedAttempt.attempts, 1);
  assert.ok(failedAttempt.nextAttemptAt > 1000);

  await closeDayOutboxDatabase();
  const recoveredAfterRestart = (await indexedDbDayOutbox.list(uidA))[0];
  assert.equal(recoveredAfterRestart.id, operation.id);
  assert.deepEqual(recoveredAfterRestart.patch, operation.patch);
  console.log('PASS: Failed day writes survive an IndexedDB close/reopen.');

  const serverSnapshot = { ...base, mood: 2, syncRevision: 7 };
  const pendingMood = createDayMutation(
    uidA,
    { ...base, syncRevision: 7 },
    { mood: 5 },
    3000
  );
  const reconciled = reconcileDayRecordWithMutations(serverSnapshot, [pendingMood]);
  assert.equal(reconciled.mood, 5);
  assert.equal(reconciled.syncRevision, 7);
  console.log('PASS: A server snapshot does not replace a pending local edit.');

  const cachedDays = {
    [base.date]: { ...base, mood: 5 },
    '2026-10-18': createDefaultDayRecord('2026-10-18', DEFAULT_SETTINGS),
    '2026-10-19': createDefaultDayRecord('2026-10-19', DEFAULT_SETTINGS),
  };
  const candidateRecoveries = getRecoverableCacheOnlyDays(
    cachedDays,
    { [base.date]: { ...base, mood: 2 } },
    new Set(['2026-10-19'])
  );
  assert.deepEqual(candidateRecoveries.map(({ date }) => date), ['2026-10-18']);

  const cacheRecovery = createDayCacheRecovery(uidA, { ...base, mood: 5 });
  await indexedDbDayOutbox.enqueue(cacheRecovery);
  await closeDayOutboxDatabase();
  const recoveredCacheOperation = (await indexedDbDayOutbox.list(uidA)).find((candidate) => (
    candidate.id === cacheRecovery.id
  ));
  assert.equal(recoveredCacheOperation?.status, 'recovery');
  assert.equal(recoveredCacheOperation?.lastError, 'ambiguous-local-cache');
  assert.equal(recoveredCacheOperation?.baseKnownOnCloud, undefined);
  await indexedDbDayOutbox.remove(cacheRecovery.id);

  const calls: string[] = [];
  const opB = createDayMutation(uidB, base, { energy: 4 }, 4000);
  await indexedDbDayOutbox.enqueue(opB);
  await processDayOutbox(uidB, {
    store: indexedDbDayOutbox,
    apply: async (queued) => {
      calls.push(queued.uid);
      return successfulApply(queued);
    },
    isActive: () => true,
    now: () => 4000,
  });
  assert.deepEqual(calls, [uidB]);
  assert.equal((await indexedDbDayOutbox.list(uidA)).length, 1);
  assert.equal((await indexedDbDayOutbox.list(uidB)).length, 0);

  const claimBase = { ...base, syncRevision: 4 };
  const claimOperation = createDayMutation(uidA, claimBase, { notes: 'claimed once' }, 6000);
  await indexedDbDayOutbox.enqueue(claimOperation);
  const claim = await indexedDbDayOutbox.claim(claimOperation.id, 'tab-a', 6000, 1000);
  assert.equal(claim?.status, 'syncing');
  assert.equal(await indexedDbDayOutbox.claim(claimOperation.id, 'tab-b', 6500, 1000), null);
  assert.equal(await indexedDbDayOutbox.updateClaim(claimOperation.id, 'tab-b', { status: 'conflict' }), null);
  assert.equal(await indexedDbDayOutbox.removeClaim(claimOperation.id, 'tab-b'), false);
  assert.equal(await indexedDbDayOutbox.removeClaim(claimOperation.id, 'tab-a'), true);

  const recoveryUid = 'recovery-user';
  const recoveryOperation = createDayMutation(recoveryUid, claimBase, { energy: 2 }, 7000);
  await indexedDbDayOutbox.enqueue(recoveryOperation);
  await processDayOutbox(recoveryUid, {
    store: indexedDbDayOutbox,
    apply: async () => { throw new RemoteDayDeletedError(); },
    isActive: () => true,
    now: () => 7000,
  });
  const retainedRecovery = (await indexedDbDayOutbox.list(recoveryUid)).find((candidate) => (
    candidate.id === recoveryOperation.id
  ));
  assert.equal(retainedRecovery?.status, 'recovery');
  assert.deepEqual(retainedRecovery?.patch, recoveryOperation.patch);
  await closeDayOutboxDatabase();
  const recoveredAfterRemoteDeletionRestart = (await indexedDbDayOutbox.list(recoveryUid)).find((candidate) => (
    candidate.id === recoveryOperation.id
  ));
  assert.equal(recoveredAfterRemoteDeletionRestart?.status, 'recovery');
  assert.deepEqual(recoveredAfterRemoteDeletionRestart?.patch, recoveryOperation.patch);
  await resolveDayMutationRecovery(indexedDbDayOutbox, retainedRecovery!, 'local', 8000);
  const restoredOperation = (await indexedDbDayOutbox.list(recoveryUid)).find((candidate) => (
    candidate.id === recoveryOperation.id
  ));
  assert.equal(restoredOperation?.status, 'pending');
  assert.equal(restoredOperation?.baseKnownOnCloud, false);
  await indexedDbDayOutbox.remove(recoveryOperation.id);

  const conflictBase = { ...base, syncRevision: 7, mood: 2, notes: 'conflict-time snapshot' };
  const conflictOperation = createDayMutation(uidA, conflictBase, { mood: 5 }, 8500);
  conflictOperation.status = 'conflict';
  conflictOperation.conflicts = [{
    field: 'mood',
    baseValue: 2,
    localValue: 5,
    remoteValue: 4,
  }];
  conflictOperation.conflictRecord = { ...conflictBase, mood: 4 };
  await indexedDbDayOutbox.enqueue(conflictOperation);
  const latestCloudRecord = {
    ...conflictBase,
    mood: 3,
    notes: 'newer cloud note',
    syncRevision: 9,
  };
  await resolveDayMutationConflict(
    indexedDbDayOutbox,
    conflictOperation,
    'local',
    latestCloudRecord,
    9000
  );
  const rebasedLocalConflict = (await indexedDbDayOutbox.list(uidA)).find((candidate) => (
    candidate.id === conflictOperation.id
  ));
  assert.equal(rebasedLocalConflict?.status, 'pending');
  assert.equal(rebasedLocalConflict?.baseValues.mood, latestCloudRecord.mood);
  assert.equal(rebasedLocalConflict?.baseRecord.notes, latestCloudRecord.notes);
  assert.equal(rebasedLocalConflict?.baseRevision, latestCloudRecord.syncRevision);
  assert.equal(rebasedLocalConflict?.baseKnownOnCloud, true);
  console.log('PASS: Keep-local conflict resolution rebases on the latest cloud record.');
  await indexedDbDayOutbox.remove(conflictOperation.id);

  const remoteBase = {
    ...createDefaultDayRecord('2026-10-22', DEFAULT_SETTINGS),
    syncRevision: 9,
    mood: 3,
  };
  const latestRemoteCloudRecord = { ...remoteBase, notes: 'latest remote choice' };
  const remoteConflict = createDayMutation(uidA, remoteBase, { mood: 5 }, 9500);
  remoteConflict.status = 'conflict';
  await indexedDbDayOutbox.enqueue(remoteConflict);
  await resolveDayMutationConflict(
    indexedDbDayOutbox,
    remoteConflict,
    'remote',
    latestRemoteCloudRecord,
    10000
  );
  const useCloudOperations = await indexedDbDayOutbox.list(uidA);
  assert.equal(useCloudOperations.some((candidate) => candidate.id === remoteConflict.id), false);
  assert.equal(
    reconcileDayRecordWithMutations(
      latestRemoteCloudRecord,
      useCloudOperations.filter((candidate) => candidate.date === latestRemoteCloudRecord.date)
    ).mood,
    latestRemoteCloudRecord.mood
  );
  console.log('PASS: Use-cloud conflict resolution discards the queued edit against current cloud state.');

  await processDayOutbox(uidA, {
    store: indexedDbDayOutbox,
    apply: async (queued) => {
      calls.push(queued.uid);
      return successfulApply(queued);
    },
    isActive: () => true,
    now: () => 5000,
  });
  assert.deepEqual(calls, [uidB, uidA]);
  assert.equal((await indexedDbDayOutbox.list(uidA)).length, 0);
  await indexedDbDayOutbox.removeForUid(uidA);
  console.log('PASS: User queues remain isolated and acknowledged writes are removed.');

  await indexedDbDayOutbox.removeForUid(uidA);
  await indexedDbDayOutbox.removeForUid(uidB);
  await closeDayOutboxDatabase();
  console.log('Day outbox tests passed.');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
