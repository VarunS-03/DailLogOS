import {
  OnboardingAnswers,
  OnboardingAppPreference,
  OnboardingCapacity,
  OnboardingChronotype,
  OnboardingPillar,
  OnboardingPlanningStyle,
  OnboardingProgress,
  OnboardingRequirements,
  OnboardingRole,
  OnboardingStatus,
} from '../types';

export const CURRENT_ONBOARDING_VERSION = 1;
export const CURRENT_ONBOARDING_ANSWERS_VERSION = 1;
export const CURRENT_ONBOARDING_REQUIREMENTS_VERSION = 1;

const ONBOARDING_ROLES: OnboardingRole[] = ['student', 'engineer', 'founder', 'creator', 'fitness', 'custom'];
const ONBOARDING_CHRONOTYPES: OnboardingChronotype[] = ['early', 'standard', 'night'];
const ONBOARDING_CAPACITIES: OnboardingCapacity[] = ['minimum', 'moderate', 'high'];
const ONBOARDING_PILLARS: OnboardingPillar[] = ['dsa', 'academics', 'fitness', 'projects', 'reading'];
const ONBOARDING_PLANNING_STYLES: OnboardingPlanningStyle[] = ['minimal', 'balanced', 'structured'];
const ONBOARDING_APP_PREFERENCES: OnboardingAppPreference[] = [
  'daily_briefing',
  'gentle_prompts',
  'weekly_review',
  'ai_suggestions',
];

function isUniqueChoiceList<T extends string>(
  input: unknown,
  choices: T[],
  minLength: number,
  maxLength: number
): input is T[] {
  if (!Array.isArray(input) || input.length < minLength || input.length > maxLength) return false;
  for (let index = 0; index < input.length; index++) {
    if (typeof input[index] !== 'string' || !choices.includes(input[index] as T)) return false;
  }
  return new Set(input).size === input.length;
}

export function createDefaultOnboardingAnswers(): OnboardingAnswers {
  return {
    schemaVersion: CURRENT_ONBOARDING_ANSWERS_VERSION,
    targetRole: 'student',
    customRoleTitle: '',
    chronotype: 'standard',
    wakeTime: '07:00',
    sleepTime: '23:30',
    deepWorkCapacity: 'moderate',
    availableHoursPerDay: 4,
    workDaysPerWeek: 5,
    fixedCommitments: '',
    primaryGoal: '',
    secondaryGoals: '',
    trackingAreas: ['academics', 'dsa'],
    workoutMode: 'gym',
    preferredSessionMinutes: 50,
    planningStyle: 'balanced',
    appPreferences: ['daily_briefing', 'weekly_review'],
    customInstructions: '',
  };
}

export function validateOnboardingAnswers(value: unknown): OnboardingAnswers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const expectedKeys = Object.keys(createDefaultOnboardingAnswers());
  if (Object.keys(data).some((key) => !expectedKeys.includes(key))) return null;

  const isShortText = (input: unknown, maxLength: number): input is string =>
    typeof input === 'string' && input.length <= maxLength;
  const isClockTime = (input: unknown): input is string =>
    typeof input === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input);

  if (
    data.schemaVersion !== CURRENT_ONBOARDING_ANSWERS_VERSION
    || !ONBOARDING_ROLES.includes(data.targetRole as OnboardingRole)
    || !isShortText(data.customRoleTitle, 80)
    || !ONBOARDING_CHRONOTYPES.includes(data.chronotype as OnboardingChronotype)
    || !isClockTime(data.wakeTime)
    || !isClockTime(data.sleepTime)
    || !ONBOARDING_CAPACITIES.includes(data.deepWorkCapacity as OnboardingCapacity)
    || !Number.isInteger(data.availableHoursPerDay)
    || Number(data.availableHoursPerDay) < 1
    || Number(data.availableHoursPerDay) > 16
    || !Number.isInteger(data.workDaysPerWeek)
    || Number(data.workDaysPerWeek) < 1
    || Number(data.workDaysPerWeek) > 7
    || !isShortText(data.fixedCommitments, 1000)
    || !isShortText(data.primaryGoal, 500)
    || !isShortText(data.secondaryGoals, 500)
    || !isUniqueChoiceList(data.trackingAreas, ONBOARDING_PILLARS, 1, 5)
    || (data.workoutMode !== 'gym' && data.workoutMode !== 'home')
    || (data.preferredSessionMinutes !== 25 && data.preferredSessionMinutes !== 50 && data.preferredSessionMinutes !== 90)
    || !ONBOARDING_PLANNING_STYLES.includes(data.planningStyle as OnboardingPlanningStyle)
    || !isUniqueChoiceList(data.appPreferences, ONBOARDING_APP_PREFERENCES, 0, 4)
    || !isShortText(data.customInstructions, 1000)
  ) {
    return null;
  }

  return {
    schemaVersion: CURRENT_ONBOARDING_ANSWERS_VERSION,
    targetRole: data.targetRole as OnboardingRole,
    customRoleTitle: data.customRoleTitle,
    chronotype: data.chronotype as OnboardingChronotype,
    wakeTime: data.wakeTime,
    sleepTime: data.sleepTime,
    deepWorkCapacity: data.deepWorkCapacity as OnboardingCapacity,
    availableHoursPerDay: data.availableHoursPerDay as number,
    workDaysPerWeek: data.workDaysPerWeek as number,
    fixedCommitments: data.fixedCommitments,
    primaryGoal: data.primaryGoal,
    secondaryGoals: data.secondaryGoals,
    trackingAreas: [...data.trackingAreas] as OnboardingPillar[],
    workoutMode: data.workoutMode,
    preferredSessionMinutes: data.preferredSessionMinutes,
    planningStyle: data.planningStyle as OnboardingPlanningStyle,
    appPreferences: [...data.appPreferences] as OnboardingAppPreference[],
    customInstructions: data.customInstructions,
  };
}

export function validateOnboardingRequirements(value: unknown): OnboardingRequirements | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const expectedKeys = ['schemaVersion', 'sourceAnswers', 'interpretation', 'source', 'userConfirmed', 'generatedAt'];
  if (Object.keys(data).some((key) => !expectedKeys.includes(key))) return null;

  const sourceAnswers = validateOnboardingAnswers(data.sourceAnswers);
  const interpretation = data.interpretation;
  if (!sourceAnswers || !interpretation || typeof interpretation !== 'object' || Array.isArray(interpretation)) return null;
  const interpretationData = interpretation as Record<string, unknown>;
  const interpretationKeys = ['summary', 'priorityAreas', 'constraints'];
  if (Object.keys(interpretationData).some((key) => !interpretationKeys.includes(key))) return null;

  const priorityAreas = interpretationData.priorityAreas;
  const constraints = interpretationData.constraints;
  if (
    data.schemaVersion !== CURRENT_ONBOARDING_REQUIREMENTS_VERSION
    || (data.source !== 'gemini' && data.source !== 'offline')
    || typeof data.userConfirmed !== 'boolean'
    || typeof data.generatedAt !== 'string'
    || data.generatedAt.length > 64
    || !Number.isFinite(Date.parse(data.generatedAt))
    || typeof interpretationData.summary !== 'string'
    || interpretationData.summary.trim().length === 0
    || interpretationData.summary.length > 500
    || !isUniqueChoiceList(priorityAreas, ONBOARDING_PILLARS, 1, 5)
    || priorityAreas.some((area) => !sourceAnswers.trackingAreas.includes(area))
    || typeof constraints !== 'string'
    || constraints.length > 1000
  ) {
    return null;
  }

  return {
    schemaVersion: CURRENT_ONBOARDING_REQUIREMENTS_VERSION,
    sourceAnswers,
    interpretation: {
      summary: interpretationData.summary,
      priorityAreas: [...priorityAreas],
      constraints,
    },
    source: data.source,
    userConfirmed: data.userConfirmed,
    generatedAt: data.generatedAt,
  };
}

export function onboardingRequirementsMatchAnswers(requirements: unknown, answers: unknown): boolean {
  const validatedRequirements = validateOnboardingRequirements(requirements);
  const validatedAnswers = validateOnboardingAnswers(answers);
  return Boolean(
    validatedRequirements
    && validatedAnswers
    && JSON.stringify(validatedRequirements.sourceAnswers) === JSON.stringify(validatedAnswers)
  );
}

export function createInitialOnboardingProgress(
  hasLegacyAccountData: boolean,
  now: string
): OnboardingProgress {
  return {
    status: hasLegacyAccountData ? 'completed' : 'not_started',
    version: CURRENT_ONBOARDING_VERSION,
    currentStage: hasLegacyAccountData ? 6 : 1,
    ...(hasLegacyAccountData ? { completedAt: now } : {}),
    updatedAt: now,
  };
}

export function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return value === 'not_started' || value === 'in_progress' || value === 'completed';
}

export function shouldShowOnboarding(input: {
  authResolved: boolean;
  isAuthenticated: boolean;
  accountReady: boolean;
  onboardingStatus: OnboardingStatus | null;
  guestOnboardingComplete: boolean;
  dismissed: boolean;
}): boolean {
  if (!input.authResolved || input.dismissed) return false;
  if (!input.isAuthenticated) return !input.guestOnboardingComplete;
  return input.accountReady && input.onboardingStatus !== null && input.onboardingStatus !== 'completed';
}
