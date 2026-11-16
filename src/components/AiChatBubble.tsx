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
import { AppCustomizationResult, customizeAppFromCommand } from '../services/appCustomization';
import { DayRecord, DsaProblem, ScheduleItem, UserSettings } from '../types';

interface AiChatBubbleProps {
  day: DayRecord;
  onUpdateDay: (updatedDay: DayRecord) => Promise<void>;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => Promise<void>;
}

export const AiChatBubble: React.FC<AiChatBubbleProps> = ({
  day,
  onUpdateDay,
  settings,
  onUpdateSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'customize' | 'log'>('customize');
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [keyConnected, setKeyConnected] = useState(() => hasGeminiKey());
  const [showKeyForm, setShowKeyForm] = useState(() => !hasGeminiKey());

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
          problem: parsed.data?.problem || query,
          platform: parsed.data?.platform || 'LeetCode',
          difficulty: parsed.data?.difficulty || 'Medium',
          pattern: parsed.data?.pattern || 'Algorithmic Pattern',
          firstIdea: '',
          solvedIndependently: parsed.data?.solvedIndependently ?? true,
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
        await onUpdateDay({ ...day, dsa: updatedDsa });
        setFeedback(`Logged "${newProblem.problem}" into DSA Practice!`);
      } else if (parsed.type === 'schedule') {
        const newSched: ScheduleItem = {
          id: `sched-ai-${Date.now()}`,
          time: 'Flexible',
          title: parsed.data?.note || query,
          category: 'other',
          status: 'completed',
        };
        const updatedSched = [...(day.schedule || []), newSched];
        await onUpdateDay({ ...day, schedule: updatedSched });
        setFeedback(`Added block: "${newSched.title}" to today's schedule!`);
      } else {
        // Fallback note in reflection
        const currentNotes = day.notes ? `${day.notes}\n• ${query}` : `• ${query}`;
        await onUpdateDay({ ...day, notes: currentNotes });
        setFeedback(`Saved into today's journal!`);
      }

      setQuery('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Quick AI parse error:', err);
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
      const result = await customizeAppFromCommand(query, day);
      const updatedDay = applyCustomizationToDay(day, result);
      await onUpdateDay(updatedDay);
      await onUpdateSettings({
        ...settings,
        defaultWorkoutMode: result.dailySystem.workoutMode,
        dailySystem: result.dailySystem,
      });
      setQuery('');
      setFeedback(result.summary);
      window.setTimeout(() => setFeedback(null), 6000);
    } catch (error) {
      console.error('AI customization failed:', error);
      setIsError(true);
      setFeedback(error instanceof Error ? error.message : 'Could not apply that command. Please try again.');
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
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 w-[92vw] max-w-md p-4 rounded-2xl bg-[#131722]/95 border border-indigo-500/30 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 animate-in fade-in slide-in-from-bottom-4 duration-200">
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
              onClick={() => { setMode('log'); setFeedback(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] ${mode === 'log' ? 'bg-indigo-600/30 text-indigo-200' : 'text-zinc-400 hover:text-white'}`}
            >
              <Calendar className="w-3 h-3" /> Log activity
            </button>
          </div>

          {mode === 'customize' ? (
            <>
              <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
                Describe the changes you want to your schedule, habits, or workout. For example: “Move my workout to 6 PM and add a 30-minute reading block.”
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
                  disabled={isProcessing || !query.trim() || !keyConnected || showKeyForm}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
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
