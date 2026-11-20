import { DayRecord } from '../types';

export const DEFAULT_HISTORY_PAGE_SIZE = 180;

export type DayHistorySource = 'firestore' | 'cache' | 'local';

export interface DayHistoryPage {
  records: Record<string, DayRecord>;
  nextCursor: string | null;
  nextLocalCursor: string | null;
  hasMore: boolean;
  complete: boolean;
  source: DayHistorySource;
  /** False when cloud history loaded but local pending edits could not be inspected. */
  outboxAvailable?: boolean;
}

export interface DayHistoryPageOptions {
  pageSize?: number;
  beforeDate?: string | null;
  fromDate?: string | null;
  throughDate?: string | null;
}

function updatedAtMillis(record: DayRecord): number {
  const timestamp = Date.parse(record.updatedAt);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function mergeDayRecords(
  localRecords: Record<string, DayRecord>,
  cloudRecords: Record<string, DayRecord>
): Record<string, DayRecord> {
  const merged = { ...localRecords };
  for (const [date, cloudRecord] of Object.entries(cloudRecords)) {
    const localRecord = localRecords[date];
    merged[date] = localRecord && updatedAtMillis(localRecord) > updatedAtMillis(cloudRecord)
      ? localRecord
      : cloudRecord;
  }
  return merged;
}

/** Returns one descending, deduplicated page from an already available record set. */
export function paginateDayHistory(
  records: Record<string, DayRecord>,
  options: DayHistoryPageOptions = {},
): DayHistoryPage {
  const pageSize = options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('The history page size must be between 1 and 500.');
  }

  const ordered = Object.entries(records)
    .filter(([date, record]) =>
      record.date === date &&
      (!options.beforeDate || date < options.beforeDate) &&
      (!options.fromDate || date >= options.fromDate) &&
      (!options.throughDate || date <= options.throughDate),
    )
    .sort(([left], [right]) => right.localeCompare(left));
  const rows = ordered.slice(0, pageSize);
  const hasMore = ordered.length > rows.length;
  const pageRecords = Object.fromEntries(rows);

  return {
    records: pageRecords,
    nextCursor: hasMore ? rows[rows.length - 1]?.[0] ?? null : null,
    nextLocalCursor: null,
    hasMore,
    complete: !hasMore,
    source: 'local',
  };
}

/** Cached records cannot prove that cloud history is complete. */
export function createCachedDayHistoryPage(
  records: Record<string, DayRecord>,
  options: DayHistoryPageOptions & {
    cloudCursor?: string | null;
    localCursor?: string | null;
  } = {},
): DayHistoryPage {
  const page = paginateDayHistory(records, {
    pageSize: options.pageSize,
    beforeDate: options.localCursor ?? options.beforeDate,
    fromDate: options.fromDate,
    throughDate: options.throughDate,
  });
  return {
    ...page,
    source: 'cache',
    nextCursor: options.cloudCursor ?? options.beforeDate ?? null,
    nextLocalCursor: page.nextCursor ?? options.localCursor ?? options.beforeDate ?? null,
    hasMore: true,
    complete: false,
  };
}

/** Use the returned cursor to fetch the next page, then merge by date to avoid duplicates. */
export function appendDayHistoryPage(
  loaded: Record<string, DayRecord>,
  page: Record<string, DayRecord>,
): Record<string, DayRecord> {
  return { ...loaded, ...page };
}

export function describeHistoryCoverage(input: {
  loadedCount: number;
  complete: boolean;
  source: DayHistorySource;
  fromDate?: string | null;
  throughDate?: string | null;
}): string {
  if (input.fromDate || input.throughDate) {
    const start = input.fromDate ?? 'the earliest date';
    const end = input.throughDate ?? 'the latest date';
    return `Showing ${input.loadedCount} records from ${start} through ${end}. Trends reflect this date range.`;
  }
  if (input.complete) return `Complete history loaded (${input.loadedCount} records).`;
  if (input.source === 'cache') {
    return `Showing ${input.loadedCount} cached records from this device. Cloud history may include more; reconnect and retry to continue.`;
  }
  if (input.source === 'local') {
    return `Showing ${input.loadedCount} loaded guest records. Trends reflect this loaded portion of local history.`;
  }
  return `Showing ${input.loadedCount} loaded records. Trends reflect this portion of history until older records are loaded.`;
}
