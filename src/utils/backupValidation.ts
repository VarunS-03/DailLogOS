import {
  BEHAVIORAL_LIMITS,
  BehavioralReview,
  CreditEvent,
  DayRecord,
  DayStart,
  FocusSession,
  HabitItem,
  NonNegotiableItem,
  Outcome,
  RecoveryDecision,
  ScheduleItem,
  TomorrowHandoff,
  UserSettings,
} from '../types';
import { getPrescribedSetCount } from './workout';
import {
  validateCustomTrackerValues,
  validateUserSystemConfiguration,
} from '../services/systemConfiguration';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedDays?: Record<string, DayRecord>;
  sanitizedSettings?: Partial<UserSettings>;
  stats?: {
    recordCount: number;
    startDate?: string;
    endDate?: string;
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
  if (!isShortString(value, 64, required)) return false;
  return (!required && value.length === 0) || Number.isFinite(Date.parse(value));
}

function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateStringFields(
  value: Record<string, unknown>,
  limits: Record<string, number>
): boolean {
  return Object.entries(limits).every(([key, maxLength]) => (
    value[key] === undefined || isShortString(value[key], maxLength)
  ));
}

function validateDayShape(day: Record<string, unknown>, dateKey: string): string | undefined {
  const allowedFields = new Set([
    'schemaVersion', 'date', 'dayOfWeek', 'completionPercentage', 'notes', 'mood', 'energy',
    'sleep', 'dailyReflection', 'tomorrowFirstAction', 'schedule', 'habits', 'academics', 'dsa',
    'workout', 'project', 'skills', 'dayStart', 'outcomes', 'focusSessions', 'recoveryDecisions',
    'behavioralReview', 'tomorrowHandoff', 'creditEvents', 'customTrackerValues', 'syncRevision',
    'createdAt', 'updatedAt', 'lastSyncedAt',
  ]);
  if (Object.keys(day).some((key) => !allowedFields.has(key))) return 'contains unsupported fields.';
  if (day.date !== undefined && day.date !== dateKey) return 'date does not match its day key.';

  const numericBounds: Record<string, [number, number]> = {
    completionPercentage: [0, 100],
    mood: [1, 5],
    energy: [1, 5],
    sleep: [1, 5],
  };
  for (const [field, [minimum, maximum]] of Object.entries(numericBounds)) {
    const value = day[field];
    if (value !== undefined && (
      typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum
    )) return `${field} is outside its valid range.`;
  }
  if (day.schemaVersion !== undefined && (
    !Number.isInteger(day.schemaVersion) || (day.schemaVersion as number) < 0 || (day.schemaVersion as number) > 100
  )) return 'schemaVersion is invalid.';
  if (day.syncRevision !== undefined && (
    !Number.isInteger(day.syncRevision) || (day.syncRevision as number) < 0 || (day.syncRevision as number) > 2147483647
  )) return 'syncRevision is invalid.';
  if (day.createdAt !== undefined && !isTimestamp(day.createdAt)) return 'createdAt is invalid.';
  if (day.updatedAt !== undefined && !isTimestamp(day.updatedAt)) return 'updatedAt is invalid.';
  if (day.lastSyncedAt !== undefined && !isTimestamp(day.lastSyncedAt)) return 'lastSyncedAt is invalid.';
  if (!validateStringFields(day, {
    dayOfWeek: 20,
    notes: 5000,
    tomorrowFirstAction: 1000,
  })) return 'contains an invalid text field.';

  const objectFields = ['dailyReflection', 'academics', 'workout', 'project', 'skills'];
  for (const field of objectFields) {
    if (day[field] !== undefined && !isRecord(day[field])) return `${field} must be an object.`;
  }
  const arrays: Array<[string, number]> = [
    ['schedule', 50],
    ['habits', 50],
    ['dsa', 50],
  ];
  for (const [field, maximum] of arrays) {
    const value = day[field];
    if (value !== undefined && (!Array.isArray(value) || value.length > maximum || value.some((entry) => !isRecord(entry)))) {
      return `${field} must be a bounded list of objects.`;
    }
  }
  if (isRecord(day.dailyReflection) && !validateStringFields(day.dailyReflection, {
    academicLearned: 5000,
    academicRetrieve: 5000,
    academicWeak: 5000,
    dsaProblem: 500,
    dsaPattern: 200,
    dsaInsight: 10000,
    dsaMistake: 5000,
    dsaReviewDate: 20,
    projectArtifact: 5000,
    tomorrowFirstAction: 1000,
    notes: 10000,
  })) return 'dailyReflection contains an invalid text field.';
  if (isRecord(day.academics) && !validateStringFields(day.academics, {
    subject: 100,
    secondarySubject: 100,
    objective: 2000,
    learned: 5000,
    retrieve: 5000,
    weak: 5000,
    output: 5000,
    timeSpent: 50,
  })) return 'academics contains an invalid text field.';
  if (isRecord(day.project) && !validateStringFields(day.project, {
    name: 200,
    goal: 2000,
    workedOn: 5000,
    artifact: 5000,
    blocker: 5000,
    nextAction: 2000,
  })) return 'project contains an invalid text field.';
  if (isRecord(day.skills) && !validateStringFields(day.skills, {
    topic: 200,
    focus: 2000,
    notes: 5000,
  })) return 'skills contains an invalid text field.';
  if (isRecord(day.workout)) {
    if (
      (day.workout.mode !== undefined && !['gym', 'home'].includes(String(day.workout.mode)))
      || (day.workout.status !== undefined && !['not_started', 'in_progress', 'completed', 'partially_completed', 'skipped'].includes(String(day.workout.status)))
      || (day.workout.exercises !== undefined && (
        !Array.isArray(day.workout.exercises)
        || day.workout.exercises.length > 30
        || day.workout.exercises.some((exercise) => !isRecord(exercise))
      ))
      || (day.workout.dailyNonNegotiables !== undefined && (
        !Array.isArray(day.workout.dailyNonNegotiables)
        || day.workout.dailyNonNegotiables.length > 20
        || day.workout.dailyNonNegotiables.some((item) => !isRecord(item))
      ))
    ) return 'workout has an invalid structure.';
  }
  const behavioralError = validateBehavioralFields(day);
  if (behavioralError) return behavioralError;
  return undefined;
}

function sanitizeDailySystem(value: unknown): UserSettings['dailySystem'] | null {
  if (!isRecord(value)) return null;
  const categories: ScheduleItem['category'][] = ['wake', 'academic', 'break', 'workout', 'dsa', 'project', 'reading', 'sleep', 'other'];
  const keys = ['workoutMode', 'schedule', 'habits', 'nonNegotiables', 'workoutCycle', 'workoutExercises'];
  if (
    Object.keys(value).some((key) => !keys.includes(key))
    || (value.workoutMode !== 'gym' && value.workoutMode !== 'home')
    || !isShortString(value.workoutCycle, 200, true)
    || !Array.isArray(value.schedule) || value.schedule.length < 1 || value.schedule.length > 50
    || !Array.isArray(value.habits) || value.habits.length < 1 || value.habits.length > 30
    || !Array.isArray(value.nonNegotiables) || value.nonNegotiables.length < 1 || value.nonNegotiables.length > 20
    || !Array.isArray(value.workoutExercises) || value.workoutExercises.length < 1 || value.workoutExercises.length > 30
  ) return null;

  const schedule: ScheduleItem[] = [];
  for (const item of value.schedule) {
    if (
      !isRecord(item)
      || Object.keys(item).some((key) => !['id', 'time', 'title', 'category', 'status', 'note'].includes(key))
      || !isShortString(item.id, 64, true) || !isShortString(item.time, 50, true)
      || !isShortString(item.title, 200, true) || !categories.includes(item.category as ScheduleItem['category'])
      || !['pending', 'completed', 'skipped'].includes(String(item.status))
      || (item.note !== undefined && !isShortString(item.note, 500))
    ) return null;
    schedule.push({
      id: item.id,
      time: item.time,
      title: sanitizeString(item.title, 200),
      category: item.category as ScheduleItem['category'],
      status: item.status as ScheduleItem['status'],
      note: sanitizeString(item.note, 500),
    });
  }

  const habits: HabitItem[] = [];
  for (const item of value.habits) {
    if (
      !isRecord(item)
      || Object.keys(item).some((key) => !['id', 'title', 'detail', 'completed', 'timeOfDay'].includes(key))
      || !isShortString(item.id, 64, true) || !isShortString(item.title, 200, true)
      || (item.detail !== undefined && !isShortString(item.detail, 500))
      || typeof item.completed !== 'boolean'
      || (item.timeOfDay !== undefined && !['morning', 'anytime', 'evening'].includes(String(item.timeOfDay)))
    ) return null;
    habits.push({
      id: item.id,
      title: sanitizeString(item.title, 200),
      detail: sanitizeString(item.detail, 500),
      completed: item.completed,
      timeOfDay: item.timeOfDay as HabitItem['timeOfDay'],
    });
  }

  const nonNegotiables: NonNegotiableItem[] = [];
  for (const item of value.nonNegotiables) {
    if (
      !isRecord(item)
      || Object.keys(item).some((key) => !['id', 'name', 'target', 'completed'].includes(key))
      || !isShortString(item.id, 64, true) || !isShortString(item.name, 200, true)
      || !isShortString(item.target, 200) || typeof item.completed !== 'boolean'
    ) return null;
    nonNegotiables.push({
      id: item.id,
      name: sanitizeString(item.name, 200),
      target: sanitizeString(item.target, 200),
      completed: item.completed,
    });
  }

  const workoutExercises: NonNullable<UserSettings['dailySystem']>['workoutExercises'] = [];
  for (const item of value.workoutExercises) {
    if (
      !isRecord(item)
      || Object.keys(item).some((key) => !['name', 'target', 'sets'].includes(key))
      || !isShortString(item.name, 200, true) || !isShortString(item.target, 100, true)
      || !Number.isInteger(item.sets) || Number(item.sets) < 1 || Number(item.sets) > 10
    ) return null;
    workoutExercises.push({
      name: sanitizeString(item.name, 200),
      target: sanitizeString(item.target, 100),
      sets: item.sets as number,
    });
  }

  return {
    workoutMode: value.workoutMode,
    schedule,
    habits,
    nonNegotiables,
    workoutCycle: sanitizeString(value.workoutCycle, 200),
    workoutExercises,
  };
}

function sanitizeBackupSettings(value: Record<string, unknown>): {
  settings?: Partial<UserSettings>;
  error?: string;
} {
  const allowedFields = new Set([
    'defaultWorkoutMode', 'academicSchedule', 'dailySystem', 'theme',
    'notificationsEnabled', 'systemConfiguration', 'customWallpaper',
    'wallpaperBlur', 'wallpaperDim',
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return { error: 'The backup settings contain unsupported fields.' };
  }

  const settings: Partial<UserSettings> = {};
  if (value.defaultWorkoutMode !== undefined) {
    if (value.defaultWorkoutMode !== 'gym' && value.defaultWorkoutMode !== 'home') {
      return { error: 'The backup workout mode is invalid.' };
    }
    settings.defaultWorkoutMode = value.defaultWorkoutMode;
  }
  if (value.theme !== undefined) {
    if (value.theme !== 'dark' && value.theme !== 'light') {
      return { error: 'The backup theme is invalid.' };
    }
    settings.theme = value.theme;
  }
  if (value.notificationsEnabled !== undefined) {
    if (typeof value.notificationsEnabled !== 'boolean') {
      return { error: 'The backup notification setting is invalid.' };
    }
    settings.notificationsEnabled = value.notificationsEnabled;
  }
  if (value.academicSchedule !== undefined) {
    if (!isRecord(value.academicSchedule)) {
      return { error: 'The backup academic schedule is invalid.' };
    }
    const academicSchedule: UserSettings['academicSchedule'] = {};
    for (const [day, subjects] of Object.entries(value.academicSchedule)) {
      if (
        day.length > 20
        || !isRecord(subjects)
        || Object.keys(subjects).some((key) => key !== 'primary' && key !== 'secondary')
        || !isShortString(subjects.primary, 100)
        || !isShortString(subjects.secondary, 100)
      ) return { error: `The backup academic schedule entry for "${day.slice(0, 20)}" is invalid.` };
      academicSchedule[day] = {
        primary: subjects.primary,
        secondary: subjects.secondary,
      };
    }
    settings.academicSchedule = academicSchedule;
  }
  if (value.dailySystem !== undefined) {
    const dailySystem = sanitizeDailySystem(value.dailySystem);
    if (!dailySystem) return { error: 'The backup daily system is invalid or contains unsupported fields.' };
    settings.dailySystem = dailySystem;
  }
  if (value.systemConfiguration !== undefined) {
    const systemConfiguration = validateUserSystemConfiguration(value.systemConfiguration);
    if (!systemConfiguration) return { error: 'The backup system configuration is invalid.' };
    settings.systemConfiguration = systemConfiguration;
  }
  if (value.customWallpaper !== undefined) {
    if (typeof value.customWallpaper !== 'string' || value.customWallpaper.length > 4_000_000) {
      return { error: 'The backup wallpaper is invalid or too large.' };
    }
    if (value.customWallpaper) {
      const isRasterDataUrl = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(value.customWallpaper);
      let isHttpsUrl = false;
      try {
        isHttpsUrl = new URL(value.customWallpaper).protocol === 'https:';
      } catch {
        isHttpsUrl = false;
      }
      if (!isRasterDataUrl && !isHttpsUrl) {
        return { error: 'The backup wallpaper must be a safe HTTPS image URL or supported image data URL.' };
      }
    }
    settings.customWallpaper = value.customWallpaper;
  }
  for (const [field, maximum] of [['wallpaperBlur', 20], ['wallpaperDim', 90]] as const) {
    const setting = value[field];
    if (setting === undefined) continue;
    if (typeof setting !== 'number' || !Number.isFinite(setting) || setting < 0 || setting > maximum) {
      return { error: `The backup ${field} setting is invalid.` };
    }
    Object.assign(settings, { [field]: setting });
  }
  return { settings };
}

function validateBehavioralFields(rawDay: Record<string, unknown>): string | undefined {
  if (rawDay.schemaVersion !== undefined && (!Number.isInteger(rawDay.schemaVersion) || (rawDay.schemaVersion as number) < 0 || (rawDay.schemaVersion as number) > 100)) return 'schemaVersion is invalid.';
  if (rawDay.dayStart !== undefined) {
    const value = rawDay.dayStart;
    if (!isRecord(value) || !isCalendarDate(value.date) || !isTimestamp(value.startedAt) || !isTimestamp(value.acceptedAt) || !['normal', 'reduced', 'minimum'].includes(String(value.capacityMode)) || !isShortString(value.firstAction, 1000, true) || (value.implementationIntention !== undefined && !isShortString(value.implementationIntention, 1000))) return 'dayStart is invalid.';
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
  if (rawDay.customTrackerValues !== undefined && !validateCustomTrackerValues(rawDay.customTrackerValues)) return 'customTrackerValues is invalid.';
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

  let json: unknown;
  try {
    json = JSON.parse(rawContent);
  } catch {
    return { valid: false, error: 'Malformed JSON syntax. Please provide a valid JSON backup file.' };
  }

  if (!isRecord(json)) {
    return { valid: false, error: 'Invalid root structure: Expected a backup object.' };
  }

  const allowedRootFields = new Set(['schemaVersion', 'manifest', 'exportDate', 'recordCount', 'settings', 'days']);
  if (Object.keys(json).some((key) => !allowedRootFields.has(key))) {
    return { valid: false, error: 'Backup contains unsupported top-level fields.' };
  }
  if (json.schemaVersion !== undefined && json.schemaVersion !== 1) {
    return { valid: false, error: 'This backup version is not supported.' };
  }
  if (json.manifest !== undefined && !isShortString(json.manifest, 200, true)) {
    return { valid: false, error: 'The backup manifest is invalid.' };
  }
  if (json.exportDate !== undefined && !isTimestamp(json.exportDate)) {
    return { valid: false, error: 'The backup export date is invalid.' };
  }
  if (json.recordCount !== undefined && (
    !Number.isInteger(json.recordCount) || (json.recordCount as number) < 0 || (json.recordCount as number) > 1000
  )) {
    return { valid: false, error: 'The backup record count is invalid.' };
  }
  if (!isRecord(json.days)) {
    return { valid: false, error: 'Invalid backup structure: "days" object is missing or invalid.' };
  }

  const rawDays = json.days;
  const dayKeys = Object.keys(rawDays);
  if (dayKeys.length > 1000) {
    return { valid: false, error: 'Backup contains more than 1,000 daily records. Exceeds safe import limits.' };
  }
  if (json.recordCount !== undefined && json.recordCount !== dayKeys.length) {
    return { valid: false, error: 'The backup record count does not match its daily records.' };
  }
  const rawSettings = json.settings;
  if (rawSettings !== undefined && !isRecord(rawSettings)) {
    return { valid: false, error: 'The backup settings object is invalid.' };
  }

  const sanitizedDays: Record<string, DayRecord> = {};
  const sortedKeys: string[] = [];

  for (const dateKey of dayKeys) {
    if (!isCalendarDate(dateKey)) {
      return { valid: false, error: `Invalid date key format "${dateKey.slice(0, 20)}". Expected YYYY-MM-DD.` };
    }

    const rawDayValue = rawDays[dateKey];
    if (!isRecord(rawDayValue)) return { valid: false, error: `Daily record for ${dateKey} must be an object.` };
    const rawDay = rawDayValue as Record<string, any>;

    const shapeError = validateDayShape(rawDay, dateKey);
    if (shapeError) return { valid: false, error: `Invalid daily record for ${dateKey}: ${shapeError}` };

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
          ? rawDay.workout.exercises.slice(0, 30).map((ex: any, idx: number) => {
              const target = sanitizeString(ex?.target, 100);
              return {
                id: sanitizeString(ex?.id || `ex-${idx}`, 50),
                name: sanitizeString(ex?.name, 200),
                target,
                completed: Boolean(ex?.completed),
                skipped: Boolean(ex?.skipped),
                sets: sanitizeNumber(ex?.sets, 1, 10, getPrescribedSetCount(target)),
                reps: sanitizeString(ex?.reps, 50),
                weight: sanitizeString(ex?.weight, 50),
                duration: sanitizeString(ex?.duration, 50),
                notes: sanitizeString(ex?.notes, 1000),
              };
            })
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
      ...(rawDay.customTrackerValues === undefined
        ? {}
        : { customTrackerValues: validateCustomTrackerValues(rawDay.customTrackerValues) ?? [] }),
    };

    sanitizedDays[dateKey] = dayRecord;
  }

  sortedKeys.sort();

  // Settings validation (optional)
  let sanitizedSettings: Partial<UserSettings> | undefined;
  if (rawSettings !== undefined) {
    const settingsResult = sanitizeBackupSettings(rawSettings as Record<string, unknown>);
    if (settingsResult.error) return { valid: false, error: settingsResult.error };
    sanitizedSettings = settingsResult.settings;
  }

  return {
    valid: true,
    sanitizedDays,
    sanitizedSettings,
    stats: {
      recordCount: sortedKeys.length,
      ...(sortedKeys.length ? { startDate: sortedKeys[0], endDate: sortedKeys[sortedKeys.length - 1] } : {}),
    },
  };
}
