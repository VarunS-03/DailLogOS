import type { DayMutation, DayOutboxStore } from './dayOutbox';

export type OutboxReadResult =
  | { available: true; operations: DayMutation[] }
  | { available: false; operations: null; error: unknown };

/** Keeps storage failure distinct from an empty queue; callers must not sync on failure. */
export async function readOutboxSafely(store: Pick<DayOutboxStore, 'list'>, uid: string): Promise<OutboxReadResult> {
  try {
    return { available: true, operations: await store.list(uid) };
  } catch (error) {
    return { available: false, operations: null, error };
  }
}
