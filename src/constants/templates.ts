import {
  DayRecord,
  ScheduleItem,
  HabitItem,
  NonNegotiableItem,
  ExerciseRecord,
  WorkoutSession,
  AcademicsSession,
  ProjectSession,
  SkillSession,
  UserSettings,
  DailySystemTemplate,
} from '../types';
import { CURRENT_DAY_SCHEMA_VERSION } from '../types';
import { getPrescribedSetCount } from '../utils/workout';

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const DEFAULT_SCHEDULE_ITEMS: Omit<ScheduleItem, 'id' | 'status' | 'note'>[] = [
  { time: '05:30–06:00', title: 'Wake / hygiene', category: 'wake' },
  { time: '06:00–07:30', title: 'ACADEMIC DEEP WORK', category: 'academic' },
  { time: '07:30–08:00', title: 'Freshen up', category: 'break' },
  { time: '08:00–08:40', title: 'Breakfast', category: 'break' },
  { time: '08:50–16:35', title: 'Classes + free slots', category: 'academic' },
  { time: '16:35–17:00', title: 'Transition / snack / reset', category: 'break' },
  { time: '17:00–18:15', title: 'WORKOUT', category: 'workout' },
  { time: '18:15–19:30', title: 'Freshen + dinner', category: 'break' },
  { time: '19:30–20:40', title: 'DSA / LEETCODE', category: 'dsa' },
  { time: '20:40–22:00', title: 'Academic / Project / Skill', category: 'project' },
  { time: '22:00–22:30', title: 'Technical reading', category: 'reading' },
  { time: '~22:30', title: 'Sleep', category: 'sleep' },
];

export const DEFAULT_HABITS: Omit<HabitItem, 'id' | 'completed'>[] = [
  { title: 'Morning Hydration', detail: '500ml water immediately on wake', timeOfDay: 'morning' },
  { title: 'No Phone First 30m', detail: 'Protect morning focus window', timeOfDay: 'morning' },
  { title: 'Posture Check & Walk', detail: 'Brief mobility during transitions', timeOfDay: 'anytime' },
  { title: 'Daily Review Completed', detail: 'Reflect before 22:30 sleep', timeOfDay: 'evening' },
];

export const DEFAULT_NON_NEGOTIABLES: Omit<NonNegotiableItem, 'id' | 'completed'>[] = [
  { name: 'Couch stretch', target: '45s/side × 2 rounds' },
  { name: 'Glute bridge', target: '2 × 12' },
  { name: 'Stomach vacuum', target: '4 × 10–12s in the morning' },
];

export const ACADEMIC_SUBJECTS = [
  'Optimization Techniques',
  'Database Management Systems',
  'Digital Electronics',
  'Data Structures & Algorithms',
  'Operating Systems & Architecture',
  'Other / Research',
];

export const DSA_TAGS = [
  'Classify',
  'Brute Force',
  'Struggle',
  'Hint',
  'Insight',
  'Reimplement',
  'Explain',
  'Transfer',
  'Review',
];

export const GYM_WORKOUT_PLANS: Record<string, { name: string; target: string }[]> = {
  'Day A — Shoulders + Chest': [
    { name: 'Warm-up / Arm circles + Band dislocates', target: '2 × 15' },
    { name: 'Overhead DB Press', target: '3 × 8–10' },
    { name: 'Incline DB Press', target: '3 × 10–12' },
    { name: 'Lateral Raises', target: '4 × 15' },
    { name: 'Push-ups (paused at bottom)', target: '3 × failure' },
    { name: 'Rear Delt Flyes / Face Pulls', target: '3 × 15' },
    { name: 'Tricep Rope Pushdown', target: '3 × 12' },
    { name: 'Dead Hang', target: '3 × 45s' },
  ],
  'Day B — Back + Biceps + Core': [
    { name: 'Warm-up / Cat-cow + Band pull-aparts', target: '2 × 15' },
    { name: 'Lat Pulldown / Pull-ups', target: '4 × 8–10' },
    { name: 'Chest-Supported DB Row', target: '3 × 10–12' },
    { name: 'Face Pulls', target: '3 × 15' },
    { name: 'Incline DB Curl', target: '3 × 10–12' },
    { name: 'Hammer Curls', target: '3 × 12' },
    { name: 'Hanging Knee Raises', target: '3 × 12–15' },
    { name: 'Plank Hold', target: '3 × 60s' },
  ],
  'Day C — Legs + Abs': [
    { name: 'Warm-up / Leg swings + Bodyweight squats', target: '2 × 20' },
    { name: 'Goblet Squat / Barbell Squat', target: '4 × 8–10' },
    { name: 'Romanian Deadlift (DB)', target: '3 × 10–12' },
    { name: 'Walking Lunges', target: '3 × 12/leg' },
    { name: 'Calf Raises', target: '4 × 15' },
    { name: 'Cable Crunch / Ab Rollout', target: '3 × 15' },
    { name: 'Dead Hang', target: '3 × 45s' },
  ],
};

export const CALISTHENICS_WORKOUT_PLANS: Record<string, { name: string; target: string }[]> = {
  'Day 1 — Push Foundations + Upper Core': [
    { name: 'Warm-up / Wrist mobility + Arm circles', target: '2 × 15' },
    { name: 'Standard / Decline Push-ups', target: '4 × 12–15' },
    { name: 'Pike Push-ups', target: '3 × 8–10' },
    { name: 'Diamond Push-ups', target: '3 × 10' },
    { name: 'Dips (Chair / Parallel Bars)', target: '3 × 8–12' },
    { name: 'Hollow Body Hold', target: '3 × 30–45s' },
    { name: 'Plank to Dolphin', target: '3 × 10' },
  ],
  'Day 2 — Pull Foundations + Posterior Chain': [
    { name: 'Warm-up / Scapular retractions', target: '2 × 15' },
    { name: 'Pull-ups / Inverted Rows', target: '4 × 6–10' },
    { name: 'Australian Rows (Doorframe / Towel)', target: '3 × 12' },
    { name: 'Chin-up Isometric Hang', target: '3 × 20s' },
    { name: 'Reverse Snow Angels', target: '3 × 15' },
    { name: 'Bird-Dog Hold', target: '3 × 30s/side' },
  ],
  'Day 3 — Legs + Core Synergy': [
    { name: 'Warm-up / Ankle circles + Hip openers', target: '2 × 20' },
    { name: 'Pistol Squat Progressions / Cossack', target: '3 × 8/leg' },
    { name: 'Bulgarian Split Squats', target: '3 × 12/leg' },
    { name: 'Single-Leg Glute Bridges', target: '3 × 15/leg' },
    { name: 'Calf Raises on Edge', target: '4 × 20' },
    { name: 'L-Sit / Tuck Sit Hold', target: '4 × 15–20s' },
  ],
};

export const DEFAULT_SETTINGS: UserSettings = {
  defaultWorkoutMode: 'gym',
  academicSchedule: {
    Sunday: { primary: 'Revision / Catch-up', secondary: 'Planning' },
    Monday: { primary: 'Optimization Techniques', secondary: 'DBMS' },
    Tuesday: { primary: 'Digital Electronics', secondary: 'DSA' },
    Wednesday: { primary: 'Operating Systems', secondary: 'Optimization' },
    Thursday: { primary: 'DBMS', secondary: 'Digital Electronics' },
    Friday: { primary: 'DSA & Algorithms', secondary: 'OS' },
    Saturday: { primary: 'Open Project Sprint', secondary: 'Review' },
  },
  theme: 'dark',
  notificationsEnabled: false,
  customWallpaper: '',
  wallpaperBlur: 6,
  wallpaperDim: 40,
};

export function createDefaultDayRecord(dateStr: string, settings?: UserSettings): DayRecord {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = DAYS_OF_WEEK[dateObj.getDay()] || 'Monday';

  const scheduleRotation = settings?.academicSchedule || DEFAULT_SETTINGS.academicSchedule;
  const rotation = scheduleRotation[dayOfWeek] || { primary: 'Optimization', secondary: 'DBMS' };

  // Determine initial workout cycle day
  const mode = settings?.defaultWorkoutMode || 'gym';
  let cycleDay = 'Day A — Shoulders + Chest';
  let planExercises: Array<{ name: string; target: string; sets?: number }> =
    GYM_WORKOUT_PLANS['Day A — Shoulders + Chest'];

  if (mode === 'home') {
    cycleDay = 'Day 1 — Push Foundations + Upper Core';
    planExercises = CALISTHENICS_WORKOUT_PLANS['Day 1 — Push Foundations + Upper Core'];
  }

  const dailySystem: DailySystemTemplate | undefined =
    settings?.dailySystem?.workoutMode === mode ? settings.dailySystem : undefined;

  const dailyNonNegotiables: NonNegotiableItem[] = (dailySystem?.nonNegotiables || DEFAULT_NON_NEGOTIABLES).map((n, idx) => ({
    id: `nn-${idx}`,
    name: n.name,
    target: n.target,
    completed: false,
  }));

  const schedule: ScheduleItem[] = (dailySystem?.schedule || DEFAULT_SCHEDULE_ITEMS).map((s, idx) => ({
    id: `sched-${idx}`,
    time: s.time,
    title: s.title,
    category: s.category,
    status: 'pending',
    note: '',
  }));

  const habits: HabitItem[] = (dailySystem?.habits || DEFAULT_HABITS).map((h, idx) => ({
    id: `habit-${idx}`,
    title: h.title,
    detail: h.detail,
    completed: false,
    timeOfDay: h.timeOfDay,
  }));

  if (dailySystem) {
    cycleDay = dailySystem.workoutCycle;
    planExercises = dailySystem.workoutExercises;
  }

  const exercises: ExerciseRecord[] = planExercises.map((e, idx) => ({
    id: `ex-${idx}-${e.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: e.name,
    target: e.target,
    completed: false,
    skipped: false,
    sets: e.sets ?? getPrescribedSetCount(e.target),
    reps: '',
    weight: '',
    duration: '',
    notes: '',
  }));

  const academics: AcademicsSession = {
    subject: rotation.primary,
    secondarySubject: rotation.secondary,
    objective: '',
    learned: '',
    retrieve: '',
    weak: '',
    output: '',
    timeSpent: '90 min',
  };

  const workout: WorkoutSession = {
    mode,
    cycleDay,
    status: 'not_started',
    notes: '',
    exercises,
    dailyNonNegotiables,
  };

  const project: ProjectSession = {
    name: '',
    goal: '',
    workedOn: '',
    artifact: '',
    blocker: '',
    nextAction: '',
  };

  const skills: SkillSession = {
    topic: '',
    focus: '',
    notes: '',
  };

  const now = new Date().toISOString();

  return {
    schemaVersion: CURRENT_DAY_SCHEMA_VERSION,
    date: dateStr,
    dayOfWeek,
    completionPercentage: 0,
    notes: '',
    mood: 3,
    energy: 3,
    sleep: 3,
    dailyReflection: {
      academicLearned: '',
      academicRetrieve: '',
      academicWeak: '',
      dsaProblem: '',
      dsaPattern: '',
      dsaInsight: '',
      dsaMistake: '',
      dsaReviewDate: '',
      projectArtifact: '',
      tomorrowFirstAction: '',
      notes: '',
    },
    tomorrowFirstAction: '',
    schedule,
    habits,
    academics,
    dsa: [],
    workout,
    project,
    skills,
    createdAt: now,
    updatedAt: now,
  };
}

export function calculateCompletionPercentage(day: DayRecord): number {
  let totalTrackable = 0;
  let completedCount = 0;

  // 1. Schedule items
  if (day.schedule && day.schedule.length > 0) {
    day.schedule.forEach(item => {
      totalTrackable++;
      if (item.status === 'completed') {
        completedCount++;
      } else if (item.status === 'skipped') {
        completedCount += 0.5;
      }
    });
  }

  // 2. Habits
  if (day.habits && day.habits.length > 0) {
    day.habits.forEach(h => {
      totalTrackable++;
      if (h.completed) completedCount++;
    });
  }

  // 3. Daily non-negotiables
  if (day.workout?.dailyNonNegotiables && day.workout.dailyNonNegotiables.length > 0) {
    day.workout.dailyNonNegotiables.forEach(nn => {
      totalTrackable++;
      if (nn.completed) completedCount++;
    });
  }

  // 4. Workout exercises
  if (day.workout?.exercises && day.workout.exercises.length > 0) {
    day.workout.exercises.forEach(ex => {
      totalTrackable++;
      if (ex.completed) completedCount++;
      else if (ex.skipped) completedCount += 0.5;
    });
  }

  // 5. Academics
  totalTrackable++;
  if (day.academics && (day.academics.learned?.trim() || day.academics.objective?.trim())) {
    completedCount++;
  }

  // 6. Reflection
  totalTrackable++;
  if (day.dailyReflection?.tomorrowFirstAction?.trim() || day.dailyReflection?.notes?.trim()) {
    completedCount++;
  }

  if (totalTrackable === 0) return 0;
  return Math.min(100, Math.round((completedCount / totalTrackable) * 100));
}
