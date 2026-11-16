import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Brain,
  Dumbbell,
  BookOpen,
  Code2,
  Terminal,
  ArrowRight,
  Loader2,
  Key,
  Shield,
  User,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { GeneratedSystemArchetype, UserOnboardingProfile, agentSystemArchitect } from '../services/onboardingPipeline';
import { setGeminiApiKey, getGeminiApiKey } from '../services/ai';
import { AuthUser, AuthErrorInfo, DayRecord } from '../types';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  day: DayRecord;
  user: AuthUser | null;
  onSignIn: () => Promise<void>;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onComplete: (updatedDay: DayRecord, generatedSystem: GeneratedSystemArchetype) => Promise<void>;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  day,
  user,
  onSignIn,
  isSigningIn = false,
  authError,
  onComplete,
  onClose,
}) => {
  // Step 1: Google Account Linking (Seamless cloud persistence)
  // Step 2: Gemini API Key (Google AI Studio)
  // Step 3: Role & Chronotype
  // Step 4: Core Pillars & Goals
  // Step 5: Multi-Agent Synthesis
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(user ? 2 : 1);
  const [apiKey, setApiKey] = useState(() => getGeminiApiKey());
  const [role, setRole] = useState<UserOnboardingProfile['targetRole']>('engineer');
  const [chronotype, setChronotype] = useState<UserOnboardingProfile['chronotype']>('early');
  const [capacity, setCapacity] = useState<UserOnboardingProfile['deepWorkCapacity']>('moderate');
  const [pillars, setPillars] = useState<UserOnboardingProfile['pillars']>(['dsa', 'fitness', 'projects']);
  const [goal, setGoal] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  const togglePillar = (p: UserOnboardingProfile['pillars'][number]) => {
    if (pillars.includes(p)) {
      if (pillars.length > 1) setPillars(pillars.filter((item) => item !== p));
    } else {
      if (pillars.length < 4) setPillars([...pillars, p]);
    }
  };

  const handleSaveApiKeyAndNext = () => {
    if (apiKey && apiKey.trim()) {
      setGeminiApiKey(apiKey.trim());
    }
    setStep(3);
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setErrorMessage('');
    setStatusMessage('Agent 1: Profiling behavioral chronotype & energy windows...');

    try {
      if (apiKey && apiKey.trim()) {
        setGeminiApiKey(apiKey.trim());
      }

      setTimeout(() => {
        setStatusMessage('Agent 2: System Architect constructing master routine...');
      }, 700);

      const generated = await agentSystemArchitect({
        targetRole: role,
        chronotype,
        deepWorkCapacity: capacity,
        pillars,
        primaryGoal: goal || 'Build disciplined momentum without burnout',
        workoutMode: day.workout.mode,
        customInstructions: customInstructions.trim(),
        apiKey: apiKey.trim(),
      });

      setStatusMessage(generated.generationMode === 'ai'
        ? 'Agent 3: Personalizing your routine and validating workload limits...'
        : 'AI unavailable; using an offline routine based on your questionnaire answers.');

      const updatedDay: DayRecord = {
        ...day,
        schedule: generated.schedule,
        habits: generated.habits,
        workout: {
          ...day.workout,
          cycleDay: generated.workoutCycle,
          exercises: generated.workoutExercises.map((exercise, index) => ({
            id: `onboarding-ex-${index}-${exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name: exercise.name,
            target: exercise.target,
            completed: false,
            skipped: false,
            sets: exercise.sets,
            reps: '',
            weight: '',
            duration: '',
            notes: '',
          })),
          dailyNonNegotiables: generated.nonNegotiables,
        },
      };

      await onComplete(updatedDay, generated);
      localStorage.setItem('daily_os_onboarded', 'true');

      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}
    } catch (e) {
      console.error('Onboarding synthesis error:', e);
      setErrorMessage('Could not save your generated setup. Please try again; your onboarding progress has not been discarded.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <GlassCard className="w-full max-w-xl p-6 sm:p-8" glow={false}>
        {/* Step Counter & Brand */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white">
              <Sparkles className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <span className="text-xs font-mono font-semibold tracking-wider text-zinc-300 uppercase">
                AI System Architect
              </span>
              <h2 className="text-sm font-semibold text-white">Setup Your Operating System</h2>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">Step {step} of 5</span>
        </div>

        {/* STEP 1: Google Account Sign-In (Linked once and persisted forever) */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs">
              <div className="flex items-center gap-2 text-white font-semibold mb-1">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Link Your Google Account</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Connect your Google Account to automatically sync your routines, workouts, and reflections to Cloud Firestore. You will never be asked to configure this again.
              </p>
            </div>

            {user ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-emerald-500/30" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs">
                      {user.email?.[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-white block">{user.displayName || 'Google User'}</span>
                    <span className="text-[11px] text-zinc-400 font-mono block">{user.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Linked</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await onSignIn();
                  setStep(2);
                }}
                disabled={isSigningIn}
                className="w-full py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 bg-white text-black hover:bg-zinc-200 transition-all cursor-pointer shadow-xl"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Connecting Google Account...</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 text-black" />
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>
            )}

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/40 text-red-200 text-xs">
                {typeof authError === 'object' ? authError.message : authError}
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(2)}
                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Continue as Guest (Local Offline Only)
              </button>
              {user && (
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Google AI Studio API Key */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
                <Key className="w-4 h-4" />
                <span>Google AI Studio / Gemini API Key</span>
              </div>
              <p className="text-zinc-300 leading-relaxed mb-2">
                Daily OS uses Gemini to architect routines, draft reflections, and provide algorithmic hints. Obtain a free key without a credit card:
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 underline font-medium"
              >
                <span>Get free Gemini API Key from Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1.5">
                Paste Your Gemini API Key (or skip for smart offline defaults)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono"
              />
              <span className="text-[11px] text-zinc-500 block mt-1">
                Your key remains 100% private in browser storage.
              </span>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setApiKey('');
                    setStep(3);
                  }}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveApiKeyAndNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <span>{apiKey.trim() ? 'Save & Continue' : 'Continue'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Role & Chronotype */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-2.5">
                1. Your Primary Focus Domain
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'engineer', label: 'Engineer', icon: Terminal },
                  { id: 'student', label: 'Student', icon: BookOpen },
                  { id: 'founder', label: 'Founder', icon: Brain },
                  { id: 'creator', label: 'Creator', icon: Sparkles },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setRole(item.id as any)}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      role === item.id
                        ? 'bg-white/10 border-white/30 text-white shadow-lg'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-2.5">
                2. Natural Chronotype (Energy Window)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'early', title: 'Early Bird', time: '05:30 Wake · Peak 07:00' },
                  { id: 'standard', title: 'Standard', time: '07:00 Wake · Peak 09:30' },
                  { id: 'night', title: 'Night Owl', time: '09:00 Wake · Peak 14:00' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChronotype(item.id as any)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      chronotype === item.id
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-semibold block text-white">{item.title}</span>
                    <span className="text-[10px] text-zinc-400 font-mono mt-1 block">{item.time}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Anchor Pillars & Goals */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Select Your Daily Core Pillars (Pick 2–4)
              </label>
              <p className="text-xs text-zinc-400 mb-3">
                The System Architect will tailor schedule blocks and non-negotiables specifically for these.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: 'dsa', title: 'Algorithms & LeetCode', icon: Code2 },
                  { id: 'academics', title: 'Academic Study & Recall', icon: BookOpen },
                  { id: 'fitness', title: 'Physical Training / Gym', icon: Dumbbell },
                  { id: 'projects', title: 'Engineering & Building', icon: Terminal },
                  { id: 'reading', title: 'Technical Reading', icon: Brain },
                ].map((p) => {
                  const isSelected = pillars.includes(p.id as any);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePillar(p.id as any)}
                      className={`p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white/10 border-white/30 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <p.icon className="w-4 h-4 text-zinc-300" />
                        <span className="text-xs font-medium">{p.title}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white text-black border-white' : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Primary Goal / Milestone This Month
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Master DP patterns & finish OS syllabus"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label htmlFor="onboarding-instructions" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Describe the system you want (optional)
              </label>
              <textarea
                id="onboarding-instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Tell the AI about your real schedule, priorities, available equipment, constraints, or routines you want. Example: I work 9–5, want three strength sessions, and need evenings free."
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-y"
              />
              <span className="text-[11px] text-zinc-500 block mt-1">
                {apiKey.trim()
                  ? 'Your instructions will guide AI-generated schedule blocks, habits, and workout exercises.'
                  : 'Add a Gemini API key to use these instructions for AI generation; offline setup uses the questionnaire above.'}
              </span>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>Review & Synthesize</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Agent Pipeline Execution */}
        {step === 5 && (
          <div className="space-y-5 text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">Ready to Architect Your Operating System</h3>
              <p className="text-xs text-zinc-300 max-w-sm mx-auto mt-1 leading-relaxed">
                The 3-stage agent pipeline will construct your master schedule, default non-negotiables, and cognitive rest buffers based on your answers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-left text-xs space-y-1.5 max-w-sm mx-auto font-mono text-zinc-300">
              <div>• Account: <span className="text-white">{user?.email || 'Guest / Local Session'}</span></div>
              <div>• API Status: <span className="text-white">{apiKey.trim() ? 'Gemini 2.5 Active' : 'Offline Heuristics'}</span></div>
              <div>• Role: <span className="text-white capitalize">{role}</span></div>
              <div>• Chronotype: <span className="text-white capitalize">{chronotype}</span></div>
              <div>• Active Pillars: <span className="text-white">{pillars.join(', ')}</span></div>
              {customInstructions.trim() && (
                <div className="pt-1 border-t border-white/10">
                  • Your instructions: <span className="text-white">{customInstructions.trim().slice(0, 180)}{customInstructions.trim().length > 180 ? '…' : ''}</span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div role="alert" className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs max-w-sm mx-auto">
                {errorMessage}
              </div>
            )}

            {statusMessage && (
              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs font-mono animate-in fade-in max-w-sm mx-auto">
                {statusMessage}
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => setStep(4)}
                disabled={isSynthesizing}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Adjust
              </button>
              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-white via-zinc-200 to-zinc-300 text-black font-semibold text-xs shadow-xl hover:opacity-95 transition-all cursor-pointer"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Agent Pipeline Running...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Generate My Custom System</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
