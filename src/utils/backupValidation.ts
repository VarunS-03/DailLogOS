import {
  BEHAVIORAL_LIMITS,
  BehavioralReview,
  CreditEvent,
  DayRecord,
  DayStart,
  FocusSession,
  Outcome,
  RecoveryDecision,
  TomorrowHandoff,
  UserSettings,
} from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedDays?: Record<string, DayRecord>;
  sanitizedSettings?: UserSettings;
  stats?: {
    recordCount: number;
    startDate: string;
    endDate: string;
  };
}

const ISO_DATE_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const BEHAVIORAL_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const OUTCOME_STATUSES = ['planned', 'active', 'completed', 'partial', 'blocked', 'missed', 'abandoned', 'dropped'];
const FOCUS_SESSION_STATUSES = ['active', 'completed', 'partial', 'blocked', 'abandoned'];
const RECOVERY_TYPES = ['rescue', 'reschedule', 'reduce', 'drop', 'blocked'];
const FAILURE_REASONS = ['underestimated_difficulty', 'avoidance', 'poor_planning', 'interruption', 'low_energy', 'unclear_next_action', 'dependency_blocker', 'overcommitment', 'unexpected_work'];
const CREDIT_TYPES = ['output', 'partial_output', 'recovery', 'workout', 'review', 'milestone'];
const BEHAVIORAL_DOMAINS = ['academics', 'dsa', 'project', 'workout', 'habits', 'schedule', 'other'];
const OUTCOME_SOURCES = ['handoff', 'schedule', 'domain', 'user'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidBehavioralId(value: unknown): value is string {
  return typeof value === 'string' && BEHAVIORAL_ID_REGEX.test(value);
}

function isShortString(value: unknown, maxLength: number, required = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (!required || value.trim().length > 0);
}

function isTimestamp(value: unknown, required = true): value is string {
  return isShortString(value, 64, required);
}

function validateBehavioralFields(rawDay: Record<string, unknown>): string | undefined {
  if (rawDay.schemaVersion !== undefined && (!Number.isInteger(rawDay.schemaVersion) || (rawDay.schemaVersion as number) < 0 || (rawDay.schemaVersion as number) > 100)) return 'schemaVersion is invalid.';
  if (rawDay.dayStart !== undefined) {
    const value = rawDay.dayStart;
    if (!isRecord(value) || !ISO_DATE_REGEX.test(String(value.date)) || !isTimestamp(value.startedAt) || !isTimestamp(value.acceptedAt) || !['normal', 'reduced', 'minimum'].includes(String(value.capacityMode)) || !isShortString(value.firstAction, 1000, true) || (value.implementationIntention !== undefined && !isShortString(value.implementationIntention, 1000))) return 'dayStart is invalid.';
  }
  const arrays: Array<[keyof typeof BEHAVIORAL_LIMITS, unknown]> = [['outcomes', rawDay.outcomes], ['focusSessions', rawDay.focusSessions], ['recoveryDecisions', rawDay.recoveryDecisions], ['creditEvents', rawDay.creditEvents]];
  for (const [key, value] of arrays) if (value !== undefined && (!Array.isArray(value) || value.length > BEHAVIORAL_LIMITS[key])) return `${key} exceeds its safe limit.`;
  if (Array.isArray(rawDay.outcomes) && rawDay.outcomes.some((v) => !isRecord(v) || !isValidBehavioralId(v.id) || !BEHAVIORAL_DOMAINS.includes(String(v.domain)) || !isShortString(v.title, 500, true) || !isShortString(v.minimumOutput, 2000, true) || !Number.isInteger(v.priority) || (v.priority as number) < 1 || (v.priority as number) > 3 || !OUTCOME_STATUSES.includes(String(v.status)) || !OUTCOME_SOURCES.includes(String(v.source)) || !isTimestamp(v.createdAt) || (v.resolvedAt !== undefined && !isTimestamp(v.resolvedAt)) || (v.replacementReason !== undefined && !isShortString(v.replacementReason, 1000)))) return 'outcomes contains an invalid entry.';
  if (Array.isArray(rawDay.focusSessions) && rawDay.focusSessions.some((v) => !isRecord(v) || !isValidBehavioralId(v.id) || !isShortString(v.objective, 1000, true) || !isShortString(v.minimumOutput, 2000, true) || (v.intendedMinutes !== undefined && (!Number.isInteger(v.intendedMinutes) || (v.intendedMinutes as number) < 1 || (v.intendedMinutes as number) > 720)) || !isTimestamp(v.startedAt) || (v.endedAt !== undefined && !isTimestamp(v.endedAt)) || !FOCUS_SESSION_STATUSES.includes(String(v.status)) || (v.output !== undefined && !isShortString(v.output, 5000)))) return 'focusSessions contains an invalid entry.';
  if (Array.isArray(rawDay.recoveryDecisions) && rawDay.recoveryDecisions.some((v) => !isRecord(v) || !isValidBehavioralId(v.id) || !RECOVERY_TYPES.includes(String(v.type)) || !isShortString(v.reason, 1000, true) || !isTimestamp(v.createdAt) || (v.newScope !== undefined && !isShortString(v.newScope, 2000)) || (v.nextAction !== undefined && !isShortString(v.nextAction, 1000)))) return 'recoveryDecisions contains an invalid entry.';
  if (rawDay.behavioralReview !== undefined) {
    const value = rawDay.behavioralReview;
    if (!isRecord(value) || !isShortString(value.movedForward, 2000) || !Array.isArray(value.failureReasons) || value.failureReasons.length > 10 || value.failureReasons.some((reason) => !FAILURE_REASONS.includes(String(reason))) || !isShortString(value.adjustment, 2000) || typeof value.reviewComplete !== 'boolean' || (value.completedAt !== undefined && !isTimestamp(value.completedAt))) return 'behavioralReview is invalid.';
  }
  if (rawDay.tomorrowHandoff !== undefined) {
    const value = rawDay.tomorrowHandoff;
    if (!isRecord(value) || !isTimestamp(value.createdAt) || !isShortString(value.firstAction, 1000, true) || (value.carryForwardOutcomeId !== undefined && !isValidBehavioralId(value.carryForwardOutcomeId)) || (value.blockerAction !== undefined && !isShortString(value.blockerAction, 1000)) || (value.dueReviewReference !== undefined && !isShortString(value.dueReviewReference, 500)) || (value.adjustment !== undefined && !isShortString(value.adjustment, 2000)) || (value.note !== undefined && !isShortString(value.note, 2000))) return 'tomorrowHandoff is invalid.';
  }
  if (Array.isArray(rawDay.creditEvents) && rawDay.creditEvents.some((v) => !isRecord(v) || !isValidBehavioralId(v.id) || !CREDIT_TYPES.includes(String(v.type)) || !isTimestamp(v.createdAt) || (v.sourceId !== undefined && !isValidBehavioralId(v.sourceId)) || (v.note !== undefined && !isShortString(v.note, 1000)))) return 'creditEvents contains an invalid entry.';
  return undefined;
}

/**
 * Strips dangerous HTML/script tags from user input to prevent XSS payloads.
 */
export function sanitizeString(val: unknown, maxLength: number): string {
  if (typeof val !== 'string') return '';
  // Strip null bytes and <script ...> tags
  const sanitized = val
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitizes and clamps numeric ratings into valid integer bounds.
 */
export function sanitizeNumber(val: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof val !== 'number' || isNaN(val)) return defaultVal;
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Comprehensive schema and volumetric validator for imported backup JSON.
 */
export function validateAndSanitizeBackup(rawContent: string): ValidationResult {
  // Max file size: 5MB
  if (rawContent.length > 5 * 1024 * 1024) {
    return { valid: false, error: 'Backup payload exceeds maximum safe size (5MB).' };
  }

  let json: any;
  try {
    json = JSON.parse(rawContent);
  } catch {
    return { valid: false, error: 'Malformed JSON syntax. Please provide a valid JSON backup file.' };
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, error: 'Invalid root structure: Expected a backup object.' };
  }

  if (!json.days || typeof json.days !== 'object' || Array.isArray(json.days)) {
    return { valid: false, error: 'Invalid backup structure: "days" object is missing or invalid.' };
  }

  const rawDays = json.days as Record<string, any>;
  const dayKeys = Object.keys(rawDays);

  if (dayKeys.length === 0) {
    return { valid: false, error: 'Backup contains zero daily records.' };
  }

  if (dayKeys.length > 1000) {
    return { valid: false, error: 'Backup contains more than 1,000 daily records. Exceeds safe import limits.' };
  }

  const sanitizedDays: Record<string, DayRecord> = {};
  const sortedKeys: string[] = [];

  for (const dateKey of dayKeys) {
    if (!ISO_DATE_REGEX.test(dateKey)) {
      return { valid: false, error: `Invalid date key format "${dateKey.slice(0, 20)}". Expected YYYY-MM-DD.` };
    }

    const rawDay = rawDays[dateKey];
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) {
      continue; // skip invalid day entry
    }

    const behavioralError = validateBehavioralFields(rawDay as Record<string, unknown>);
    if (behavioralError) {
      return { valid: false, error: `Invalid Behavioral Core data for ${dateKey}: ${behavioralError}` };
    }

    sortedKeys.push(dateKey);

    // Sanitize Day Record
    const dayRecord: DayRecord = {
      schemaVersion: typeof rawDay.schemaVersion === 'number' ? rawDay.schemaVersion : 0,
      date: dateKey,
      dayOfWeek: sanitizeString(rawDay.dayOfWeek, 20) || 'Unknown',
      completionPercentage: sanitizeNumber(rawDay.completionPercentage, 0, 100, 0),
      notes: sanitizeString(rawDay.notes, 5000),
      mood: sanitizeNumber(rawDay.mood, 1, 5, 3),
      energy: sanitizeNumber(rawDay.energy, 1, 5, 3),
      sleep: sanitizeNumber(rawDay.sleep, 1, 5, 3),
      tomorrowFirstAction: sanitizeString(rawDay.tomorrowFirstAction, 1000) || sanitizeString(rawDay.dailyReflection?.tomorrowFirstAction, 1000),
      createdAt: typeof rawDay.createdAt === 'string' ? rawDay.createdAt.slice(0, 64) : new Date().toISOString(),
      updatedAt: typeof rawDay.updatedAt === 'string' ? rawDay.updatedAt.slice(0, 64) : new Date().toISOString(),

      // Daily Reflection
      dailyReflection: {
        academicLearned: sanitizeString(rawDay.dailyReflection?.academicLearned, 5000),
        academicRetrieve: sanitizeString(rawDay.dailyReflection?.academicRetrieve, 5000),
        academicWeak: sanitizeString(rawDay.dailyReflection?.academicWeak, 5000),
        dsaProblem: sanitizeString(rawDay.dailyReflection?.dsaProblem, 500),
        dsaPattern: sanitizeString(rawDay.dailyReflection?.dsaPattern, 200),
        dsaInsight: sanitizeString(rawDay.dailyReflection?.dsaInsight, 10000),
        dsaMistake: sanitizeString(rawDay.dailyReflection?.dsaMistake, 5000),
        dsaReviewDate: sanitizeString(rawDay.dailyReflection?.dsaReviewDate, 20),
        projectArtifact: sanitizeString(rawDay.dailyReflection?.projectArtifact, 5000),
        tomorrowFirstAction: sanitizeString(rawDay.dailyReflection?.tomorrowFirstAction, 1000),
        notes: sanitizeString(rawDay.dailyReflection?.notes, 10000),
      },

      // Schedule (capped to 50 items)
      schedule: Array.isArray(rawDay.schedule)
        ? rawDay.schedule.slice(0, 50).map((s: any, idx: number) => ({
            id: sanitizeString(s?.id || `sched-${idx}`, 50),
            time: sanitizeString(s?.time, 50),
            title: sanitizeString(s?.title, 200),
            category: ['wake', 'academic', 'break', 'workout', 'dsa', 'project', 'reading', 'sleep', 'other'].includes(s?.category)
              ? s.category
              : 'other',
            status: ['pending', 'completed', 'skipped'].includes(s?.status) ? s.status : 'pending',
            note: sanitizeString(s?.note, 500),
          }))
        : [],

      // Habits (capped to 50 items)
      habits: Array.isArray(rawDay.habits)
        ? rawDay.habits.slice(0, 50).map((h: any, idx: number) => ({
            id: sanitizeString(h?.id || `habit-${idx}`, 50),
            title: sanitizeString(h?.title, 200),
            detail: sanitizeString(h?.detail, 500),
            completed: Boolean(h?.completed),
            timeOfDay: ['morning', 'anytime', 'evening'].includes(h?.timeOfDay) ? h.timeOfDay : 'anytime',
          }))
        : [],

      // Academics
      academics: {
        subject: sanitizeString(rawDay.academics?.subject, 100),
        secondarySubject: sanitizeString(rawDay.academics?.secondarySubject, 100),
        objective: sanitizeString(rawDay.academics?.objective, 2000),
        learned: sanitizeString(rawDay.academics?.learned, 5000),
        retrieve: sanitizeString(rawDay.academics?.retrieve, 5000),
        weak: sanitizeString(rawDay.academics?.weak, 5000),
        output: sanitizeString(rawDay.academics?.output, 5000),
        timeSpent: sanitizeString(rawDay.academics?.timeSpent, 50),
      },

      // DSA (capped to 50 items)
      dsa: Array.isArray(rawDay.dsa)
        ? rawDay.dsa.slice(0, 50).map((d: any, idx: number) => ({
            id: sanitizeString(d?.id || `dsa-${idx}`, 50),
            problem: sanitizeString(d?.problem, 500),
            platform: ['LeetCode', 'Codeforces', 'GeeksforGeeks', 'NeetCode', 'Other'].includes(d?.platform)
              ? d.platform
              : 'Other',
            difficulty: ['Easy', 'Medium', 'Hard'].includes(d?.difficulty) ? d.difficulty : 'Medium',
            pattern: sanitizeString(d?.pattern, 200),
            firstIdea: sanitizeString(d?.firstIdea, 2000),
            solvedIndependently: Boolean(d?.solvedIndependently),
            failureMistake: sanitizeString(d?.failureMistake, 5000),
            insight: sanitizeString(d?.insight, 10000),
            algorithm: sanitizeString(d?.algorithm, 5000),
            timeComplexity: sanitizeString(d?.timeComplexity, 100),
            spaceComplexity: sanitizeString(d?.spaceComplexity, 100),
            reimplemented: Boolean(d?.reimplemented),
            reviewDate: sanitizeString(d?.reviewDate, 20),
            tags: Array.isArray(d?.tags) ? d.tags.slice(0, 10).map((t: any) => sanitizeString(t, 50)) : [],
          }))
        : [],

      // Workout
      workout: {
        mode: rawDay.workout?.mode === 'home' ? 'home' : 'gym',
        cycleDay: sanitizeString(rawDay.workout?.cycleDay, 100) || 'Day A',
        status: ['not_started', 'in_progress', 'completed', 'partially_completed', 'skipped'].includes(rawDay.workout?.status)
          ? rawDay.workout.status
          : 'not_started',
        notes: sanitizeString(rawDay.workout?.notes, 5000),
        exercises: Array.isArray(rawDay.workout?.exercises)
          ? rawDay.workout.exercises.slice(0, 30).map((ex: any, idx: number) => ({
              id: sanitizeString(ex?.id || `ex-${idx}`, 50),
              name: sanitizeString(ex?.name, 200),
              target: sanitizeString(ex?.target, 100),
              completed: Boolean(ex?.completed),
              skipped: Boolean(ex?.skipped),
              sets: sanitizeNumber(ex?.sets, 1, 10, 3),
              reps: sanitizeString(ex?.reps, 50),
              weight: sanitizeString(ex?.weight, 50),
              duration: sanitizeString(ex?.duration, 50),
              notes: sanitizeString(ex?.notes, 1000),
            }))
          : [],
        dailyNonNegotiables: Array.isArray(rawDay.workout?.dailyNonNegotiables)
          ? rawDay.workout.dailyNonNegotiables.slice(0, 20).map((nn: any, idx: number) => ({
              id: sanitizeString(nn?.id || `nn-${idx}`, 50),
              name: sanitizeString(nn?.name, 200),
              target: sanitizeString(nn?.target, 100),
              completed: Boolean(nn?.completed),
            }))
          : [],
      },

      // Project
      project: {
        name: sanitizeString(rawDay.project?.name, 200),
        goal: sanitizeString(rawDay.project?.goal, 2000),
        workedOn: sanitizeString(rawDay.project?.workedOn, 5000),
        artifact: sanitizeString(rawDay.project?.artifact, 5000),
        blocker: sanitizeString(rawDay.project?.blocker, 5000),
        nextAction: sanitizeString(rawDay.project?.nextAction, 2000),
      },

      // Skills
      skills: {
        topic: sanitizeString(rawDay.skills?.topic, 200),
        focus: sanitizeString(rawDay.skills?.focus, 2000),
        notes: sanitizeString(rawDay.skills?.notes, 5000),
      },
      dayStart: rawDay.dayStart as DayStart | undefined,
      outcomes: rawDay.outcomes as Outcome[] | undefined,
      focusSessions: rawDay.focusSessions as FocusSession[] | undefined,
      recoveryDecisions: rawDay.recoveryDecisions as RecoveryDecision[] | undefined,
      behavioralReview: rawDay.behavioralReview as BehavioralReview | undefined,
      tomorrowHandoff: rawDay.tomorrowHandoff as TomorrowHandoff | undefined,
      creditEvents: rawDay.creditEvents as CreditEvent[] | undefined,
    };

    sanitizedDays[dateKey] = dayRecord;
  }

  sortedKeys.sort();

  // Settings validation (optional)
  let sanitizedSettings: UserSettings | undefined;
  if (json.settings && typeof json.settings === 'object') {
    sanitizedSettings = {
      defaultWorkoutMode: json.settings.defaultWorkoutMode === 'home' ? 'home' : 'gym',
      academicSchedule: typeof json.settings.academicSchedule === 'object' ? json.settings.academicSchedule : {},
      theme: json.settings.theme === 'light' ? 'light' : 'dark',
      notificationsEnabled: Boolean(json.settings.notificationsEnabled),
    };
  }

  return {
    valid: true,
    sanitizedDays,
    sanitizedSettings,
    stats: {
      recordCount: sortedKeys.length,
      startDate: sortedKeys[0],
      endDate: sortedKeys[sortedKeys.length - 1],
    },
  };
}
