import { DayRecord, UserSettings } from '../types';

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

    sortedKeys.push(dateKey);

    // Sanitize Day Record
    const dayRecord: DayRecord = {
      date: dateKey,
      dayOfWeek: sanitizeString(rawDay.dayOfWeek, 20) || 'Unknown',
      completionPercentage: sanitizeNumber(rawDay.completionPercentage, 0, 100, 0),
      notes: sanitizeString(rawDay.notes, 5000),
      mood: sanitizeNumber(rawDay.mood, 1, 5, 3),
      energy: sanitizeNumber(rawDay.energy, 1, 5, 3),
      sleep: sanitizeNumber(rawDay.sleep, 1, 5, 3),
      tomorrowFirstAction: sanitizeString(rawDay.tomorrowFirstAction, 1000),
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
