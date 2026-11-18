import assert from 'node:assert/strict';
import {
  AccountDeletionActions,
  AccountDeletionCleanupError,
  completeAccountDeletion,
} from '../src/services/accountDeletion';

async function main() {
  const events: string[] = [];
  let tombstoneWritten = false;
  let pendingOperations = 2;
  let failDayCleanup = true;
  const actions: AccountDeletionActions = {
    markPending: async () => {
      events.push('tombstone');
      tombstoneWritten = true;
    },
    purgeOutbox: async () => {
      assert.equal(tombstoneWritten, true);
      events.push('outbox');
      pendingOperations = 0;
    },
    clearLocalCache: () => { events.push('cache'); },
    deleteDays: async () => {
      events.push('days');
      if (failDayCleanup) {
        failDayCleanup = false;
        throw new Error('partial cleanup');
      }
    },
    deleteSyncState: async () => { events.push('sync-state'); },
    deleteSettings: async () => { events.push('settings'); },
    deleteOnboarding: async () => { events.push('onboarding'); },
    deleteProfile: async () => { events.push('profile'); },
    deleteAuthentication: async () => { events.push('auth'); },
  };

  await assert.rejects(completeAccountDeletion(actions), AccountDeletionCleanupError);
  assert.equal(pendingOperations, 0);
  assert.deepEqual(events, ['tombstone', 'outbox', 'cache', 'days']);
  await completeAccountDeletion(actions);
  assert.deepEqual(events.slice(4), [
    'tombstone',
    'outbox',
    'cache',
    'days',
    'sync-state',
    'settings',
    'onboarding',
    'profile',
    'auth',
  ]);
  console.log('PASS: Partial account deletion remains tombstoned and resumes idempotently.');

  let failOutboxCleanup = true;
  let laterCleanupRan = false;
  const failingOutboxActions: AccountDeletionActions = {
    ...actions,
    purgeOutbox: async () => {
      if (failOutboxCleanup) {
        failOutboxCleanup = false;
        throw new Error('outbox unavailable');
      }
      pendingOperations = 0;
    },
    clearLocalCache: () => { laterCleanupRan = true; },
  };
  await assert.rejects(completeAccountDeletion(failingOutboxActions), AccountDeletionCleanupError);
  assert.equal(laterCleanupRan, false);
  await completeAccountDeletion(failingOutboxActions);
  assert.equal(laterCleanupRan, true);
  console.log('PASS: Outbox cleanup failure leaves deletion pending and can be retried.');

  let postTombstoneCleanupRan = false;
  await assert.rejects(completeAccountDeletion({
    ...actions,
    markPending: async () => { throw new Error('server unavailable'); },
    purgeOutbox: async () => { postTombstoneCleanupRan = true; },
  }), /server unavailable/);
  assert.equal(postTombstoneCleanupRan, false, 'cleanup must not run if tombstone creation fails');
  console.log('PASS: Tombstone creation failure prevents account cleanup from starting.');

  let authFailure = true;
  let tombstoneStillPresent = false;
  const authRetryEvents: string[] = [];
  const authRetryActions: AccountDeletionActions = {
    markPending: async () => { tombstoneStillPresent = true; authRetryEvents.push('tombstone'); },
    purgeOutbox: async () => { authRetryEvents.push('outbox'); },
    clearLocalCache: () => { authRetryEvents.push('cache'); },
    deleteDays: async () => { authRetryEvents.push('days'); },
    deleteSyncState: async () => { authRetryEvents.push('sync-state'); },
    deleteSettings: async () => { authRetryEvents.push('settings'); },
    deleteOnboarding: async () => { authRetryEvents.push('onboarding'); },
    deleteProfile: async () => { authRetryEvents.push('profile'); },
    deleteAuthentication: async () => {
      authRetryEvents.push('auth');
      if (authFailure) {
        authFailure = false;
        throw new Error('reauthentication required');
      }
    },
  };
  await assert.rejects(completeAccountDeletion(authRetryActions), (error: unknown) => {
    assert.ok(error instanceof AccountDeletionCleanupError);
    assert.equal(error.stage, 'Firebase Authentication deletion');
    assert.match(error.message, /User data cleanup finished and writes remain blocked/);
    return true;
  });
  assert.equal(tombstoneStillPresent, true);
  await completeAccountDeletion(authRetryActions);
  assert.deepEqual(authRetryEvents.slice(-9), [
    'tombstone', 'outbox', 'cache', 'days', 'sync-state', 'settings', 'onboarding', 'profile', 'auth',
  ]);
  console.log('PASS: Auth deletion failure reports completed data cleanup and safely resumes with the tombstone retained.');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
