import React, { useMemo, useState } from 'react';
import {
  BehavioralReview,
  CapacityMode,
  DayRecord,
  FocusSession,
  Outcome,
  RecoveryDecisionType,
} from '../../types';
import { getLocalDateId } from '../../utils/localDate';
import {
  CommitmentSignal,
  TimeContext,
  completeReview,
  decideRecovery,
  generateTomorrowHandoff,
  proposeStartDay,
  recommendNextAction,
  reviewAdjustment,
  transitionFocusSession,
  transitionOutcome,
} from '../../services/behavioral';

export function BehavioralCommandCenter({
  day,
  onUpdateDay,
}: {
  day: DayRecord;
  onUpdateDay: (day: DayRecord) => Promise<void>;
}) {
  const [capacity, setCapacity] = useState<CapacityMode>(day.dayStart?.capacityMode ?? 'normal');
  const [starting, setStarting] = useState(!day.dayStart);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [recovery, setRecovery] = useState<RecoveryDecisionType>('reduce');
  const [reason, setReason] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [formError, setFormError] = useState('');
  const [retryPatch, setRetryPatch] = useState<Partial<DayRecord> | null>(null);

  const now = new Date();
  const context: TimeContext = {
    localDate: getLocalDateId(now),
    currentMinutes: now.getHours() * 60 + now.getMinutes(),
    now: now.toISOString(),
  };

  const signals = useMemo(
    () =>
      [
        day.academics.objective && {
          id: 'academics',
          domain: 'academics' as const,
          title: day.academics.objective,
          minimumOutput: day.academics.output || 'Record what moved forward',
          kind: 'due_learning' as const,
        },
        day.dsa[0]?.problem && {
          id: day.dsa[0].id,
          domain: 'dsa' as const,
          title: day.dsa[0].problem,
          minimumOutput: day.dsa[0].insight || 'Write the invariant',
          kind: 'due_learning' as const,
        },
        day.project.nextAction && {
          id: 'project',
          domain: 'project' as const,
          title: day.project.nextAction,
          minimumOutput: day.project.artifact || 'Record the artifact',
          kind: day.project.blocker ? 'unblock' as const : 'project' as const,
        },
        day.workout.cycleDay && {
          id: 'workout',
          domain: 'workout' as const,
          title: day.workout.cycleDay,
          minimumOutput: 'Log workout',
          kind: 'workout' as const,
        },
      ].filter(Boolean) as CommitmentSignal[],
    [day],
  );

  const outcomes = day.outcomes ?? [];
  const recommendation = recommendNextAction({
    outcomes,
    signals,
    handoff: day.tomorrowHandoff,
    context,
  });

  const save = async (patch: Partial<DayRecord>) => {
    if (saveState === 'saving') return;

    setSaveState('saving');
    setSaveError('');
    setFormError('');
    setRetryPatch(patch);

    try {
      await onUpdateDay({ ...day, ...patch });
      setSaveState('idle');
      setRetryPatch(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save. Try again.";

      setSaveState('error');
      setSaveError(message);
    }
  };

  const commit = () => {
    const proposed = proposeStartDay({
      capacity,
      signals,
      handoff: day.tomorrowHandoff,
      context,
      createdAt: context.now,
    });

    void save({
      dayStart: {
        date: day.date,
        startedAt: context.now,
        acceptedAt: context.now,
        capacityMode: capacity,
        firstAction: proposed[0]?.title ?? '',
      },
      outcomes: proposed,
    });

    setStarting(false);
  };

  const start = (outcome: Outcome) => {
    const next = transitionOutcome(outcome, 'active');
    if (next.ok === false) {
      setFormError(next.message);
      return;
    }

    const session: FocusSession = {
      id: `focus-${Date.now()}`,
      outcomeId: outcome.id,
      objective: outcome.title,
      minimumOutput: outcome.minimumOutput,
      startedAt: context.now,
      status: 'active',
    };

    void save({
      outcomes: outcomes.map((item) => (item.id === outcome.id ? next.value : item)),
      focusSessions: [...(day.focusSessions ?? []), session],
    });

    setActiveId(outcome.id);
    setText('');
    setFormError('');
  };

  const resolve = (status: 'completed' | 'partial' | 'blocked' | 'abandoned') => {
    const session = [...(day.focusSessions ?? [])]
      .reverse()
      .find((item) => item.outcomeId === activeId && item.status === 'active');

    const outcome = outcomes.find((item) => item.id === activeId);

    if (!session || !outcome) {
      setFormError('There is no active focus session to resolve.');
      return;
    }

    const nextSession = transitionFocusSession(session, status, {
      endedAt: context.now,
      output: text,
      isPhysicalActivity: outcome.domain === 'workout',
    });

    const nextOutcome = transitionOutcome(outcome, status, context.now);

    if (nextSession.ok === false) {
      setFormError(nextSession.message);
      return;
    }

    if (nextOutcome.ok === false) {
      setFormError(nextOutcome.message);
      return;
    }

    void save({
      outcomes: outcomes.map((item) => (item.id === outcome.id ? nextOutcome.value : item)),
      focusSessions: (day.focusSessions ?? []).map((item) =>
        item.id === session.id ? nextSession.value : item,
      ),
    });

    setActiveId(null);
    setFormError('');
  };

  const handoff = () => {
    const review =
      day.behavioralReview ?? {
        movedForward: text || 'Reviewed day',
        failureReasons: [],
        adjustment: 'define_first_action_before_start',
        reviewComplete: true,
      };

    const result = generateTomorrowHandoff({
      createdAt: context.now,
      review,
      outcomes,
      recoveryDecisions: day.recoveryDecisions ?? [],
      firstAction: text,
    });

    if (result.ok === false) {
      setFormError(result.message);
      return;
    }

    if (!result.value) {
      setFormError('Tomorrow needs one concrete first action.');
      return;
    }

    void save({
      tomorrowHandoff: result.value,
      tomorrowFirstAction: result.value.firstAction,
    });
  };

  const recover = (outcome: Outcome) => {
    const result = decideRecovery({
      id: `recovery-${Date.now()}`,
      outcomeId: outcome.id,
      type: recovery,
      reason: reason || 'Plan adjusted',
      newScope: recovery === 'reduce' ? reason : undefined,
      nextAction: recovery === 'rescue' || recovery === 'blocked' ? reason : undefined,
      scheduleWindowId: recovery === 'reschedule' ? 'later' : undefined,
      createdAt: context.now,
    });

    if (result.ok === false) {
      setFormError(result.message);
      return;
    }

    void save({
      recoveryDecisions: [...(day.recoveryDecisions ?? []), result.value],
    });
    setFormError('');
  };

  const review = () => {
    const value: BehavioralReview = {
      completedAt: context.now,
      movedForward: text || 'Reviewed day',
      failureReasons: reason ? ['unclear_next_action'] : [],
      adjustment: reason ? reviewAdjustment('unclear_next_action') : 'define_first_action_before_start',
      reviewComplete: true,
    };

    const result = completeReview(value);
    if (result.ok === false) {
      setFormError(result.message);
      return;
    }

    void save({ behavioralReview: value });
    setReviewOpen(false);
    setFormError('');
  };

  return (
    <section className="space-y-3" aria-label="Today command center">
      <div className="rounded-xl border border-cyan-900/60 bg-[#101722] p-4">
        <p className="text-xs font-mono text-cyan-300">
          {day.dayStart ? `READY · ${day.dayStart.capacityMode.toUpperCase()}` : 'NOT STARTED'}
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          {recommendation?.firstAction ?? 'Start with one useful action'}
        </h2>
        <p className="text-xs text-zinc-400">{recommendation?.reason}</p>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          <div>{saveError}</div>
          {retryPatch && (
            <button
              type="button"
              onClick={() => void save(retryPatch)}
              className="mt-2 text-xs font-medium text-red-100 underline underline-offset-2"
            >
              Retry save
            </button>
          )}
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-100">
          {formError}
        </div>
      )}

      {starting && (
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-sm">Today’s focus</p>
          <div className="mt-2 flex gap-2">
            {(['normal', 'reduced', 'minimum'] as CapacityMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCapacity(mode)}
                className={`rounded px-3 py-1 text-xs ${
                  capacity === mode ? 'bg-cyan-700 text-white' : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={commit}
            disabled={saveState === 'saving'}
            className="mt-3 rounded bg-cyan-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {saveState === 'saving' ? 'Saving...' : 'Commit outcomes'}
          </button>
        </div>
      )}

      {outcomes.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
          <span>
            {item.title} <small className="text-zinc-500">· {item.status}</small>
          </span>
          {item.status === 'planned' && (
            <button type="button" onClick={() => start(item)} className="text-cyan-300">
              Start
            </button>
          )}
          {['partial', 'blocked', 'missed', 'abandoned'].includes(item.status) && (
            <button type="button" onClick={() => recover(item)} className="text-amber-300">
              Recover
            </button>
          )}
        </div>
      ))}

      {activeId && (
        <div className="rounded-xl border border-cyan-900 p-4">
          <label className="block text-sm text-zinc-200">
            Observable output
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="mt-2 w-full bg-[#090b10] p-2 text-zinc-100 outline-none ring-0"
              placeholder="What changed, what moved forward, or what blocked you?"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['completed', 'partial', 'blocked', 'abandoned'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => resolve(status)}
                className="rounded bg-cyan-700 px-2 py-1 text-xs text-white"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-900/50 p-3">
        <p className="text-sm">Recovery: choose the next useful move</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            value={recovery}
            onChange={(event) => setRecovery(event.target.value as RecoveryDecisionType)}
            className="rounded bg-[#090b10] px-2 py-1 text-sm text-zinc-100"
          >
            <option value="reduce">Reduce scope</option>
            <option value="rescue">Rescue</option>
            <option value="reschedule">Reschedule</option>
            <option value="drop">Drop</option>
            <option value="blocked">Blocked</option>
          </select>

          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-w-0 flex-1 rounded bg-[#090b10] px-2 py-1 text-sm text-zinc-100 outline-none"
            placeholder="Reason, scope, or next action"
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => setReviewOpen((value) => !value)}
          className="text-xs text-cyan-300"
        >
          {reviewOpen ? 'Close review' : 'Review day'}
        </button>

        {reviewOpen && (
          <div className="mt-3 space-y-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full bg-[#090b10] p-2 text-sm text-zinc-100"
              placeholder="What moved forward today?"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded bg-[#090b10] px-2 py-1 text-sm text-zinc-100"
              placeholder="Describe the adjustment or blocker"
            />
            <button
              type="button"
              onClick={review}
              className="rounded bg-cyan-700 px-3 py-2 text-sm text-white"
            >
              Save review
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handoff}
          className="rounded border border-cyan-700 px-3 py-2 text-xs text-cyan-300"
        >
          Prepare handoff
        </button>
      </div>

      {saveState === 'saving' && (
        <div className="text-xs text-cyan-300">Saving behavioral state…</div>
      )}
    </section>
  );
}
