import assert from 'node:assert/strict';
import { appendDayHistoryPage, createCachedDayHistoryPage, describeHistoryCoverage, mergeDayRecords, paginateDayHistory } from '../src/utils/dayHistory';
import { DayRecord } from '../src/types';

function record(date: string, updatedAt = `${date}T12:00:00.000Z`): DayRecord {
  return { date, updatedAt } as DayRecord;
}

function recordsBetween(start: number, end: number): Record<string, DayRecord> {
  return Object.fromEntries(Array.from({ length: end - start + 1 }, (_, index) => {
    const day = String(start + index).padStart(2, '0');
    const date = `2026-01-${day}`;
    return [date, record(date)];
  }));
}

const records = recordsBetween(1, 5);
const first = paginateDayHistory(records, { pageSize: 2 });
assert.deepEqual(Object.keys(first.records), ['2026-01-05', '2026-01-04']);
assert.equal(first.nextCursor, '2026-01-04');
assert.equal(first.complete, false);

const second = paginateDayHistory(records, { pageSize: 2, beforeDate: first.nextCursor });
assert.deepEqual(Object.keys(second.records), ['2026-01-03', '2026-01-02']);
const third = paginateDayHistory(records, { pageSize: 2, beforeDate: second.nextCursor });
assert.deepEqual(Object.keys(third.records), ['2026-01-01']);
assert.equal(third.complete, true);

const mergedPages = appendDayHistoryPage(
  appendDayHistoryPage(first.records, second.records),
  { ...third.records, '2026-01-02': record('2026-01-02', '2026-01-02T13:00:00.000Z') },
);
assert.equal(Object.keys(mergedPages).length, 5, 'pagination must not duplicate date keys or drop records');
assert.equal(mergedPages['2026-01-02'].updatedAt, '2026-01-02T13:00:00.000Z');

const bounded = paginateDayHistory(records, {
  pageSize: 10,
  beforeDate: '2026-01-05',
  fromDate: '2026-01-02',
  throughDate: '2026-01-04',
});
assert.deepEqual(Object.keys(bounded.records), ['2026-01-04', '2026-01-03', '2026-01-02']);
assert.equal(bounded.complete, true);

const empty = paginateDayHistory({}, { pageSize: 2 });
assert.deepEqual(empty.records, {});
assert.equal(empty.complete, true);
assert.equal(empty.hasMore, false);

const cachedFallback = createCachedDayHistoryPage(records, {
  pageSize: 2,
  cloudCursor: null,
  localCursor: null,
});
assert.equal(cachedFallback.source, 'cache');
assert.equal(cachedFallback.complete, false, 'a cache page cannot prove cloud history is complete');
assert.equal(cachedFallback.hasMore, true, 'unseen cloud history may exist after a read failure');
assert.equal(cachedFallback.nextLocalCursor, '2026-01-04');
assert.match(describeHistoryCoverage({ loadedCount: 2, complete: false, source: 'firestore' }), /Trends reflect this portion/);
assert.match(describeHistoryCoverage({ loadedCount: 2, complete: true, source: 'firestore' }), /Complete history loaded/);
assert.match(describeHistoryCoverage({
  loadedCount: 2, complete: false, source: 'firestore', fromDate: '2026-01-03', throughDate: '2026-01-04',
}), /Trends reflect this date range/);

const localConflict = record('2026-01-01', '2026-01-03T10:00:00.000Z');
const cloudConflict = record('2026-01-01', '2026-01-03T09:00:00.000Z');
assert.equal(mergeDayRecords({ [localConflict.date]: localConflict }, { [cloudConflict.date]: cloudConflict })[localConflict.date], localConflict);

console.log('Day history pagination, bounds, cache coverage, and merge tests passed.');
