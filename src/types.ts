export type WorkoutMode = 'gym' | 'home';

export const CURRENT_DAY_SCHEMA_VERSION = 1;

export const BEHAVIORAL_LIMITS = {
  outcomes: 10,
  focusSessions: 20,
  recoveryDecisions: 20,
  creditEvents: 20,
} as const;

export type CapacityMode = 'normal' | 'reduced' | 'minimum';
export type OutcomeStatus = 'planned' | 'active' | 'completed' | 'partial' | 'blocked' | 'missed' | 'abandoned' | 'dropped';
export type BehavioralDomain = 'academics' | 'dsa' | 'project' | 'workout' | 'habits' | 'schedule' | 'other';
export type OutcomeSource = 'handoff' | 'schedule' | 'domain' | 'user';
export type FocusSessionStatus = 'active' | 'completed' | 'partial' | 'blocked' | 'abandoned';
export type RecoveryDecisionType = 'rescue' | 'reschedule' | 'reduce' | 'drop' | 'blocked';
export type FailureReason =
  | 'underestimated_difficulty'
  | 'avoidance'
  | 'poor_planning'
  | 'interruption'
  | 'low_energy'
  | 'unclear_next_action'
  | 'dependency_blocker'
  | 'overcommitment'
  | 'unexpected_work';
export type CreditEventType = 'output' | 'partial_output' | 'recovery' | 'workout' | 'review' | 'milestone';

export interface DayStart {
  date: string;
  startedAt: string;
  capacityMode: CapacityMode;
  firstAction: string;
  implementationIntention?: string;
  acceptedAt: string;
}

export interface Outcome {
  id: string;
  domain: BehavioralDomain;
  domainEntityId?: string;
  title: string;
  minimumOutput: string;
  priority: number;
  status: OutcomeStatus;
  source: OutcomeSource;
  createdAt: string;
  resolvedAt?: string;
  replacementReason?: string;
}

export interface FocusSession {
  id: string;
  outcomeId?: string;
  objective: string;
  minimumOutput: string;
  intendedMinutes?: number;
  scheduleWindowId?: string;
  startedAt: string;
  endedAt?: string;
  status: FocusSessionStatus;
  output?: string;
}

export interface RecoveryDecision {
  id: string;
  outcomeId?: string;
  focusSessionId?: string;
  type: RecoveryDecisionType;
  reason: string;
  newScope?: string;
  scheduleWindowId?: string;
  nextAction?: string;
  createdAt: string;
}

export interface BehavioralReview {
  completedAt?: string;
  movedForward: string;
  failureReasons: FailureReason[];
  adjustment: string;
  reviewComplete: boolean;
}

export interface TomorrowHandoff {
  createdAt: string;
  firstAction: string;
  carryForwardOutcomeId?: string;
  blockerAction?: string;
  dueReviewReference?: string;
  adjustment?: string;
  note?: string;
}

export interface CreditEvent {
  id: string;
  type: CreditEventType;
  sourceId?: string;
  createdAt: string;
  note?: string;
}

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
  completedAt?: string;
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
  // Absent records are legacy schema version 0 and are normalized in memory.
  schemaVersion?: number;
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
  dayStart?: DayStart;
  outcomes?: Outcome[];
  focusSessions?: FocusSession[];
  recoveryDecisions?: RecoveryDecision[];
  behavioralReview?: BehavioralReview;
  tomorrowHandoff?: TomorrowHandoff;
  creditEvents?: CreditEvent[];
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
