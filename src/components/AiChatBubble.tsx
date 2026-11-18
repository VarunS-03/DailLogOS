import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  BookOpen,
  Code2,
  Calendar,
  X,
  Terminal,
  KeyRound,
} from 'lucide-react';
import { hasGeminiKey, parseNaturalLanguageLog, NaturalInputParsed, setGeminiApiKey } from '../services/ai';
import { reportAiFailure } from '../services/aiDiagnostics';
import { AppCustomizationResult, customizeAppFromCommand } from '../services/appCustomization';
import {
  DASHBOARD_WIDGET_REGISTRY,
  getSystemConfiguration,
  SYSTEM_MODULE_REGISTRY,
} from '../services/systemConfiguration';
import { DayRecord, DsaProblem, ScheduleItem, UserSettings, UserSystemConfiguration } from '../types';

interface PendingCustomizationProposal {
  result: AppCustomizationResult;
  baseDay: DayRecord;
  baseSettings: {
    defaultWorkoutMode: UserSettings['defaultWorkoutMode'];
    dailySystem: UserSettings['dailySystem'];
    systemConfiguration: UserSystemConfiguration;
  };
}

interface AiChatBubbleProps {
  day: DayRecord;
  onUpdateDay: (updatedDay: DayRecord, baseDay?: DayRecord) => Promise<void>;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => Promise<void>;
  initiallyOpen?: boolean;
  onInitialOpenConsumed?: () => void;
}

export const AiChatBubble: React.FC<AiChatBubbleProps> = ({
  day,
  onUpdateDay,
  settings,
  onUpdateSettings,
  initiallyOpen = false,
  onInitialOpenConsumed,
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [mode, setMode] = useState<'customize' | 'log'>('customize');
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [keyConnected, setKeyConnected] = useState(() => hasGeminiKey());
  const [showKeyForm, setShowKeyForm] = useState(() => !hasGeminiKey());
  const [proposal, setProposal] = useState<PendingCustomizationProposal | null>(null);

  React.useEffect(() => {
    if (initiallyOpen) onInitialOpenConsumed?.();
  }, [initiallyOpen, onInitialOpenConsumed]);

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyDraft.trim()) return;
    setGeminiApiKey(apiKeyDraft);
    setApiKeyDraft('');
    setKeyConnected(true);
    setShowKeyForm(false);
    setFeedback('Gemini connected. Your key is stored in this browser.');
    setIsError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);
    setIsError(false);

    try {
      const parsed: NaturalInputParsed = await parseNaturalLanguageLog(query);

      if (parsed.type === 'dsa') {
        const newProblem: DsaProblem = {
          id: `dsa-ai-${Date.now()}`,
          problem: parsed.data.problem,
          platform: parsed.data.platform,
          difficulty: parsed.data.difficulty,
          pattern: parsed.data.pattern,
          firstIdea: '',
          solvedIndependently: parsed.data.solvedIndependently,
          failureMistake: '',
          insight: 'Logged via Quick AI assistant',
          algorithm: '',
          timeComplexity: '',
          spaceComplexity: '',
          reimplemented: false,
          reviewDate: '',
          tags: ['Classify'],
        };

        const updatedDsa = [...(day.dsa || []), newProblem];
        await onUpdateDay({ ...day, dsa: updatedDsa }, day);
        setFeedback(`Logged "${newProblem.problem}" into DSA Practice!`);
      } else if (parsed.type === 'schedule') {
        const newSched: ScheduleItem = {
          id: `sched-ai-${Date.now()}`,
          time: 'Flexible',
          title: parsed.data.note,
          category: 'other',
          status: 'completed',
        };
        const updatedSched = [...(day.schedule || []), newSched];
        await onUpdateDay({ ...day, schedule: updatedSched }, day);
        setFeedback(`Added block: "${newSched.title}" to today's schedule!`);
      } else {
        // Fallback note in reflection
        const currentNotes = day.notes ? `${day.notes}\n• ${query}` : `• ${query}`;
        await onUpdateDay({ ...day, notes: currentNotes }, day);
        setFeedback(`Saved into today's journal!`);
      }

      setQuery('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      reportAiFailure('quick log parsing', err, console.error);
      setIsError(true);
      setFeedback('Could not save this log. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);
    setIsError(false);
    try {
      const currentConfiguration = getSystemConfiguration(settings.systemConfiguration);
      const result = await customizeAppFromCommand(query, day, currentConfiguration);
      setProposal({
        result,
        baseDay: structuredClone(day),
        baseSettings: structuredClone({
          defaultWorkoutMode: settings.defaultWorkoutMode,
          dailySystem: settings.dailySystem,
          systemConfiguration: currentConfiguration,
        }),
      });
    } catch (error) {
      reportAiFailure('customization proposal', error, console.error);
      setIsError(true);
      setFeedback('Gemini could not prepare a valid proposal. Your data was not changed. Try again or use the offline workflow.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyProposal = async () => {
    if (!proposal || isProcessing) return;
    const currentConfiguration = getSystemConfiguration(settings.systemConfiguration);
    const currentSettingsSnapshot = {
      defaultWorkoutMode: settings.defaultWorkoutMode,
      dailySystem: settings.dailySystem,
      systemConfiguration: currentConfiguration,
    };
    if (
      JSON.stringify(day) !== JSON.stringify(proposal.baseDay)
      || JSON.stringify(currentSettingsSnapshot) !== JSON.stringify(proposal.baseSettings)
    ) {
      setProposal(null);
      setIsError(true);
      setFeedback('Your day or settings changed while this proposal was open. Generate a fresh proposal before applying changes.');
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    setIsError(false);
    try {
      const updatedDay = applyCustomizationToDay(day, proposal.result);
      await onUpdateDay(updatedDay, day);
      await onUpdateSettings({
        ...settings,
        defaultWorkoutMode: proposal.result.dailySystem.workoutMode,
        dailySystem: proposal.result.dailySystem,
        systemConfiguration: proposal.result.systemConfiguration,
      });
      setProposal(null);
      setQuery('');
      setFeedback(proposal.result.summary);
      window.setTimeout(() => setFeedback(null), 6000);
    } catch (error) {
      reportAiFailure('customization save', error, console.error);
      setProposal(null);
      setIsError(true);
      setFeedback('Could not finish saving the proposal. Review the current day and settings before trying again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Action Pill */}
      {!isOpen && (
        <button
        onClick={() => {
          const connected = hasGeminiKey();
          setKeyConnected(connected);
          setShowKeyForm(!connected);
          setIsOpen(true);
        }}
          className="fixed bottom-20 md:bottom-8 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer font-medium text-xs tracking-wide"
        >
          <Sparkles className="w-4 h-4 text-indigo-200 animate-spin" style={{ animationDuration: '6s' }} />
          <span>AI Command</span>
        </button>
      )}

      {/* Expanded Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 w-[92vw] max-w-md max-h-[85vh] overflow-y-auto p-4 rounded-2xl bg-[#131722]/95 border border-indigo-500/30 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white">Daily OS Command Console</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 mb-3 rounded-lg bg-[#0a0c12] border border-[#232a3d]">
            <button
              type="button"
              onClick={() => { setMode('customize'); setFeedback(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] ${mode === 'customize' ? 'bg-indigo-600/30 text-indigo-200' : 'text-zinc-400 hover:text-white'}`}
            >
              <Terminal className="w-3 h-3" /> Customize
            </button>
            <button
              type="button"
              disabled={proposal !== null}
              onClick={() => { setMode('log'); setFeedback(null); }}
              title={proposal ? 'Apply or discard the pending proposal first' : undefined}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] ${mode === 'log' ? 'bg-indigo-600/30 text-indigo-200' : 'text-zinc-400 hover:text-white'}`}
            >
              <Calendar className="w-3 h-3" /> Log activity
            </button>
          </div>

          {mode === 'customize' ? (
            <>
              <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
                Describe changes to your schedule, habits, workout, enabled modules, or dashboard order. For example: “Move my workout to 6 PM, add reading, and hide DSA Practice.”
              </p>
              {!keyConnected || showKeyForm ? (
                <form onSubmit={saveApiKey} className="mb-3 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20">
                  <label htmlFor="gemini-command-key" className="block text-[11px] text-amber-200 mb-1.5">
                    Connect your Google AI Studio API key
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="gemini-command-key"
                      type="password"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      placeholder="Paste Gemini API key"
                      autoComplete="new-password"
                      className="min-w-0 flex-1 px-2.5 py-2 bg-[#0a0c12] border border-[#302b32] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!apiKeyDraft.trim()}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between mb-3 text-[10px] text-emerald-300">
                  <span>Gemini connected · key remains in this browser</span>
                  <button
                    type="button"
                    onClick={() => { setShowKeyForm(true); setApiKeyDraft(''); }}
                    className="text-zinc-400 hover:text-white underline"
                  >
                    Change key
                  </button>
                </div>
              )}

              <form onSubmit={handleCustomize} className="flex gap-2">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={proposal !== null}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={1000}
                  rows={2}
                  placeholder="> Change my daily system…"
                  className="min-w-0 flex-1 px-3.5 py-2.5 bg-[#0a0c12] border border-[#232a3d] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono resize-y"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isProcessing || proposal !== null || !query.trim() || !keyConnected || showKeyForm}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>

              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Gemini requests send your command and the current schedule, habits, workout details, and module layout to Google. Your saved API key stays in this browser; Google processes each request.
              </p>

              {proposal && (
                <section aria-label="Review AI customization proposal" className="mt-3 p-3 rounded-xl bg-[#0a0c12] border border-indigo-500/30 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold text-white">Review proposed changes</h3>
                    <p className="mt-1 text-[11px] text-zinc-300">{proposal.result.summary}</p>
                  </div>
                  <div className="space-y-2 text-[10px] text-zinc-300">
                    <div>
                      <h4 className="font-semibold text-indigo-200">Schedule ({proposal.result.dailySystem.schedule.length})</h4>
                      <p className="mt-1 text-zinc-500">Current</p>
                      <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                        {proposal.baseDay.schedule.map((item) => (
                          <li key={item.id}>{item.time} · {item.title}</li>
                        ))}
                        {proposal.baseDay.schedule.length === 0 && <li>None</li>}
                      </ul>
                      <p className="mt-1 text-indigo-200">Proposed</p>
                      <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                        {proposal.result.dailySystem.schedule.map((item) => (
                          <li key={item.id}>{item.time} · {item.title}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-200">Habits ({proposal.result.dailySystem.habits.length})</h4>
                      <p className="mt-1 text-zinc-500">Current: {proposal.baseDay.habits.map((habit) => habit.title).join(', ') || 'None'}</p>
                      <p className="text-indigo-200">Proposed: {proposal.result.dailySystem.habits.map((habit) => habit.title).join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-200">Commitments</h4>
                      <p className="mt-1 text-zinc-500">Current: {proposal.baseDay.workout.dailyNonNegotiables.map((item) => item.name).join(', ') || 'None'}</p>
                      <p className="text-indigo-200">Proposed: {proposal.result.dailySystem.nonNegotiables.map((item) => item.name).join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-200">Workout</h4>
                      <p className="mt-1 text-zinc-500">
                        Current: {proposal.baseDay.workout.mode} · {proposal.baseDay.workout.cycleDay} · {proposal.baseDay.workout.exercises.map((exercise) => exercise.name).join(', ') || 'No exercises'}
                      </p>
                      <p className="mt-1">{proposal.result.dailySystem.workoutMode} · {proposal.result.dailySystem.workoutCycle}</p>
                      <p className="text-indigo-200">Proposed: {proposal.result.dailySystem.workoutExercises.map((exercise) => `${exercise.name} (${exercise.sets} sets)`).join(', ') || 'No exercises'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-200">Application configuration</h4>
                      <p className="mt-1 text-zinc-500">
                        Current modules: {proposal.baseSettings.systemConfiguration.enabledModules
                          .map((id) => SYSTEM_MODULE_REGISTRY.find((item) => item.id === id)?.label || id)
                          .join(', ') || 'None'}
                      </p>
                      <p className="mt-1">
                        Proposed modules: {proposal.result.systemConfiguration.enabledModules
                          .map((id) => SYSTEM_MODULE_REGISTRY.find((item) => item.id === id)?.label || id)
                          .join(', ') || 'None'}
                      </p>
                      <p className="text-zinc-500">
                        Current dashboard: {proposal.baseSettings.systemConfiguration.dashboardLayout
                          .map((id) => DASHBOARD_WIDGET_REGISTRY.find((item) => item.id === id)?.label || id)
                          .join(' → ') || 'No widgets'}
                      </p>
                      <p>
                        Proposed dashboard: {proposal.result.systemConfiguration.dashboardLayout
                          .map((id) => DASHBOARD_WIDGET_REGISTRY.find((item) => item.id === id)?.label || id)
                          .join(' → ') || 'No widgets'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Hidden modules do not delete their records. Existing trackers, goals, and AI preferences are preserved.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleApplyProposal()}
                      className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      {isProcessing ? 'Saving…' : 'Apply changes'}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => { setProposal(null); setFeedback('Proposal discarded. No changes were applied.'); setIsError(false); }}
                      className="px-3 py-2 rounded-lg bg-[#202534] hover:bg-[#2b3245] disabled:opacity-50 text-zinc-200 text-xs"
                    >
                      Discard
                    </button>
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
                Log an accomplishment in plain English — e.g. “Solved LeetCode 3Sum in medium” or “Finished database index chapter.”
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={1000}
                  placeholder="What did you just accomplish?..."
                  className="flex-1 px-3.5 py-2.5 bg-[#0a0c12] border border-[#232a3d] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isProcessing || !query.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                When Gemini is connected, this log text is sent to Google for parsing. Without a key, the local parser handles it in your browser.
              </p>
            </>
          )}

          {feedback && (
            <div role={isError ? 'alert' : 'status'} className={`mt-3 p-2.5 rounded-lg border text-xs flex items-center gap-2 animate-in fade-in ${isError ? 'bg-red-950/50 border-red-800/40 text-red-300' : 'bg-emerald-950/50 border-emerald-800/40 text-emerald-300'}`}>
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${isError ? 'text-red-400' : 'text-emerald-400'}`} />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

function applyCustomizationToDay(day: DayRecord, result: AppCustomizationResult): DayRecord {
  const currentExercises = day.workout.exercises;
  const workoutPlanChanged = day.workout.mode !== result.dailySystem.workoutMode
    || day.workout.cycleDay !== result.dailySystem.workoutCycle
    || currentExercises.length !== result.dailySystem.workoutExercises.length
    || currentExercises.some((exercise, index) => {
      const next = result.dailySystem.workoutExercises[index];
      return !next
        || exercise.name !== next.name
        || exercise.target !== next.target
        || exercise.sets !== next.sets;
    });
  const exercises = result.dailySystem.workoutExercises.map((exercise, index) => {
    const previous = currentExercises.find((item) => item.name.toLowerCase() === exercise.name.toLowerCase());
    return {
      id: previous?.id || `ai-exercise-${Date.now()}-${index}`,
      name: exercise.name,
      target: exercise.target,
      completed: previous?.completed || false,
      skipped: previous?.skipped || false,
      sets: exercise.sets,
      reps: previous?.reps || '',
      weight: previous?.weight || '',
      duration: previous?.duration || '',
      notes: previous?.notes || '',
    };
  });

  return {
    ...day,
    schedule: result.dailySystem.schedule,
    habits: result.dailySystem.habits,
    workout: {
      ...day.workout,
      mode: result.dailySystem.workoutMode,
      cycleDay: result.dailySystem.workoutCycle,
      status: workoutPlanChanged ? 'not_started' : day.workout.status,
      completedAt: workoutPlanChanged ? undefined : day.workout.completedAt,
      exercises,
      dailyNonNegotiables: result.dailySystem.nonNegotiables,
    },
  };
}
