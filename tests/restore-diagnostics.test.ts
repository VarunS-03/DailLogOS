import assert from 'node:assert/strict';
import { classifyRestoreError, logRestoreFailure } from '../src/firebase';

assert.equal(classifyRestoreError({ code: 'firestore/permission-denied' }), 'permission-denied');
assert.equal(classifyRestoreError({ code: 'auth/unauthenticated' }), 'unauthenticated');
assert.equal(classifyRestoreError({ code: 'firestore/unavailable' }), 'unavailable');
assert.equal(classifyRestoreError({ code: 'firestore/failed-precondition' }), 'failed-precondition');
assert.equal(classifyRestoreError(new Error('IndexedDB is unavailable')), 'storage-unavailable');
assert.equal(classifyRestoreError(new Error('The saved onboarding status is invalid.')), 'data-invalid');

const warnings: unknown[][] = [];
const previousWarn = console.warn;
console.warn = (...args: unknown[]) => { warnings.push(args); };
try {
  logRestoreFailure('account_reads', new Error('credential=DO_NOT_LOG_THIS'));
} finally {
  console.warn = previousWarn;
}
assert.equal(JSON.stringify(warnings).includes('DO_NOT_LOG_THIS'), false);
assert.equal(JSON.stringify(warnings).includes('account_reads'), true);
console.log('Restore diagnostic classification tests passed.');
