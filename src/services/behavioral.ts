import {
  BehavioralDomain,
  BehavioralReview,
  CapacityMode,
  CreditEvent,
  DayRecord,
  FocusSession,
  FocusSessionStatus,
  Outcome,
  OutcomeSource,
  OutcomeStatus,
  RecoveryDecision,
  RecoveryDecisionType,
  TomorrowHandoff,
} from '../types';

export interface DomainFailure { ok: false; code: string; message: string; }
export interface DomainSuccess<T> { ok: true; value: T; }
export type DomainResult<T> = DomainSuccess<T> | DomainFailure;

export interface TimeWindow { id: string; startMinutes: number; endMinutes: number; }
export interface TimeContext { localDate: string; currentMinutes: number; windows?: TimeWindow[]; now: string; }
export interface CommitmentSignal {
  id: string;
  domain: BehavioralDomain;
  title: string;
  minimumOutput: string;
  kind: 'time_sensitive' | 'due_learning' | 'unblock' | 'project' | 'workout' | 'user';
  priority?: number;
  windowId?: string;
  createdAt?: string;
}
export interface Recommendation { outcomeId?: string; signalId?: string; firstAction: string; reason: string; }

const MAX_OPEN_OUTCOMES = 3;
const OPEN_OUTCOME_STATUSES: OutcomeStatus[] = ['planned', 'active', 'blocked'];
const TRANSITIONS: Record<OutcomeStatus, OutcomeStatus[]> = {
  planned: ['active', 'dropped', 'missed'], active: ['completed', 'partial', 'blocked', 'abandoned'],
  completed: [], partial: ['active', 'dropped', 'missed'], blocked: ['active', 'dropped', 'missed'],
  missed: ['active', 'dropped'], abandoned: ['active', 'dropped', 'missed'], dropped: [],
};
const SESSION_TRANSITIONS: Record<FocusSessionStatus, FocusSessionStatus[]> = {
  active: ['completed', 'partial', 'blocked', 'abandoned'], completed: [], partial: [], blocked: [], abandoned: [],
};

export function isOpenOutcome(outcome: Outcome): boolean { return OPEN_OUTCOME_STATUSES.includes(outcome.status); }
export function canAddOpenOutcome(outcomes: Outcome[], replacingId?: string): DomainResult<true> {
  const openCount = outcomes.filter((outcome) => isOpenOutcome(outcome) && outcome.id !== replacingId).length;
  return openCount < MAX_OPEN_OUTCOMES
    ? { ok: true, value: true }
    : { ok: false, code: 'MAX_ACTIVE_OUTCOMES', message: 'A maximum of three active outcomes is allowed.' };
}
export function transitionOutcome(outcome: Outcome, target: OutcomeStatus, resolvedAt?: string): DomainResult<Outcome> {
  if (!TRANSITIONS[outcome.status].includes(target)) return { ok: false, code: 'INVALID_OUTCOME_TRANSITION', message: `Cannot transition ${outcome.status} to ${target}.` };
  return { ok: true, value: { ...outcome, status: target, resolvedAt: ['completed', 'partial', 'blocked', 'missed', 'abandoned', 'dropped'].includes(target) ? resolvedAt : undefined } };
}
export function replaceOutcome(outcomes: Outcome[], replacingId: string, replacement: Outcome): DomainResult<Outcome[]> {
  if (!outcomes.some((outcome) => outcome.id === replacingId)) return { ok: false, code: 'OUTCOME_NOT_FOUND', message: 'The outcome to replace was not found.' };
  const limit = canAddOpenOutcome(outcomes, replacingId);
  if (!limit.ok) return { ok: false, code: 'MAX_ACTIVE_OUTCOMES', message: 'A maximum of three active outcomes is allowed.' };
  return { ok: true, value: outcomes.map((outcome) => outcome.id === replacingId ? replacement : outcome) };
}

function activeWindow(signal: CommitmentSignal, context: TimeContext): TimeWindow | undefined {
  return context.windows?.find((window) => window.id === signal.windowId && context.currentMinutes >= window.startMinutes && context.currentMinutes < window.endMinutes);
}
function categoryRank(signal: CommitmentSignal, context: TimeContext): number {
  if (signal.kind === 'time_sensitive' && activeWindow(signal, context)) return 1;
  return ({ due_learning: 2, unblock: 3, project: 4, workout: 5, user: 6, time_sensitive: 6 } as const)[signal.kind];
}
function compareSignals(a: CommitmentSignal, b: CommitmentSignal, context: TimeContext): number {
  const rank = categoryRank(a, context) - categoryRank(b, context);
  if (rank) return rank;
  const windowStart = (signal: CommitmentSignal) => context.windows?.find((window) => window.id === signal.windowId)?.startMinutes ?? Number.MAX_SAFE_INTEGER;
  const window = windowStart(a) - windowStart(b); if (window) return window;
  const priority = (a.priority ?? 3) - (b.priority ?? 3); if (priority) return priority;
  const scope = a.minimumOutput.length - b.minimumOutput.length; if (scope) return scope;
  const age = (a.createdAt ?? '').localeCompare(b.createdAt ?? ''); if (age) return age;
  return a.id.localeCompare(b.id);
}
export function recommendNextAction(input: { outcomes: Outcome[]; signals: CommitmentSignal[]; handoff?: TomorrowHandoff; context: TimeContext }): Recommendation | null {
  const { outcomes, signals, handoff, context } = input;
  if (handoff?.firstAction.trim()) return { outcomeId: handoff.carryForwardOutcomeId, firstAction: handoff.firstAction, reason: `Your handoff for today is to ${handoff.firstAction}.` };
  const openOutcomes = outcomes.filter(isOpenOutcome);
  const outcomeSignals: CommitmentSignal[] = openOutcomes.map((outcome) => ({ id: outcome.id, domain: outcome.domain, title: outcome.title, minimumOutput: outcome.minimumOutput, kind: outcome.source === 'user' ? 'user' : 'due_learning', priority: outcome.priority, createdAt: outcome.createdAt }));
  const candidate = [...signals, ...outcomeSignals].sort((a, b) => compareSignals(a, b, context))[0];
  if (!candidate) return null;
  return { outcomeId: openOutcomes.find((outcome) => outcome.id === candidate.id)?.id, signalId: candidate.id, firstAction: candidate.title, reason: `${candidate.title} is the highest-priority useful action available now.` };
}

export function maxOutcomesForCapacity(capacity: CapacityMode): number { return capacity === 'normal' ? 3 : capacity === 'reduced' ? 2 : 1; }
export function minimumViableDay(capacity: CapacityMode, signals: CommitmentSignal[]): { maxOutcomes: number; suggestedSignals: CommitmentSignal[]; requiresReview: boolean; requiresHandoff: boolean } {
  const limit = maxOutcomesForCapacity(capacity);
  return { maxOutcomes: limit, suggestedSignals: signals.slice(0, limit), requiresReview: true, requiresHandoff: true };
}
export function proposeStartDay(input: { capacity: CapacityMode; signals: CommitmentSignal[]; handoff?: TomorrowHandoff; context: TimeContext; createdAt: string }): Outcome[] {
  const limit = maxOutcomesForCapacity(input.capacity);
  const sorted = [...input.signals].sort((a, b) => compareSignals(a, b, input.context));
  const proposal: CommitmentSignal[] = input.handoff?.firstAction
    ? [{ id: input.handoff.carryForwardOutcomeId ?? 'handoff', domain: 'other', title: input.handoff.firstAction, minimumOutput: input.handoff.firstAction, kind: 'user', priority: 1 }, ...sorted]
    : sorted;
  const seen = new Set<string>();
  return proposal.filter((signal) => !seen.has(signal.id) && Boolean(seen.add(signal.id))).slice(0, limit).map((signal, index) => ({
    id: `proposal-${signal.id}`, domain: signal.domain, domainEntityId: signal.id, title: signal.title, minimumOutput: signal.minimumOutput,
    priority: Math.min(index + 1, 3), status: 'planned', source: signal.id === 'handoff' ? 'handoff' : sourceForSignal(signal), createdAt: input.createdAt,
  }));
}
function sourceForSignal(signal: CommitmentSignal): OutcomeSource { return signal.kind === 'user' ? 'user' : signal.kind === 'time_sensitive' ? 'schedule' : 'domain'; }

export function transitionFocusSession(session: FocusSession, target: FocusSessionStatus, input: { endedAt: string; output?: string; isPhysicalActivity?: boolean }): DomainResult<FocusSession> {
  if (!SESSION_TRANSITIONS[session.status].includes(target)) return { ok: false, code: 'INVALID_SESSION_TRANSITION', message: `Cannot transition ${session.status} to ${target}.` };
  if ((target === 'completed' || target === 'partial') && !input.isPhysicalActivity && !input.output?.trim()) return { ok: false, code: 'OUTPUT_REQUIRED', message: 'Completed or partial sessions require observable output.' };
  return { ok: true, value: { ...session, status: target, endedAt: input.endedAt, output: input.output?.trim() || undefined } };
}

export function decideRecovery(input: Omit<RecoveryDecision, 'id' | 'createdAt'> & { id: string; createdAt: string }): DomainResult<RecoveryDecision> {
  const actionRequired = input.type === 'rescue' || input.type === 'blocked';
  if (!input.reason.trim()) return { ok: false, code: 'RECOVERY_REASON_REQUIRED', message: 'A recovery reason is required.' };
  if (actionRequired && !input.nextAction?.trim()) return { ok: false, code: 'RECOVERY_ACTION_REQUIRED', message: `${input.type} recovery requires a concrete next action.` };
  if (input.type === 'reschedule' && !input.scheduleWindowId) return { ok: false, code: 'RECOVERY_WINDOW_REQUIRED', message: 'Rescheduling requires a realistic window.' };
  if (input.type === 'reduce' && !input.newScope?.trim()) return { ok: false, code: 'RECOVERY_SCOPE_REQUIRED', message: 'Reducing requires a smaller scope.' };
  return { ok: true, value: input };
}

export function reviewAdjustment(reason: BehavioralReview['failureReasons'][number]): string {
  return ({ underestimated_difficulty: 'reduce_scope_or_reserve_more_time', avoidance: 'define_smaller_first_action', poor_planning: 'reduce_planned_load', interruption: 'choose_realistic_window', low_energy: 'use_reduced_or_minimum_mode', unclear_next_action: 'define_first_action_before_start', dependency_blocker: 'schedule_unblock_action', overcommitment: 'limit_active_outcomes', unexpected_work: 'replace_lower_priority_outcome' })[reason];
}
export function completeReview(review: BehavioralReview): DomainResult<BehavioralReview> {
  if (!review.reviewComplete || !review.movedForward.trim() || !review.adjustment.trim()) return { ok: false, code: 'INCOMPLETE_REVIEW', message: 'A completed review needs what moved forward and a tomorrow adjustment.' };
  return { ok: true, value: review };
}
export function generateTomorrowHandoff(input: { createdAt: string; review: BehavioralReview; outcomes: Outcome[]; recoveryDecisions: RecoveryDecision[]; firstAction?: string; note?: string; explicitSkip?: boolean }): DomainResult<TomorrowHandoff | null> {
  if (input.explicitSkip) return { ok: true, value: null };
  const latestRecovery = [...input.recoveryDecisions].reverse().find((decision) => decision.nextAction?.trim());
  const carry = input.outcomes.find((outcome) => outcome.status === 'partial' || outcome.status === 'blocked');
  const firstAction = input.firstAction?.trim() || latestRecovery?.nextAction?.trim() || (carry ? `${carry.title}: ${carry.minimumOutput}` : '');
  if (!firstAction) return { ok: false, code: 'HANDOFF_ACTION_REQUIRED', message: 'Tomorrow needs one concrete first action or an explicit skip.' };
  return { ok: true, value: { createdAt: input.createdAt, firstAction, carryForwardOutcomeId: carry?.id, blockerAction: latestRecovery?.type === 'blocked' ? latestRecovery.nextAction : undefined, adjustment: input.review.failureReasons[0] ? reviewAdjustment(input.review.failureReasons[0]) : input.review.adjustment, note: input.note?.trim() || undefined } };
}
export function creditForSession(session: FocusSession, createdAt: string): CreditEvent | null {
  if ((session.status !== 'completed' && session.status !== 'partial') || !session.output?.trim()) return null;
  return { id: `credit-${session.id}`, type: session.status === 'completed' ? 'output' : 'partial_output', sourceId: session.id, createdAt, note: session.output };
}
export function dayBehavioralSnapshot(day: DayRecord): Pick<DayRecord, 'outcomes' | 'focusSessions' | 'recoveryDecisions' | 'behavioralReview' | 'tomorrowHandoff'> { return day; }
