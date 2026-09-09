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
  UserSettings
} from '../types';

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
  'DBMS',
  'Digital Electronics',
  'C',
  'DSA',
  'Other'
];

export const DEFAULT_WEEKLY_ROTATION: Record<string, { primary: string; secondary: string }> = {
  Monday: { primary: 'Optimization', secondary: 'DBMS' },
  Tuesday: { primary: 'DSA', secondary: 'Digital Electronics' },
  Wednesday: { primary: 'Optimization', secondary: 'C' },
  Thursday: { primary: 'DBMS', secondary: 'DSA' },
  Friday: { primary: 'Digital Electronics', secondary: 'Optimization' },
  Saturday: { primary: 'C', secondary: 'DBMS' },
  Sunday: { primary: 'Weekly retrieval', secondary: 'Weakest subject' },
};

export const GYM_WORKOUT_PLANS = {
  'Day A — Shoulders + Chest': [
    { name: 'Incline DB Press', target: '3 × 8–10' },
    { name: 'DB Lateral Raise', target: '4 × 12–15' },
    { name: 'DB Overhead Press', target: '3 × 8–10' },
    { name: 'Chest Fly Machine', target: '3 × 10–12' },
    { name: 'Face Pull', target: '3 × 15' },
    { name: 'Hollow Body Hold', target: '2 × 20s' },
    { name: 'Plank', target: '2 × 30s' },
  ],
  'Day B — Back + Biceps + Forearms': [
    { name: 'Lat Pulldown Wide Grip', target: '4 × 8–10' },
    { name: 'Lat Pulldown Close/Neutral', target: '3 × 10–12' },
    { name: 'Barbell or DB Bent-Over Row', target: '3 × 8–10' },
    { name: 'Preacher Curl', target: '3 × 8–10' },
    { name: 'DB Hammer Curl', target: '2 × 10–12' },
    { name: 'DB Wrist Curl', target: '2 × 12–15' },
    { name: 'DB Reverse Wrist Curl', target: '2 × 12–15' },
    { name: 'Dead Bug', target: '2 × 8/side' },
    { name: 'Side Plank', target: '2 × 25s/side' },
  ],
  'Day C — Legs + Triceps + Forearms': [
    { name: 'Barbell Squat', target: '3 × 8–10' },
    { name: 'Leg Press', target: '3 × 10–12' },
    { name: 'Romanian Deadlift', target: '3 × 8–10' },
    { name: 'Chest Fly Machine, tricep setting', target: '3 × 10–12' },
    { name: 'Dips', target: '3 × 5–8' },
    { name: "Farmer's Carry", target: '3 × 20–25s' },
    { name: 'Hollow Body Hold', target: '2 × 20s' },
    { name: 'Reverse Crunch', target: '2 × 10' },
  ],
};

export const CALISTHENICS_WORKOUT_PLANS = {
  'Day 1 — Push Foundations + Upper Core': [
    { name: 'Full Push-Up', target: '3 × 8–10' },
    { name: 'Slow Negative Push-Up', target: '2 × 4–5' },
    { name: 'Incline Pike Push-Up', target: '2 × 5–6' },
    { name: 'Planche Lean', target: '2 × 10–15s' },
    { name: 'Wall Handstand Hold', target: '2 × 10–15s' },
    { name: 'Dead Bug', target: '2 × 6/side' },
    { name: 'Hollow Body Tuck Hold', target: '2 × 15–20s' },
    { name: 'Forearm Plank', target: '2 × 30–35s' },
    { name: 'Stomach Vacuum', target: '3 × 10s at end' },
  ],
  'Day 2 — Pull Foundations + Posture + Lower Core': [
    { name: 'Dead Hang', target: '3 × 10–15s' },
    { name: 'Scapular Pull', target: '3 × 6–8' },
    { name: 'Negative Pull-Up', target: '2 × 2–3' },
    { name: 'Band-Assisted Row', target: '3 × 10–12' },
    { name: 'Reverse Snow Angels', target: '2 × 10' },
    { name: 'Prone Y Raises', target: '2 × 10' },
    { name: 'Reverse Crunch', target: '2 × 10' },
    { name: 'Side Plank', target: '2 × 20–25s/side' },
  ],
  'Day 3 — Legs + Full-Body Skills + Core': [
    { name: 'Bodyweight Squat', target: '3 × 12' },
    { name: 'Reverse Lunge', target: '2 × 8/leg' },
    { name: 'Single-Leg Glute Bridge', target: '2 × 8/side' },
    { name: 'Wall Sit', target: '2 × 25–30s' },
    { name: 'Assisted Pistol Squat', target: '2 × 5–6/leg' },
    { name: 'Tuck L-Sit', target: '2 × 6–10s' },
    { name: 'Leg Raises', target: '2 × 8–10' },
    { name: 'Hollow Body Hold', target: '2 × 18–22s' },
    { name: 'Bicycle Crunch', target: '2 × 14' },
  ],
};

export const DSA_TAGS = [
  'Classify',
  'Brute Force',
  'Struggle',
  'Hint',
  'Insight',
  'Reimplement',
  'Explain',
  'Transfer',
  'Review'
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultWorkoutMode: 'gym',
  academicSchedule: DEFAULT_WEEKLY_ROTATION,
  theme: 'dark',
};

export const DEFAULT_SETTINGS = DEFAULT_USER_SETTINGS;

export function getDayOfWeekName(dateStr: string): string {
  // Parse YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAYS_OF_WEEK[date.getDay()];
}

export function createDefaultDayRecord(dateStr: string, settings?: UserSettings): DayRecord {
  const dayOfWeek = getDayOfWeekName(dateStr);
  const scheduleRotation = settings?.academicSchedule || DEFAULT_WEEKLY_ROTATION;
  const rotation = scheduleRotation[dayOfWeek] || { primary: 'Optimization', secondary: 'DBMS' };

  // Determine initial workout cycle day
  const mode = settings?.defaultWorkoutMode || 'gym';
  let cycleDay = 'Day A — Shoulders + Chest';
  let planExercises = GYM_WORKOUT_PLANS['Day A — Shoulders + Chest'];

  if (mode === 'home') {
    cycleDay = 'Day 1 — Push Foundations + Upper Core';
    planExercises = CALISTHENICS_WORKOUT_PLANS['Day 1 — Push Foundations + Upper Core'];
  }

  const exercises: ExerciseRecord[] = planExercises.map((e, idx) => ({
    id: `ex-${idx}-${e.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: e.name,
    target: e.target,
    completed: false,
    skipped: false,
    sets: 3,
    reps: '',
    weight: '',
    duration: '',
    notes: '',
  }));

  const dailyNonNegotiables: NonNegotiableItem[] = DEFAULT_NON_NEGOTIABLES.map((n, idx) => ({
    id: `nn-${idx}`,
    name: n.name,
    target: n.target,
    completed: false,
  }));

  const schedule: ScheduleItem[] = DEFAULT_SCHEDULE_ITEMS.map((s, idx) => ({
    id: `sched-${idx}`,
    time: s.time,
    title: s.title,
    category: s.category,
    status: 'pending',
    note: '',
  }));

  const habits: HabitItem[] = DEFAULT_HABITS.map((h, idx) => ({
    id: `habit-${idx}`,
    title: h.title,
    detail: h.detail,
    completed: false,
    timeOfDay: h.timeOfDay,
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

  // 1. Schedule items (completed or skipped count towards progress resolution)
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

  // 5. Academics (considered done if learned has text or output produced)
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
