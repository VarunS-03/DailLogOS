import { Outcome, FocusSession, BehavioralReview } from '../src/types';
import { canAddOpenOutcome, completeReview, decideRecovery, generateTomorrowHandoff, maxOutcomesForCapacity, minimumViableDay, proposeStartDay, recommendNextAction, replaceOutcome, transitionFocusSession, transitionOutcome } from '../src/services/behavioral';

let passed = 0;
function assert(name: string, condition: boolean): void { if (!condition) throw new Error(`FAIL: ${name}`); passed++; }
const context = { localDate: '2026-09-11', currentMinutes: 600, now: '2026-09-11T10:00:00.000Z', windows: [{ id: 'now', startMinutes: 540, endMinutes: 660 }] };
const outcome = (id: string, status: Outcome['status'] = 'planned'): Outcome => ({ id, domain: 'academics', title: `Task ${id}`, minimumOutput: 'Submit result', priority: 1, status, source: 'domain', createdAt: '2026-09-10T08:00:00.000Z' });

assert('planned outcome activates', transitionOutcome(outcome('1'), 'active', context.now).ok);
assert('planned outcome cannot complete directly', !transitionOutcome(outcome('1'), 'completed', context.now).ok);
assert('zero through three open outcomes are allowed', canAddOpenOutcome([]).ok && canAddOpenOutcome([outcome('1')]).ok && canAddOpenOutcome([outcome('1'), outcome('2')]).ok);
assert('fourth open outcome is rejected', !canAddOpenOutcome([outcome('1'), outcome('2'), outcome('3')]).ok);
assert('replacement excludes the replaced commitment from limit', replaceOutcome([outcome('1'), outcome('2'), outcome('3')], '1', outcome('4')).ok);
assert('completed commitment frees capacity', canAddOpenOutcome([outcome('1', 'completed'), outcome('2'), outcome('3')]).ok);

const signals = [
  { id: 'workout', domain: 'workout' as const, title: 'Workout', minimumOutput: 'Log sets', kind: 'workout' as const },
  { id: 'window', domain: 'academics' as const, title: 'Class deadline', minimumOutput: 'Submit', kind: 'time_sensitive' as const, windowId: 'now' },
  { id: 'project', domain: 'project' as const, title: 'Project fix', minimumOutput: 'Commit', kind: 'project' as const },
];
assert('handoff wins priority', recommendNextAction({ outcomes: [], signals, context, handoff: { createdAt: context.now, firstAction: 'Open linked list notes' } })?.firstAction === 'Open linked list notes');
assert('current time-sensitive signal wins without handoff', recommendNextAction({ outcomes: [], signals, context })?.signalId === 'window');
assert('priority is deterministic', recommendNextAction({ outcomes: [], signals, context })?.signalId === recommendNextAction({ outcomes: [], signals, context })?.signalId);
assert('due learning outranks unblock, project, workout, and user work', recommendNextAction({ outcomes: [], context, signals: [
  { id: 'user', domain: 'other', title: 'User item', minimumOutput: 'Done', kind: 'user' }, { id: 'workout', domain: 'workout', title: 'Workout', minimumOutput: 'Log', kind: 'workout' },
  { id: 'project', domain: 'project', title: 'Project', minimumOutput: 'Commit', kind: 'project' }, { id: 'unblock', domain: 'project', title: 'Unblock', minimumOutput: 'Request', kind: 'unblock' },
  { id: 'dsa', domain: 'dsa', title: 'Due DSA', minimumOutput: 'Invariant', kind: 'due_learning' },
] })?.signalId === 'dsa');
assert('late time-sensitive work falls back to deterministic hierarchy', recommendNextAction({ outcomes: [], signals, context: { ...context, currentMinutes: 700 } })?.signalId === 'project');
assert('earlier window breaks equal category ties', recommendNextAction({ outcomes: [], context: { ...context, windows: [{ id: 'early', startMinutes: 700, endMinutes: 800 }, { id: 'late', startMinutes: 900, endMinutes: 1000 }] }, signals: [
  { id: 'late', domain: 'academics', title: 'Late', minimumOutput: 'A', kind: 'due_learning', windowId: 'late' }, { id: 'early', domain: 'academics', title: 'Early', minimumOutput: 'A', kind: 'due_learning', windowId: 'early' },
] })?.signalId === 'early');
assert('capacity limits are explicit', maxOutcomesForCapacity('normal') === 3 && maxOutcomesForCapacity('reduced') === 2 && maxOutcomesForCapacity('minimum') === 1);
assert('start proposal honors minimum capacity', proposeStartDay({ capacity: 'minimum', signals, context, createdAt: context.now }).length === 1);
assert('start proposal honors normal and reduced capacity', proposeStartDay({ capacity: 'normal', signals, context, createdAt: context.now }).length === 3 && proposeStartDay({ capacity: 'reduced', signals, context, createdAt: context.now }).length === 2);
assert('minimum viable day preserves review and handoff', minimumViableDay('minimum', signals).requiresReview && minimumViableDay('minimum', signals).requiresHandoff);

const session: FocusSession = { id: 's1', objective: 'Solve', minimumOutput: 'Invariant', startedAt: context.now, status: 'active' };
assert('completed non-physical session requires output', !transitionFocusSession(session, 'completed', { endedAt: context.now }).ok);
assert('partial session with output succeeds', transitionFocusSession(session, 'partial', { endedAt: context.now, output: 'Wrote invariant' }).ok);
assert('physical completion allows no text output', transitionFocusSession(session, 'completed', { endedAt: context.now, isPhysicalActivity: true }).ok);
assert('reschedule requires window', !decideRecovery({ id: 'r1', type: 'reschedule', reason: 'Interrupted', createdAt: context.now }).ok);
assert('reduce requires scope', !decideRecovery({ id: 'r1', type: 'reduce', reason: 'Low energy', createdAt: context.now }).ok);
assert('blocked recovery needs concrete unblock action', decideRecovery({ id: 'r1', type: 'blocked', reason: 'Waiting on API', nextAction: 'Ask owner for API key', createdAt: context.now }).ok);
assert('rescue, reduce, reschedule, and drop are valid deliberate recoveries', decideRecovery({ id: 'r2', type: 'rescue', reason: 'Late start', nextAction: 'Write one test', createdAt: context.now }).ok && decideRecovery({ id: 'r3', type: 'reduce', reason: 'Low energy', newScope: 'One section', createdAt: context.now }).ok && decideRecovery({ id: 'r4', type: 'reschedule', reason: 'Class', scheduleWindowId: 'now', createdAt: context.now }).ok && decideRecovery({ id: 'r5', type: 'drop', reason: 'No longer relevant', createdAt: context.now }).ok);

const review: BehavioralReview = { completedAt: context.now, movedForward: 'Solved deletion cases', failureReasons: ['unclear_next_action'], adjustment: 'define_first_action_before_start', reviewComplete: true };
assert('complete review validates loop input', completeReview(review).ok);
assert('review plus partial work creates one handoff action', generateTomorrowHandoff({ createdAt: context.now, review, outcomes: [{ ...outcome('carry', 'partial'), title: 'Linked list', minimumOutput: 'Reimplement deletion' }], recoveryDecisions: [] }).ok);
assert('handoff can be explicitly skipped', generateTomorrowHandoff({ createdAt: context.now, review, outcomes: [], recoveryDecisions: [], explicitSkip: true }).ok);

console.log(`Behavioral service tests: ${passed} passed.`);
