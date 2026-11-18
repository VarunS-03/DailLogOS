import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { reportAiFailure } from '../services/aiDiagnostics';
import {
  AuthUser,
  AuthErrorInfo,
  DayRecord,
  OnboardingAnswers,
  OnboardingAppPreference,
  OnboardingChronotype,
  OnboardingRequirements,
  OnboardingRequirementsInterpretation,
  UserSystemConfiguration,
} from '../types';
import confetti from 'canvas-confetti';
import {
  createOfflineOnboardingRequirements,
  interpretOnboardingRequirements,
} from '../services/requirementsInterpreter';
import {
  onboardingRequirementsMatchAnswers,
  validateOnboardingRequirements,
} from '../services/accountLifecycle';
import {
  createSystemConfigurationFromRequirements,
  DASHBOARD_WIDGET_REGISTRY,
  SYSTEM_MODULE_REGISTRY,
} from '../services/systemConfiguration';

interface OnboardingModalProps {
  day: DayRecord;
  user: AuthUser | null;
  answers: OnboardingAnswers;
  requirements: OnboardingRequirements | null;
  initialStage: number;
  onSignIn: () => Promise<void>;
  onAnswersChange: (answers: OnboardingAnswers) => void;
  onRequirementsChange: (requirements: OnboardingRequirements | null) => void;
  onStageChange: (currentStage: number) => void;
  onSaveProgress: (
    answers: OnboardingAnswers,
    currentStage: number,
    requirements: OnboardingRequirements | null,
    systemConfiguration?: UserSystemConfiguration
  ) => Promise<void>;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onComplete: (
    updatedDay: DayRecord,
    generatedSystem: GeneratedSystemArchetype,
    requirements: OnboardingRequirements,
    systemConfiguration: UserSystemConfiguration
  ) => Promise<void>;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  day,
  user,
  answers,
  requirements,
  initialStage,
  onSignIn,
  onAnswersChange,
  onRequirementsChange,
  onStageChange,
  onSaveProgress,
  isSigningIn = false,
  authError,
  onComplete,
  onClose,
}) => {
  // Steps 1–2 handle account/AI setup; steps 3–6 gather requirements and generate a routine.
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(() =>
    Math.min(6, Math.max(1, initialStage)) as 1 | 2 | 3 | 4 | 5 | 6
  );
  const [apiKey, setApiKey] = useState(() => getGeminiApiKey());
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [configurationConfirmed, setConfigurationConfirmed] = useState(Boolean(requirements?.userConfirmed));
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [draftSaveError, setDraftSaveError] = useState('');
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());

  const role = answers.targetRole;
  const chronotype = answers.chronotype;
  const capacity = answers.deepWorkCapacity;
  const pillars = answers.trackingAreas;
  const goal = answers.primaryGoal;
  const customInstructions = answers.customInstructions;
  const configurationPreview = requirements
    ? createSystemConfigurationFromRequirements(requirements)
    : null;

  useEffect(() => {
    setStep(Math.min(6, Math.max(1, initialStage)) as 1 | 2 | 3 | 4 | 5 | 6);
  }, [initialStage]);

  useEffect(() => {
    setConfigurationConfirmed(Boolean(requirements?.userConfirmed));
  }, [requirements]);

  const changeStep = (nextStep: 1 | 2 | 3 | 4 | 5 | 6) => {
    setStep(nextStep);
    onStageChange(nextStep);
  };

  const persistProgress = useCallback((
    draft: OnboardingAnswers,
    stage: number,
    requirementsDraft: OnboardingRequirements | null = requirements,
    configurationDraft?: UserSystemConfiguration
  ) => {
    const operation = progressWriteRef.current.catch(() => {}).then(() =>
      onSaveProgress(draft, stage, requirementsDraft, configurationDraft)
    );
    progressWriteRef.current = operation;
    return operation;
  }, [onSaveProgress, requirements]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      persistProgress(answers, step).then(() => {
        if (active) setDraftSaveError('');
      }).catch((err: unknown) => {
        if (active) setDraftSaveError(err instanceof Error ? err.message : 'Onboarding answers could not be saved.');
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [answers, requirements, step, persistProgress]);

  const togglePillar = (p: UserOnboardingProfile['pillars'][number]) => {
    if (pillars.includes(p)) {
      if (pillars.length > 1) onAnswersChange({ ...answers, trackingAreas: pillars.filter((item) => item !== p) });
    } else {
      if (pillars.length < 5) onAnswersChange({ ...answers, trackingAreas: [...pillars, p] });
    }
  };

  const toggleAppPreference = (preference: OnboardingAppPreference) => {
    const preferences = answers.appPreferences.includes(preference)
      ? answers.appPreferences.filter((item) => item !== preference)
      : [...answers.appPreferences, preference];
    onAnswersChange({ ...answers, appPreferences: preferences });
  };

  const updateAnswer = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    onAnswersChange({ ...answers, [key]: value });
  };

  const updateRequirementInterpretation = (patch: Partial<OnboardingRequirementsInterpretation>) => {
    if (!requirements) return;
    setConfigurationConfirmed(false);
    onRequirementsChange({
      ...requirements,
      interpretation: { ...requirements.interpretation, ...patch },
      userConfirmed: false,
    });
  };

  const validateQuestionnaireBeforeInterpretation = () => {
    if (!goal.trim()) {
      setErrorMessage('Add a primary goal before interpreting requirements.');
      changeStep(5);
      return false;
    }
    if (role === 'custom' && !answers.customRoleTitle.trim()) {
      setErrorMessage('Describe your focus domain before interpreting requirements.');
      changeStep(3);
      return false;
    }
    return true;
  };

  const handleInterpretRequirements = async () => {
    if (!validateQuestionnaireBeforeInterpretation()) return;
    setIsInterpreting(true);
    setErrorMessage('');
    setStatusMessage(apiKey.trim() ? 'Interpreting your answers with Gemini...' : 'Creating a local requirements draft...');
    try {
      if (apiKey.trim()) setGeminiApiKey(apiKey.trim());
      const interpreted = await interpretOnboardingRequirements(answers, apiKey.trim());
      onRequirementsChange(interpreted);
      await persistProgress(answers, step, interpreted);
      setStatusMessage(interpreted.source === 'gemini'
        ? 'Gemini draft ready. Review and edit every requirement before approval.'
        : 'Offline draft ready. Review and edit every requirement before approval.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Requirements could not be interpreted.');
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleCreateOfflineRequirements = async () => {
    if (!validateQuestionnaireBeforeInterpretation()) return;
    setIsInterpreting(true);
    setErrorMessage('');
    try {
      const draft = createOfflineOnboardingRequirements(answers);
      onRequirementsChange(draft);
      await persistProgress(answers, step, draft);
      setStatusMessage('Offline draft ready. Review and edit every requirement before approval.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Offline requirements could not be created.');
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleSaveApiKeyAndNext = () => {
    if (apiKey && apiKey.trim()) {
      setGeminiApiKey(apiKey.trim());
    }
    changeStep(3);
  };

  const handleSynthesize = async () => {
    const validatedRequirements = requirements ? validateOnboardingRequirements(requirements) : null;
    if (!validatedRequirements || !onboardingRequirementsMatchAnswers(validatedRequirements, answers)) {
      setErrorMessage('Interpret the current answers and review the requirements before generating your setup.');
      return;
    }
    if (!configurationConfirmed && !validatedRequirements.userConfirmed) {
      setErrorMessage('Review and confirm the application configuration before generating your setup.');
      return;
    }
    const confirmedRequirements = validateOnboardingRequirements({
      ...validatedRequirements,
      userConfirmed: true,
    });
    if (!confirmedRequirements) {
      setErrorMessage('The reviewed requirements are invalid. Please check the summary and priorities.');
      return;
    }
    const systemConfiguration = createSystemConfigurationFromRequirements(confirmedRequirements);
    setIsSynthesizing(true);
    setErrorMessage('');
    setStatusMessage('Saving your confirmed requirements...');

    try {
      await persistProgress(answers, step, confirmedRequirements, systemConfiguration);
      onRequirementsChange(confirmedRequirements);
      if (apiKey && apiKey.trim()) {
        setGeminiApiKey(apiKey.trim());
      }

      setStatusMessage('Agent 1: Profiling your confirmed priorities and schedule constraints...');
      setTimeout(() => {
        setStatusMessage('Agent 2: System Architect constructing master routine...');
      }, 700);

      const routineConstraints = [
        `Reviewed requirements summary: ${confirmedRequirements.interpretation.summary}`,
        `Reviewed priority areas: ${confirmedRequirements.interpretation.priorityAreas.join(', ')}.`,
        `Available time: ${confirmedRequirements.sourceAnswers.availableHoursPerDay} hours/day, ${confirmedRequirements.sourceAnswers.workDaysPerWeek} days/week.`,
        `Preferred focus-session length: ${confirmedRequirements.sourceAnswers.preferredSessionMinutes} minutes.`,
        `Planning style preference: ${confirmedRequirements.sourceAnswers.planningStyle}.`,
        confirmedRequirements.interpretation.constraints.trim()
          ? `Reviewed constraints:\n${confirmedRequirements.interpretation.constraints.trim()}`
          : '',
        confirmedRequirements.sourceAnswers.fixedCommitments.trim()
          ? `Fixed commitments: ${confirmedRequirements.sourceAnswers.fixedCommitments.trim()}`
          : '',
        confirmedRequirements.sourceAnswers.secondaryGoals.trim()
          ? `Additional goals: ${confirmedRequirements.sourceAnswers.secondaryGoals.trim()}`
          : '',
        confirmedRequirements.sourceAnswers.customInstructions.trim(),
      ].filter(Boolean).join('\n');

      const generated = await agentSystemArchitect({
        targetRole: confirmedRequirements.sourceAnswers.targetRole,
        customRoleTitle: confirmedRequirements.sourceAnswers.customRoleTitle,
        chronotype: confirmedRequirements.sourceAnswers.chronotype,
        wakeTime: confirmedRequirements.sourceAnswers.wakeTime,
        sleepTime: confirmedRequirements.sourceAnswers.sleepTime,
        deepWorkCapacity: confirmedRequirements.sourceAnswers.deepWorkCapacity,
        pillars: confirmedRequirements.interpretation.priorityAreas,
        primaryGoal: confirmedRequirements.sourceAnswers.primaryGoal.trim(),
        workoutMode: confirmedRequirements.sourceAnswers.workoutMode,
        customInstructions: routineConstraints,
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
          mode: answers.workoutMode,
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

      await onComplete(updatedDay, generated, confirmedRequirements, systemConfiguration);

      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}
    } catch (e) {
      reportAiFailure('onboarding save', e, console.error);
      setErrorMessage('Could not save your generated setup. Please try again; your onboarding progress has not been discarded.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <GlassCard className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 sm:p-8" glow={false}>
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
          <span className="text-xs font-mono text-zinc-400">Step {step} of 6</span>
        </div>
        {draftSaveError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-200">
            {draftSaveError}
          </div>
        )}

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
                  changeStep(2);
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
                onClick={() => changeStep(2)}
                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Continue as Guest (Local Offline Only)
              </button>
              {user && (
                <button
                  onClick={() => changeStep(2)}
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
                onClick={() => changeStep(1)}
                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setApiKey('');
                    changeStep(3);
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {([
                  { id: 'student', label: 'Student', icon: BookOpen },
                  { id: 'engineer', label: 'Engineer', icon: Terminal },
                  { id: 'founder', label: 'Founder', icon: Brain },
                  { id: 'creator', label: 'Creator', icon: Sparkles },
                  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
                  { id: 'custom', label: 'Other', icon: User },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateAnswer('targetRole', item.id)}
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
              {role === 'custom' && (
                <input
                  type="text"
                  value={answers.customRoleTitle}
                  onChange={(event) => updateAnswer('customRoleTitle', event.target.value.slice(0, 80))}
                  maxLength={80}
                  aria-label="Describe your focus domain"
                  placeholder="Describe your focus domain"
                  className="mt-2 w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              )}
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
                    onClick={() => updateAnswer('chronotype', item.id as OnboardingChronotype)}
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

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-300">
                Usual wake time
                <input
                  type="time"
                  value={answers.wakeTime}
                  onChange={(event) => updateAnswer('wakeTime', event.target.value || answers.wakeTime)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
              <label className="text-xs text-zinc-300">
                Usual sleep time
                <input
                  type="time"
                  value={answers.sleepTime}
                  onChange={(event) => updateAnswer('sleepTime', event.target.value || answers.sleepTime)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => changeStep(2)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => changeStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Capacity & Constraints */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="daily-capacity" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Sustainable deep-work capacity
              </label>
              <select
                id="daily-capacity"
                value={answers.deepWorkCapacity}
                onChange={(event) => updateAnswer('deepWorkCapacity', event.target.value as OnboardingAnswers['deepWorkCapacity'])}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white"
              >
                <option value="minimum">Minimum viable — about 1–2 hours</option>
                <option value="moderate">Moderate — about 3–4 hours</option>
                <option value="high">High — about 5–6 hours</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-300">
                Available hours on a typical day
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={1}
                  value={answers.availableHoursPerDay}
                  onChange={(event) => updateAnswer('availableHoursPerDay', Math.min(16, Math.max(1, Number(event.target.value) || 1)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
              <label className="text-xs text-zinc-300">
                Days available each week
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={answers.workDaysPerWeek}
                  onChange={(event) => updateAnswer('workDaysPerWeek', Math.min(7, Math.max(1, Number(event.target.value) || 1)))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
            </div>

            <label htmlFor="fixed-commitments" className="block text-xs text-zinc-300">
              Fixed commitments or constraints
              <textarea
                id="fixed-commitments"
                value={answers.fixedCommitments}
                onChange={(event) => updateAnswer('fixedCommitments', event.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={3}
                placeholder="Classes, shifts, caregiving, commute, recovery needs, or times you are unavailable"
                className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500"
              />
            </label>

            <div>
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-2">
                Workout preference
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['gym', 'home'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={answers.workoutMode === mode}
                    onClick={() => updateAnswer('workoutMode', mode)}
                    className={`rounded-xl border px-3 py-2.5 text-xs capitalize ${
                      answers.workoutMode === mode
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/[0.06] bg-white/[0.02] text-zinc-400'
                    }`}
                  >
                    {mode === 'gym' ? 'Gym / equipment' : 'Home / bodyweight'}
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="session-length" className="block text-xs text-zinc-300">
              Preferred focus session length
              <select
                id="session-length"
                value={answers.preferredSessionMinutes}
                onChange={(event) => updateAnswer('preferredSessionMinutes', Number(event.target.value) as OnboardingAnswers['preferredSessionMinutes'])}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white"
              >
                <option value={25}>25 minutes</option>
                <option value={50}>50 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </label>

            <div className="flex justify-between pt-2">
              <button onClick={() => changeStep(3)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">
                Back
              </button>
              <button
                onClick={() => changeStep(5)}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black hover:bg-zinc-200"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Goals, Tracking & App Preferences */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                What is your most important current goal?
              </label>
              <input
                type="text"
                value={goal}
                onChange={(event) => updateAnswer('primaryGoal', event.target.value.slice(0, 500))}
                maxLength={500}
                placeholder="e.g. Finish my course project or build a consistent training routine"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Other goals or milestones (optional)
              </label>
              <textarea
                value={answers.secondaryGoals}
                onChange={(event) => updateAnswer('secondaryGoals', event.target.value.slice(0, 500))}
                maxLength={500}
                rows={2}
                placeholder="What else would you like to make progress on?"
                className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                What do you want to track?
              </span>
              <p className="mb-2 text-[11px] text-zinc-500">Choose one to five areas. You can revise these later.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'academics', label: 'Study & learning', icon: BookOpen },
                  { id: 'dsa', label: 'Problem solving', icon: Code2 },
                  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
                  { id: 'projects', label: 'Projects & work', icon: Terminal },
                  { id: 'reading', label: 'Reading', icon: Brain },
                ] as const).map((item) => {
                  const selected = pillars.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => togglePillar(item.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs ${
                        selected ? 'border-white/30 bg-white/10 text-white' : 'border-white/[0.06] text-zinc-400'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {pillars.length >= 5 && <p className="mt-1 text-[11px] text-zinc-500">All tracking areas selected.</p>}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-zinc-300">
                Planning style
                <select
                  value={answers.planningStyle}
                  onChange={(event) => updateAnswer('planningStyle', event.target.value as OnboardingAnswers['planningStyle'])}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white"
                >
                  <option value="minimal">Minimal — a few clear priorities</option>
                  <option value="balanced">Balanced — priorities and time blocks</option>
                  <option value="structured">Structured — detailed plan and review</option>
                </select>
              </label>
              <div>
                <span className="block text-xs text-zinc-300">App support you prefer</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {([
                    ['daily_briefing', 'Daily briefing'],
                    ['gentle_prompts', 'Gentle prompts'],
                    ['weekly_review', 'Weekly review'],
                    ['ai_suggestions', 'AI suggestions'],
                  ] as const).map(([id, label]) => {
                    const selected = answers.appPreferences.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleAppPreference(id)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                          selected ? 'border-indigo-300/40 bg-indigo-400/10 text-indigo-100' : 'border-white/10 text-zinc-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="onboarding-instructions" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono block mb-1">
                Anything else the system should know? (optional)
              </label>
              <textarea
                id="onboarding-instructions"
                value={customInstructions}
                onChange={(event) => updateAnswer('customInstructions', event.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={2}
                placeholder="Add context or preferences not covered above."
                className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => changeStep(4)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => changeStep(6)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>Review & Synthesize</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Interpret, review, and approve requirements */}
        {step === 6 && (
          <div className="space-y-5 py-4">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">Review your requirements</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-300">
                Gemini can organize your answers into a planning specification. Review and edit it before anything is generated.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-zinc-300">
              <div>Account: <span className="text-white">{user?.email || 'Guest / Local Session'}</span></div>
              <div>Routine generation: <span className="text-white">{apiKey.trim() ? 'Gemini available' : 'Offline mode'}</span></div>
            </div>

            {requirements ? (
              <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-zinc-300">Proposed specification</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-zinc-400">
                    {requirements.source === 'gemini' ? 'Gemini draft' : 'Offline draft'}
                  </span>
                </div>

                <label htmlFor="requirements-summary" className="block text-xs text-zinc-300">
                  Goal and planning summary
                  <textarea
                    id="requirements-summary"
                    value={requirements.interpretation.summary}
                    onChange={(event) => updateRequirementInterpretation({ summary: event.target.value })}
                    maxLength={500}
                    rows={3}
                    className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white"
                  />
                </label>

                <fieldset>
                  <legend className="text-xs text-zinc-300">Priority areas</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {requirements.sourceAnswers.trackingAreas.map((area) => {
                      const selected = requirements.interpretation.priorityAreas.includes(area);
                      return (
                        <button
                          key={area}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            const nextAreas = selected
                              ? requirements.interpretation.priorityAreas.filter((item) => item !== area)
                              : [...requirements.interpretation.priorityAreas, area];
                            if (nextAreas.length) updateRequirementInterpretation({ priorityAreas: nextAreas });
                          }}
                          className={`rounded-lg border px-3 py-2 text-xs capitalize ${
                            selected
                              ? 'border-indigo-300/40 bg-indigo-400/10 text-indigo-100'
                              : 'border-white/10 text-zinc-400'
                          }`}
                        >
                          {area}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">Keep at least one selected area.</p>
                </fieldset>

                <label htmlFor="requirements-constraints" className="block text-xs text-zinc-300">
                  Interpreted constraints (one per line)
                  <textarea
                    id="requirements-constraints"
                    value={requirements.interpretation.constraints}
                    onChange={(event) => updateRequirementInterpretation({ constraints: event.target.value })}
                    maxLength={1000}
                    rows={3}
                    placeholder="No additional constraints identified"
                    className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white"
                  />
                </label>

                <div className="border-t border-white/10 pt-3 text-[11px] text-zinc-400">
                  <p>Source answers: {requirements.sourceAnswers.availableHoursPerDay} hours/day, {requirements.sourceAnswers.workDaysPerWeek} days/week; {requirements.sourceAnswers.wakeTime}–{requirements.sourceAnswers.sleepTime}.</p>
                  <p className="mt-1">Planning style: {requirements.sourceAnswers.planningStyle}; focus session: {requirements.sourceAnswers.preferredSessionMinutes} minutes.</p>
                  <p className="mt-1">Confirming this specification saves it with your onboarding progress.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                <p className="text-xs text-zinc-300">
                  {apiKey.trim()
                    ? 'Gemini will propose a concise summary, priority order, and explicit constraints from your answers. Choosing Gemini sends these questionnaire answers to Google for processing.'
                    : 'No Gemini key is available. You can create a clearly labeled offline draft and edit it yourself.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleInterpretRequirements()}
                    disabled={isInterpreting || isSynthesizing}
                    className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    {isInterpreting ? 'Preparing draft…' : apiKey.trim() ? 'Interpret with Gemini' : 'Create offline draft'}
                  </button>
                  {apiKey.trim() && (
                    <button
                      type="button"
                      onClick={() => void handleCreateOfflineRequirements()}
                      disabled={isInterpreting || isSynthesizing}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-xs text-zinc-300 disabled:opacity-50"
                    >
                      Use offline draft instead
                    </button>
                  )}
                </div>
              </div>
            )}

            {requirements && configurationPreview && (
              <section className="space-y-3 rounded-xl border border-indigo-400/20 bg-indigo-950/20 p-4">
                <div>
                  <h4 className="text-xs font-semibold text-indigo-100">Application configuration preview</h4>
                  <p className="mt-1 text-[11px] text-zinc-400">This is the versioned setup that will be saved and applied with your first day.</p>
                </div>
                <div className="grid gap-2 text-[11px] text-zinc-300 sm:grid-cols-2">
                  <div>
                    <span className="text-zinc-500">Modules</span>
                    <p>{configurationPreview.enabledModules.map((id) => SYSTEM_MODULE_REGISTRY.find((item) => item.id === id)?.label || id).join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Dashboard</span>
                    <p>{configurationPreview.dashboardLayout.map((id) => DASHBOARD_WIDGET_REGISTRY.find((item) => item.id === id)?.label || id).join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Primary goal</span>
                    <p>{configurationPreview.goals.primary}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">AI behavior</span>
                    <p>{configurationPreview.aiBehavior === 'enabled' ? 'Enabled by selected preferences' : 'Disabled by selected preferences'}</p>
                  </div>
                </div>
                <label className="flex items-start gap-2 text-xs text-zinc-200">
                  <input
                    type="checkbox"
                    checked={configurationConfirmed}
                    onChange={(event) => setConfigurationConfirmed(event.target.checked)}
                    className="mt-0.5 accent-indigo-400"
                  />
                  <span>I confirm this application configuration and want it applied with my initial day.</span>
                </label>
              </section>
            )}

            {errorMessage && (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            {draftSaveError && (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-200">
                Requirements must save before your routine can be generated.
              </div>
            )}

            {statusMessage && (
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/40 p-2.5 text-xs font-mono text-indigo-300">
                {statusMessage}
              </div>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button
                onClick={() => changeStep(5)}
                disabled={isSynthesizing || isInterpreting}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white disabled:opacity-50"
              >
                Edit answers
              </button>
              {requirements && (
                <button
                  onClick={() => void handleSynthesize()}
                  disabled={isSynthesizing || isInterpreting || !configurationConfirmed}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-white via-zinc-200 to-zinc-300 px-5 py-2.5 text-xs font-semibold text-black shadow-xl transition-all hover:opacity-95 disabled:opacity-50"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving & generating…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-black" />
                      <span>Confirm configuration & generate</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
