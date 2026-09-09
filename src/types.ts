export type WorkoutMode = 'gym' | 'home';

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  category: 'wake' | 'academic' | 'break' | 'workout' | 'dsa' | 'project' | 'reading' | 'sleep' | 'other';
  status: 'pending' | 'completed' | 'skipped';
  note?: string;
}

export interface HabitItem {
  id: string;
  title: string;
  detail: string;
  completed: boolean;
  timeOfDay?: 'morning' | 'anytime' | 'evening';
}

export interface NonNegotiableItem {
  id: string;
  name: string;
  target: string;
  completed: boolean;
}

export interface ExerciseRecord {
  id: string;
  name: string;
  target: string;
  completed: boolean;
  skipped: boolean;
  sets: number;
  reps: string;
  weight: string;
  duration?: string;
  notes: string;
}

export interface WorkoutSession {
  mode: WorkoutMode;
  cycleDay: string; // e.g. "Day A — Shoulders + Chest" or "Day 1 — Push Foundations"
  status: 'not_started' | 'in_progress' | 'completed' | 'partially_completed' | 'skipped';
  notes?: string;
  exercises: ExerciseRecord[];
  dailyNonNegotiables: NonNegotiableItem[];
}

export interface AcademicsSession {
  subject: string;
  secondarySubject?: string;
  objective: string;
  learned: string;
  retrieve: string;
  weak: string;
  output: string;
  timeSpent: string;
}

export interface DsaProblem {
  id: string;
  problem: string;
  platform: 'LeetCode' | 'Codeforces' | 'GeeksforGeeks' | 'NeetCode' | 'Other';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  firstIdea: string;
  solvedIndependently: boolean;
  failureMistake: string;
  insight: string;
  algorithm: string;
  timeComplexity: string;
  spaceComplexity: string;
  reimplemented: boolean;
  reviewDate: string;
  tags: string[]; // Classify, Brute Force, Struggle, Hint, Insight, Reimplement, Explain, Transfer, Review
}

export interface ProjectSession {
  name: string;
  goal: string;
  workedOn: string;
  artifact: string;
  blocker: string;
  nextAction: string;
}

export interface SkillSession {
  topic: string;
  focus: string;
  notes: string;
}

export interface DailyReflection {
  academicLearned: string;
  academicRetrieve: string;
  academicWeak: string;
  dsaProblem: string;
  dsaPattern: string;
  dsaInsight: string;
  dsaMistake: string;
  dsaReviewDate: string;
  projectArtifact: string;
  tomorrowFirstAction: string;
  notes: string;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  completionPercentage: number;
  notes: string;
  mood: number; // 1-5
  energy: number; // 1-5
  sleep: number; // 1-5
  dailyReflection: DailyReflection;
  tomorrowFirstAction: string;
  schedule: ScheduleItem[];
  habits: HabitItem[];
  academics: AcademicsSession;
  dsa: DsaProblem[];
  workout: WorkoutSession;
  project: ProjectSession;
  skills: SkillSession;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  defaultWorkoutMode: WorkoutMode;
  academicSchedule: Record<string, { primary: string; secondary: string }>;
  theme: 'dark' | 'light';
  notificationsEnabled?: boolean;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

export interface AuthErrorInfo {
  code: string;
  category: string;
  message: string;
  hostname?: string;
  actionableStep?: string;
}

export type TabType =
  | 'today'
  | 'academics'
  | 'dsa'
  | 'projects'
  | 'workout'
  | 'schedule'
  | 'calendar'
  | 'review'
  | 'history'
  | 'settings';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

