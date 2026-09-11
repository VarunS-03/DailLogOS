import { CURRENT_DAY_SCHEMA_VERSION, DayRecord } from '../types';

/**
 * Normalizes persisted legacy records without writing a bulk migration.
 * `tomorrowFirstAction` is the current canonical pre-Behavioral-Core handoff
 * field; the nested reflection value is retained only as a legacy fallback.
 */
export function normalizeDayRecord(record: DayRecord): DayRecord {
  const legacyAction = record.dailyReflection?.tomorrowFirstAction?.trim() || '';
  const canonicalAction = record.tomorrowFirstAction?.trim() || legacyAction;

  return {
    ...record,
    schemaVersion: record.schemaVersion ?? 0,
    tomorrowFirstAction: canonicalAction,
  };
}

/** New records are written at the current contract version. */
export function withCurrentSchemaVersion(record: DayRecord): DayRecord {
  return { ...normalizeDayRecord(record), schemaVersion: CURRENT_DAY_SCHEMA_VERSION };
}
