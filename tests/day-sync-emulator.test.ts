import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, Firestore, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { DEFAULT_SETTINGS, createDefaultDayRecord } from '../src/constants/templates';
import { initializeUserAccountForDatabase, AccountDeletionError, AccountRestoreError } from '../src/firebase';
import {
  closeDayOutboxDatabase,
  createDayMutation,
  diffDayRecord,
  indexedDbDayOutbox,
} from '../src/services/dayOutbox';
import {
  applyDayMutationTransaction,
  processDayOutbox,
  resolveDayMutationConflict,
} from '../src/services/daySync';
import { DayRecord } from '../src/types';

const PROJECT_ID = 'demo-daily-os';
const EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);

function typedFirestore(environment: RulesTestEnvironment, uid: string): Firestore {
  return environment.authenticatedContext(uid).firestore() as unknown as Firestore;
}

async function seedRecord(
  environment: RulesTestEnvironment,
  uid: string,
  record: DayRecord
): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await database.collection('users').doc(uid).collection('days').doc(record.date).set(record);
  });
}

async function readRecord(
  environment: RulesTestEnvironment,
  uid: string,
  date: string
): Promise<DayRecord> {
  const database = environment.authenticatedContext(uid).firestore();
  const snapshot = await database.collection('users').doc(uid).collection('days').doc(date).get();
  assert.ok(snapshot.exists);
  return snapshot.data() as DayRecord;
}

async function main() {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: EMULATOR_PORT, rules },
  });

  try {
    await environment.clearFirestore();
    const freshUid = 'fresh-account';
    const freshDatabase = typedFirestore(environment, freshUid);
    const freshUser = { uid: freshUid, email: 'new-user@example.test', displayName: 'New User', photoURL: null };
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid))).exists(), false);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid, 'settings', 'main'))).exists(), false);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid, 'onboarding', 'main'))).exists(), false);
    const initializedFresh = await initializeUserAccountForDatabase(freshUser, freshDatabase);
    assert.equal(initializedFresh.onboarding.status, 'not_started');
    assert.equal(initializedFresh.onboarding.currentStage, 1);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid))).exists(), true);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid, 'settings', 'main'))).exists(), false);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid, 'days', '2026-10-11'))).exists(), false);
    assert.equal((await getDocs(query(collection(freshDatabase, 'users', freshUid, 'days'), limit(1)))).empty, true);
    await assert.rejects(
      getDocs(query(collection(typedFirestore(environment, 'different-owner'), 'users', freshUid, 'days'), limit(1))),
    );
    await assert.rejects(
      getDocs(query(collection(environment.unauthenticatedContext().firestore(), 'users', freshUid, 'days'), limit(1))),
    );
    await assert.rejects(getDoc(doc(freshDatabase, 'users', freshUid, 'days', 'invalid-date')));

    await updateDoc(doc(freshDatabase, 'users', freshUid, 'onboarding', 'main'), {
      status: 'in_progress', currentStage: 3, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(freshDatabase, 'users', freshUid, 'settings', 'main'), DEFAULT_SETTINGS);
    await seedRecord(environment, freshUid, createDefaultDayRecord('2026-10-11', DEFAULT_SETTINGS));
    const initializedReturning = await initializeUserAccountForDatabase(freshUser, freshDatabase);
    assert.equal(initializedReturning.onboarding.status, 'in_progress', 'returning initialization preserves lifecycle status');
    assert.equal(initializedReturning.onboarding.currentStage, 3, 'returning initialization preserves onboarding stage');
    assert.equal(initializedReturning.settings?.theme, DEFAULT_SETTINGS.theme);
    assert.equal((await getDoc(doc(freshDatabase, 'users', freshUid, 'days', '2026-10-11'))).exists(), true);

    const tombstonedUid = 'tombstoned-account';
    const tombstonedDatabase = typedFirestore(environment, tombstonedUid);
    await setDoc(doc(tombstonedDatabase, 'accountDeletionTombstones', tombstonedUid), {
      status: 'pending', startedAt: serverTimestamp(),
    });
    await assert.rejects(
      initializeUserAccountForDatabase({ ...freshUser, uid: tombstonedUid }, tombstonedDatabase),
      AccountDeletionError,
    );
    assert.equal((await getDoc(doc(tombstonedDatabase, 'users', tombstonedUid))).exists(), false);
    await assert.rejects(getDoc(doc(typedFirestore(environment, 'not-owner'), 'users', freshUid)));
    await assert.rejects(
      initializeUserAccountForDatabase(freshUser, typedFirestore(environment, 'different-owner')),
      (error: unknown) => error instanceof AccountRestoreError
        && ['account_profile_read', 'account_tombstone_read', 'account_settings_read', 'account_days_list'].includes(error.phase)
        && error.category === 'permission-denied',
    );
    const malformedUid = 'malformed-account';
    const malformedDatabase = typedFirestore(environment, malformedUid);
    await environment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('users').doc(malformedUid).set({ uid: malformedUid, unexpectedPrivateField: true });
    });
    await assert.rejects(
      initializeUserAccountForDatabase({ ...freshUser, uid: malformedUid }, malformedDatabase),
      (error: unknown) => error instanceof AccountRestoreError && error.phase === 'account_integrity' && error.category === 'data-invalid',
    );
    const malformedSettingsUid = 'malformed-settings';
    const malformedSettingsDatabase = typedFirestore(environment, malformedSettingsUid);
    await environment.withSecurityRulesDisabled(async (context) => {
      const account = context.firestore().collection('users').doc(malformedSettingsUid);
      await account.set({ uid: malformedSettingsUid });
      await account.collection('settings').doc('main').set({ systemConfiguration: { invalid: true } });
    });
    await assert.rejects(
      initializeUserAccountForDatabase({ ...freshUser, uid: malformedSettingsUid }, malformedSettingsDatabase),
      (error: unknown) => error instanceof AccountRestoreError && error.phase === 'account_integrity' && error.category === 'data-invalid',
    );
    assert.equal((await getDoc(doc(malformedSettingsDatabase, 'users', malformedSettingsUid, 'onboarding', 'main'))).exists(), false);
    console.log('PASS (Firestore Emulator): Production account initialization provisions new users, preserves returning state, enforces owner access, and blocks tombstones.');

    const uid = 'sync-user';
    const database = typedFirestore(environment, uid);
    const accountRef = doc(database, 'users', uid);
    const deletionTombstoneRef = doc(database, 'accountDeletionTombstones', uid);
    await setDoc(accountRef, { uid });
    await setDoc(accountRef, { uid, email: 'owner@example.test', updatedAt: new Date().toISOString() }, { merge: true });
    const settingsRef = doc(database, 'users', uid, 'settings', 'main');
    await setDoc(settingsRef, DEFAULT_SETTINGS);
    assert.equal((await getDoc(settingsRef)).exists(), true);
    const otherUid = 'other-user';
    const otherDatabase = typedFirestore(environment, otherUid);
    await setDoc(doc(otherDatabase, 'users', otherUid), { uid: otherUid });
    await assert.rejects(getDoc(doc(otherDatabase, 'users', uid, 'days', '2026-10-11')));
    await assert.rejects(getDoc(doc(otherDatabase, 'users', uid, 'settings', 'main')));
    await assert.rejects(setDoc(doc(otherDatabase, 'users', uid, 'settings', 'main'), DEFAULT_SETTINGS));
    await assert.rejects(getDoc(doc(database, 'unlistedCollection', 'private')));
    await assert.rejects(setDoc(settingsRef, { theme: 'ultraviolet' }, { merge: true }));
    const anonymous = environment.unauthenticatedContext().firestore();
    await assert.rejects(getDoc(doc(anonymous, 'users', uid, 'settings', 'main')));
    console.log('PASS (Firestore Emulator): Owner access works while anonymous, cross-user, unknown-path, and invalid-settings access is denied.');
    const coachMessageRef = doc(database, 'users', uid, 'coachChats', 'main', 'messages', 'message-1');
    await setDoc(coachMessageRef, {
      role: 'user', text: 'Help me make a realistic plan.', sequence: Date.now(), createdAt: serverTimestamp(),
    });
    assert.equal((await getDoc(coachMessageRef)).exists(), true);
    await assert.rejects(getDoc(doc(otherDatabase, 'users', uid, 'coachChats', 'main', 'messages', 'message-1')));
    await assert.rejects(setDoc(doc(database, 'users', uid, 'coachChats', 'main', 'messages', 'oversized'), {
      role: 'user', text: 'x'.repeat(4001), sequence: Date.now(), createdAt: serverTimestamp(),
    }));
    await assert.rejects(updateDoc(coachMessageRef, { text: 'Edited history' }));
    console.log('PASS (Firestore Emulator): Coach chat messages are owner-only, bounded, and immutable.');
    const date = '2026-10-11';
    const base = { ...createDefaultDayRecord(date, DEFAULT_SETTINGS), syncRevision: 0 };
    await seedRecord(environment, uid, base);

    const firstWorkout = base.workout.exercises[0];
    assert.ok(firstWorkout, 'default day contains a workout exercise');
    const studyUpdate = {
      ...base,
      academics: { ...base.academics, timeSpent: '75 minutes' },
    };
    const workoutUpdate = {
      ...base,
      workout: {
        ...base.workout,
        exercises: base.workout.exercises.map((exercise, index) => (
          index === 0 ? { ...exercise, duration: '35 minutes' } : exercise
        )),
      },
    };
    const independentResults = await Promise.all([
      applyDayMutationTransaction(database, createDayMutation(uid, base, diffDayRecord(base, studyUpdate))),
      applyDayMutationTransaction(database, createDayMutation(uid, base, diffDayRecord(base, workoutUpdate))),
    ]);
    const independentlyMerged = await readRecord(environment, uid, date);
    assert.equal(independentlyMerged.academics.timeSpent, '75 minutes');
    assert.equal(independentlyMerged.workout.exercises[0].duration, '35 minutes');
    assert.equal(independentlyMerged.syncRevision, 2);
    assert.equal(
      (await getDoc(doc(database, 'users', uid, 'daySyncState', date))).data()?.revision,
      2
    );
    assert.ok(independentResults.every((result) => result.conflicts.length === 0));
    console.log('PASS (Firestore Emulator): Concurrent study/workout edits both survive.');

    const conflictDate = '2026-10-12';
    const conflictBase = { ...createDefaultDayRecord(conflictDate, DEFAULT_SETTINGS), syncRevision: 0 };
    await seedRecord(environment, uid, conflictBase);
    const moodA = createDayMutation(uid, conflictBase, { mood: 2 });
    const moodB = createDayMutation(uid, conflictBase, { mood: 5 });
    const moodResults = await Promise.all([
      applyDayMutationTransaction(database, moodA),
      applyDayMutationTransaction(database, moodB),
    ]);
    const conflictingOperation = moodResults[0].conflicts.length > 0 ? moodA : moodB;
    assert.ok(moodResults.some((result) => result.conflicts.some((conflict) => conflict.field === 'mood')));
    await indexedDbDayOutbox.enqueue(conflictingOperation);
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: (operation) => applyDayMutationTransaction(database, operation),
      isActive: () => true,
    });
    const retainedConflict = (await indexedDbDayOutbox.list(uid)).find((operation) => operation.date === conflictDate);
    assert.equal(retainedConflict?.status, 'conflict');
    assert.equal(retainedConflict?.conflicts?.[0].field, 'mood');
    console.log('PASS (Firestore Emulator): Same-field changes are retained as an explicit conflict.');
    const conflictCloudBeforeRebase = await readRecord(environment, uid, conflictDate);
    await applyDayMutationTransaction(
      database,
      createDayMutation(uid, conflictCloudBeforeRebase, {
        mood: 3,
        notes: 'latest unrelated cloud update',
      })
    );
    const latestConflictCloud = await readRecord(environment, uid, conflictDate);
    await resolveDayMutationConflict(
      indexedDbDayOutbox,
      retainedConflict!,
      'local',
      latestConflictCloud
    );
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: (operation) => applyDayMutationTransaction(database, operation),
      isActive: () => true,
    });
    const keepLocalResult = await readRecord(environment, uid, conflictDate);
    assert.equal(keepLocalResult.mood, conflictingOperation.patch.mood);
    assert.equal(keepLocalResult.notes, 'latest unrelated cloud update');
    assert.equal(
      (await indexedDbDayOutbox.list(uid)).some((operation) => operation.id === conflictingOperation.id),
      false
    );
    console.log('PASS (Firestore Emulator): Keep-local rebases against the latest cloud value without losing other fields.');

    const cloudChoiceDate = '2026-10-21';
    const cloudChoiceBase = {
      ...createDefaultDayRecord(cloudChoiceDate, DEFAULT_SETTINGS),
      mood: 2,
      syncRevision: 0,
    };
    await seedRecord(environment, uid, cloudChoiceBase);
    const useCloudOperation = createDayMutation(uid, cloudChoiceBase, { mood: 5 });
    await applyDayMutationTransaction(
      database,
      createDayMutation(uid, cloudChoiceBase, { mood: 4 })
    );
    await indexedDbDayOutbox.enqueue(useCloudOperation);
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: (operation) => applyDayMutationTransaction(database, operation),
      isActive: () => true,
    });
    const retainedUseCloud = (await indexedDbDayOutbox.list(uid)).find((operation) => (
      operation.id === useCloudOperation.id
    ));
    assert.equal(retainedUseCloud?.status, 'conflict');
    const cloudAtConflict = await readRecord(environment, uid, cloudChoiceDate);
    await applyDayMutationTransaction(
      database,
      createDayMutation(uid, cloudAtConflict, {
        mood: 3,
        notes: 'changed again after conflict',
      })
    );
    const latestCloudChoice = await readRecord(environment, uid, cloudChoiceDate);
    await resolveDayMutationConflict(
      indexedDbDayOutbox,
      retainedUseCloud!,
      'remote',
      latestCloudChoice
    );
    assert.equal(
      (await indexedDbDayOutbox.list(uid)).some((operation) => operation.id === useCloudOperation.id),
      false
    );
    const cloudChoiceResult = await readRecord(environment, uid, cloudChoiceDate);
    assert.equal(cloudChoiceResult.mood, latestCloudChoice.mood);
    assert.equal(cloudChoiceResult.notes, 'changed again after conflict');
    console.log('PASS (Firestore Emulator): Use-cloud resolution retains the newest server value.');

    const retryDate = '2026-10-13';
    const retryBase = { ...createDefaultDayRecord(retryDate, DEFAULT_SETTINGS), syncRevision: 0 };
    await seedRecord(environment, uid, retryBase);
    const retryOperation = createDayMutation(uid, retryBase, { notes: 'saved once' }, 1000);
    await indexedDbDayOutbox.enqueue(retryOperation);
    let attempts = 0;
    const applyThenTimeout = async (operation: typeof retryOperation) => {
      attempts += 1;
      const result = await applyDayMutationTransaction(database, operation);
      if (attempts === 1) {
        const error = new Error('The server accepted the write but the response timed out.');
        Object.assign(error, { code: 'unavailable' });
        throw error;
      }
      return result;
    };
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: applyThenTimeout,
      isActive: () => true,
      now: () => 1000,
      random: () => 0,
    });
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: applyThenTimeout,
      isActive: () => true,
      now: () => 5000,
      random: () => 0,
    });
    const retryResult = await readRecord(environment, uid, retryDate);
    assert.equal(retryResult.notes, 'saved once');
    assert.equal(retryResult.syncRevision, 1);
    assert.equal((await indexedDbDayOutbox.list(uid)).some((operation) => operation.date === retryDate), false);
    console.log('PASS (Firestore Emulator): Retrying an accepted write is idempotent and acknowledged.');

    const legacyDate = '2026-10-14';
    const legacy = createDefaultDayRecord(legacyDate, DEFAULT_SETTINGS);
    legacy.notes = 'legacy note preserved';
    await seedRecord(environment, uid, legacy);
    const legacyUpdate = createDayMutation(uid, legacy, { mood: 4 });
    await applyDayMutationTransaction(database, legacyUpdate);
    const migratedOnWrite = await readRecord(environment, uid, legacyDate);
    assert.equal(migratedOnWrite.notes, 'legacy note preserved');
    assert.equal(migratedOnWrite.mood, 4);
    assert.equal(migratedOnWrite.syncRevision, 1);
    assert.equal(
      (await getDoc(doc(database, 'users', uid, 'daySyncState', legacyDate))).data()?.revision,
      1
    );
    console.log('PASS (Firestore Emulator): Legacy records without revision metadata remain editable.');

    const priorSyncDate = '2026-10-20';
    const priorSyncRecord = { ...createDefaultDayRecord(priorSyncDate, DEFAULT_SETTINGS), syncRevision: 7 };
    await seedRecord(environment, uid, priorSyncRecord);
    await applyDayMutationTransaction(database, createDayMutation(uid, priorSyncRecord, { notes: 'migrated sync state' }));
    const migratedSyncRecord = await readRecord(environment, uid, priorSyncDate);
    assert.equal(migratedSyncRecord.syncRevision, 8);
    assert.equal(
      (await getDoc(doc(database, 'users', uid, 'daySyncState', priorSyncDate))).data()?.revision,
      8
    );
    console.log('PASS (Firestore Emulator): Existing revisioned days migrate atomically to the sync-state marker.');

    const newDate = '2026-10-15';
    const newDay = createDefaultDayRecord(newDate, DEFAULT_SETTINGS);
    await applyDayMutationTransaction(database, createDayMutation(uid, newDay, { notes: 'created through outbox' }));
    const createdDay = await readRecord(environment, uid, newDate);
    assert.equal(createdDay.notes, 'created through outbox');
    assert.equal(createdDay.syncRevision, 1);
    console.log('PASS (Firestore Emulator): New day records start at revision one.');
    await assert.rejects(
      applyDayMutationTransaction(
        database,
        createDayMutation(uid, createdDay, { notes: 'x'.repeat(5001) })
      ),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    assert.equal((await readRecord(environment, uid, newDate)).notes, createdDay.notes);
    console.log('PASS (Firestore Emulator): Transactional updates retain field-level validation.');

    await assert.rejects(
      setDoc(doc(database, 'users', uid, 'days', legacyDate), {
        ...migratedOnWrite,
        notes: 'stale whole-document client',
        syncRevision: 2,
        lastSyncedAt: serverTimestamp(),
      }, { merge: true }),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    console.log('PASS (Firestore Emulator): Older whole-document writes without the paired sync-state update are rejected.');

    const deletedDate = '2026-10-16';
    const previouslySynced = { ...createDefaultDayRecord(deletedDate, DEFAULT_SETTINGS), syncRevision: 3 };
    const deletedOperation = createDayMutation(uid, previouslySynced, { mood: 5 });
    await indexedDbDayOutbox.enqueue(deletedOperation);
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: (operation) => applyDayMutationTransaction(database, operation),
      isActive: () => true,
    });
    const retainedDeletionRecovery = (await indexedDbDayOutbox.list(uid)).find((operation) => (
      operation.id === deletedOperation.id
    ));
    assert.equal(retainedDeletionRecovery?.status, 'recovery');
    assert.equal((await getDoc(doc(database, 'users', uid, 'days', deletedDate))).exists(), false);
    console.log('PASS (Firestore Emulator): Queued edits never recreate a previously synced deleted day automatically.');

    const staleOperation = createDayMutation(uid, createdDay, { mood: 2 });
    await indexedDbDayOutbox.enqueue(staleOperation);
    await setDoc(deletionTombstoneRef, { status: 'pending', startedAt: serverTimestamp() });
    await processDayOutbox(uid, {
      store: indexedDbDayOutbox,
      apply: (operation) => applyDayMutationTransaction(database, operation),
      isActive: () => true,
    });
    const rejectedStaleOperation = (await indexedDbDayOutbox.list(uid)).find((operation) => (
      operation.id === staleOperation.id
    ));
    assert.equal(rejectedStaleOperation?.status, 'failed');
    assert.equal((await readRecord(environment, uid, newDate)).mood, createdDay.mood);
    const otherDeviceDatabase = typedFirestore(environment, uid);
    await assert.rejects(
      applyDayMutationTransaction(otherDeviceDatabase, staleOperation),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    await assert.rejects(
      applyDayMutationTransaction(
        database,
        createDayMutation(uid, migratedOnWrite, { mood: 5 })
      ),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    await assert.rejects(
      updateDoc(deletionTombstoneRef, { status: 'active' }),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    await assert.rejects(
      deleteDoc(deletionTombstoneRef),
      (error: unknown) => (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'permission-denied'
      )
    );
    await deleteDoc(accountRef);
    assert.equal((await getDoc(accountRef)).exists(), false);
    assert.equal((await getDoc(deletionTombstoneRef)).exists(), true);
    console.log('PASS (Firestore Emulator): Deletion tombstones block same- and other-device writes and cannot be cleared.');
  } finally {
    await indexedDbDayOutbox.removeForUid('sync-user');
    await closeDayOutboxDatabase();
    await environment.cleanup();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
