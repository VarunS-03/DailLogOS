import { createDefaultDayRecord } from '../src/constants/templates';
import { validateAndSanitizeBackup } from '../src/utils/backupValidation';
import { addDaysToDateId, getLocalDateId } from '../src/utils/localDate';

let passed = 0;

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
}

const legacyDay = createDefaultDayRecord('2026-09-11');
delete legacyDay.schemaVersion;

const validBehavioralDay = {
  ...createDefaultDayRecord('2026-09-11'),
  outcomes: [{
    id: 'outcome-1', domain: 'academics', title: 'Finish worksheet', minimumOutput: 'One submitted worksheet',
    priority: 1, status: 'planned', source: 'user', createdAt: '2026-09-11T08:00:00.000Z',
  }],
};

const validBackup = (day: unknown) => JSON.stringify({ days: { '2026-09-11': day } });

assert('legacy records without schemaVersion remain importable', validateAndSanitizeBackup(validBackup(legacyDay)).valid);
assert('behavioral fields serialize through import validation', Boolean(validateAndSanitizeBackup(validBackup(validBehavioralDay)).sanitizedDays?.['2026-09-11'].outcomes));
assert('invalid behavioral enums are rejected', !validateAndSanitizeBackup(validBackup({ ...validBehavioralDay, outcomes: [{ ...validBehavioralDay.outcomes[0], status: 'invalid' }] })).valid);
assert('oversized behavioral arrays are rejected', !validateAndSanitizeBackup(validBackup({ ...validBehavioralDay, focusSessions: Array.from({ length: 21 }, () => ({})) })).valid);
assert('malformed day keys are rejected', !validateAndSanitizeBackup(JSON.stringify({ days: { '11-09-2026': legacyDay } })).valid);
assert('local date uses local calendar fields', getLocalDateId(new Date(2026, 8, 11, 0, 5)) === '2026-09-11');
assert('calendar navigation crosses local month boundaries', addDaysToDateId('2026-03-01', -1) === '2026-02-28');

console.log(`Behavioral contract tests: ${passed} passed.`);
