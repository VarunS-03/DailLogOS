import assert from 'node:assert/strict';
import { readOutboxSafely } from '../src/services/outboxAccess';

async function main() {
  const expectedError = new Error('IndexedDB is unavailable');
  const failed = await readOutboxSafely({ list: async () => { throw expectedError; } }, 'uid-a');
  assert.deepEqual(failed, { available: false, operations: null, error: expectedError });

  const operation = { uid: 'uid-a', id: 'pending-1' } as never;
  const available = await readOutboxSafely({ list: async (uid) => {
    assert.equal(uid, 'uid-a');
    return [operation];
  } }, 'uid-a');
  assert.deepEqual(available, { available: true, operations: [operation] });
  console.log('Outbox access degradation tests passed.');
}

void main();
