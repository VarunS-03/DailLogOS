import { DayRecord, DailyReflection, DsaProblem, UserSettings } from '../types';
import { reportAiFailure } from './aiDiagnostics';

// Read API key from environment or localStorage if user set it in Settings
export function getGeminiApiKey(): string {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  if (envKey && envKey.trim()) return envKey.trim();
  const localKey = localStorage.getItem('daily_os_gemini_api_key');
  return localKey ? localKey.trim() : '';
}

export function setGeminiApiKey(key: string) {
  if (!key || !key.trim()) {
    localStorage.removeItem('daily_os_gemini_api_key');
  } else {
    localStorage.setItem('daily_os_gemini_api_key', key.trim());
  }
}

export function hasGeminiKey(): boolean {
  return !!getGeminiApiKey();
}

async function getAiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey });
}

async function waitForAiResponse<T>(request: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('The AI request timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export interface AiBriefing {
  headline: string;
  focusMessage: string;
  threePriorities: string[];
  motivationalQuote: string;
}

export interface DsaAiAssistance {
  patternDetected: string;
  recommendedApproach: string;
  timeComplexityHint: string;
  spaceComplexityHint: string;
  keyObservation: string;
  pitfallToAvoid: string;
}

export type NaturalInputParsed =
  | {
      type: 'dsa';
      summary: string;
      data: {
        problem: string;
        platform: DsaProblem['platform'];
        difficulty: DsaProblem['difficulty'];
        pattern: string;
        solvedIndependently: boolean;
      };
    }
  | { type: 'schedule'; summary: string; data: { note: string } }
  | { type: 'unknown'; summary: string; data: { text: string } };

function parseJsonRecord(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The AI response must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function readBoundedString(value: unknown, maximum: number): string | null {
  return typeof value === 'string' && value.length <= maximum ? value : null;
}

export function parseDailyBriefingResponse(text: string): AiBriefing {
  const data = parseJsonRecord(text);
  const allowedKeys = ['headline', 'focusMessage', 'threePriorities', 'motivationalQuote'];
  if (Object.keys(data).some((key) => !allowedKeys.includes(key))) throw new Error('The AI briefing contains unsupported fields.');
  const headline = readBoundedString(data.headline, 300);
  const focusMessage = readBoundedString(data.focusMessage, 1000);
  const motivationalQuote = readBoundedString(data.motivationalQuote, 500);
  const priorities = data.threePriorities;
  if (
    headline === null || focusMessage === null || motivationalQuote === null
    || !Array.isArray(priorities) || priorities.length !== 3
    || priorities.some((priority) => readBoundedString(priority, 300) === null)
  ) throw new Error('The AI briefing does not match the supported format.');
  return { headline, focusMessage, threePriorities: priorities as string[], motivationalQuote };
}

const REFLECTION_FIELD_LIMITS: Record<keyof DailyReflection, number> = {
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
};

export function parseAutoReflectionResponse(text: string): Partial<DailyReflection> {
  const data = parseJsonRecord(text);
  const result: Partial<DailyReflection> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(key in REFLECTION_FIELD_LIMITS)) throw new Error('The AI reflection contains unsupported fields.');
    const safeValue = readBoundedString(value, REFLECTION_FIELD_LIMITS[key as keyof DailyReflection]);
    if (safeValue === null) throw new Error('The AI reflection contains an invalid field.');
    Object.assign(result, { [key]: safeValue });
  }
  if (Object.keys(result).length === 0) throw new Error('The AI reflection is empty.');
  return result;
}

export function parseDsaAssistanceResponse(text: string): DsaAiAssistance {
  const data = parseJsonRecord(text);
  const limits: Record<keyof DsaAiAssistance, number> = {
    patternDetected: 200,
    recommendedApproach: 2000,
    timeComplexityHint: 200,
    spaceComplexityHint: 200,
    keyObservation: 2000,
    pitfallToAvoid: 2000,
  };
  const fields = Object.keys(limits) as Array<keyof DsaAiAssistance>;
  if (Object.keys(data).some((key) => !fields.includes(key as keyof DsaAiAssistance))) {
    throw new Error('The AI coaching response contains unsupported fields.');
  }
  const result = {} as DsaAiAssistance;
  fields.forEach((field) => {
    const value = readBoundedString(data[field], limits[field]);
    if (value === null) throw new Error('The AI coaching response is incomplete or invalid.');
    result[field] = value;
  });
  return result;
}

export function parseNaturalLanguageLogResponse(text: string, input: string): NaturalInputParsed {
  const data = parseJsonRecord(text);
  if (Object.keys(data).some((key) => !['type', 'summary', 'data'].includes(key))) {
    throw new Error('The AI log response contains unsupported fields.');
  }
  const summary = readBoundedString(data.summary, 300);
  if (summary === null || typeof data.data !== 'object' || data.data === null || Array.isArray(data.data)) {
    throw new Error('The AI log response is incomplete.');
  }
  const payload = data.data as Record<string, unknown>;
  if (data.type === 'dsa') {
    const allowed = ['problem', 'platform', 'difficulty', 'pattern', 'solvedIndependently'];
    if (Object.keys(payload).some((key) => !allowed.includes(key))) throw new Error('The AI DSA log contains unsupported fields.');
    const problem = readBoundedString(payload.problem, 500);
    const platform = payload.platform;
    const difficulty = payload.difficulty;
    const pattern = readBoundedString(payload.pattern, 200);
    if (
      !problem || !pattern
      || !['LeetCode', 'Codeforces', 'GeeksforGeeks', 'NeetCode', 'Other'].includes(String(platform))
      || !['Easy', 'Medium', 'Hard'].includes(String(difficulty))
      || (payload.solvedIndependently !== undefined && typeof payload.solvedIndependently !== 'boolean')
    ) throw new Error('The AI DSA log does not match the supported format.');
    return {
      type: 'dsa',
      summary,
      data: {
        problem,
        platform: platform as DsaProblem['platform'],
        difficulty: difficulty as DsaProblem['difficulty'],
        pattern,
        solvedIndependently: typeof payload.solvedIndependently === 'boolean' ? payload.solvedIndependently : true,
      },
    };
  }
  if (data.type === 'schedule') {
    if (Object.keys(payload).some((key) => key !== 'note')) throw new Error('The AI schedule log contains unsupported fields.');
    const note = readBoundedString(payload.note, 1000);
    if (!note) throw new Error('The AI schedule log does not match the supported format.');
    return { type: 'schedule', summary, data: { note } };
  }
  if (!['habit', 'workout', 'reflection', 'unknown'].includes(String(data.type))) {
    throw new Error('The AI log response has an unsupported type.');
  }
  return { type: 'unknown', summary, data: { text: input.slice(0, 2000) } };
}

/**
 * Generates an inspiring, personalized morning / daily briefing based on the user's
 * current day state, previous accomplishments, and planned schedule.
 */
export async function generateDailyBriefing(
  day: DayRecord,
  yesterday?: DayRecord | null,
  settings?: UserSettings
): Promise<AiBriefing> {
  const ai = await getAiClient();
  const userName = 'friend';

  if (!ai) {
    // Intelligent heuristic fallback so the app NEVER feels empty or broken without a key
    const completedSched = day.schedule?.filter((s) => s.status === 'completed').length || 0;
    const totalSched = day.schedule?.length || 0;
    const moodDesc = day.mood >= 4 ? 'high energy' : day.mood <= 2 ? 'gentle recharge' : 'steady progress';

    return {
      headline: `Good day! Ready for ${day.dayOfWeek} with ${moodDesc}?`,
      focusMessage: yesterday?.tomorrowFirstAction
        ? `Yesterday you resolved to begin with: "${yesterday.tomorrowFirstAction}". Momentum starts with your first small win.`
        : `Focus on what matters most today. Momentum comes from taking action on small steps.`,
      threePriorities: [
        day.academics?.subject ? `Deep study block on ${day.academics.subject}` : 'Primary study / deep work block',
        day.workout?.cycleDay ? `Execute workout: ${day.workout.cycleDay}` : 'Daily physical movement and energy',
        'Close out with a brief, honest evening reflection',
      ],
      motivationalQuote: '“Action precedes motivation. Start small, stay present.”',
    };
  }

  try {
    const prompt = `You are an empathetic, world-class behavioral and performance coach for a daily life tracker app called Daily OS.
Analyze the user's current day state and yesterday's progress to produce a concise, psychologically grounding morning/day briefing.

Current Day: ${day.date} (${day.dayOfWeek})
Current Completion: ${day.completionPercentage}%
Yesterday's First Action target: ${yesterday?.tomorrowFirstAction || 'None specified'}
Yesterday's completion: ${yesterday?.completionPercentage ?? 'N/A'}%
Planned Academic Subject: ${day.academics?.subject || 'Open'}
Planned Workout: ${day.workout?.cycleDay || 'Rest / Active'}
Mood: ${day.mood}/5, Energy: ${day.energy}/5, Sleep: ${day.sleep}/5

Return ONLY valid JSON matching this schema without markdown code blocks:
{
  "headline": "A warm, energetic 1-sentence headline for today",
  "focusMessage": "A 2-sentence encouraging, psychologically smart anchor for the user",
  "threePriorities": ["Priority 1", "Priority 2", "Priority 3"],
  "motivationalQuote": "A punchy, meaningful 1-sentence mindset quote"
}`;

    const response = await waitForAiResponse(ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    }));

    return parseDailyBriefingResponse(response.text || '');
  } catch (err) {
    reportAiFailure('briefing', err);
    return {
      headline: `Welcome to your ${day.dayOfWeek} command center`,
      focusMessage: 'Take it one block at a time. Progress is built on small, continuous actions.',
      threePriorities: ['Complete top priority task', 'Protect physical energy', 'Log reflections before sleep'],
      motivationalQuote: '“You do not rise to the level of your goals. You fall to the level of your systems.”',
    };
  }
}

/**
 * Intelligent auto-reflection that synthesizes what the user did across their schedule,
 * workout, DSA problems, and academic notes, removing blank-page paralysis.
 */
export async function generateAutoReflection(day: DayRecord): Promise<Partial<DailyReflection>> {
  const completedSchedule = day.schedule?.filter((item) => item.status === 'completed').map((item) => item.title).join(', ') || 'No completed schedule blocks recorded';
  const dsaNames = day.dsa?.map((problem) => problem.problem).filter(Boolean).join(', ') || 'None recorded';
  const academicSubject = day.academics?.subject || 'None recorded';
  const fallback: Partial<DailyReflection> = {
    academicLearned: day.academics?.learned || (day.academics?.objective ? `Covered core tenets of ${day.academics.objective}.` : `Focused review on ${academicSubject}.`),
    academicRetrieve: day.academics?.retrieve || `Active recall completed for key concepts in ${academicSubject}.`,
    academicWeak: day.academics?.weak || 'Edge cases and speed of synthesis require repetition.',
    dsaProblem: dsaNames,
    dsaPattern: day.dsa?.[0]?.pattern || 'No specific pattern recorded',
    dsaInsight: day.dsa?.[0]?.insight || 'Use a small example to check assumptions before optimizing.',
    dsaMistake: day.dsa?.[0]?.failureMistake || 'Review edge cases before finalizing a solution.',
    projectArtifact: day.project?.artifact || day.project?.goal || 'Consistent step forward on active build.',
    tomorrowFirstAction: day.tomorrowFirstAction || 'Choose one clear first action for tomorrow.',
    notes: `Day completion: ${day.completionPercentage}%. Completed schedule: ${completedSchedule}.`,
  };

  try {
    const dailyLogs = {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      completionPercentage: day.completionPercentage,
      mood: day.mood,
      energy: day.energy,
      sleep: day.sleep,
      completedSchedule: day.schedule?.filter((item) => item.status === 'completed').map(({ time, title }) => ({ time, title })) || [],
      habits: day.habits?.map(({ title, completed }) => ({ title, completed })) || [],
      focusSessions: day.focusSessions,
      academicSubject: day.academics?.subject,
      dsaProblems: day.dsa?.map(({ problem, pattern }) => ({ problem, pattern })) || [],
      workout: { cycleDay: day.workout?.cycleDay, status: day.workout?.status },
    };
    const { generateDailySummary } = await import('./firebaseAi');
    return { ...fallback, notes: await generateDailySummary(JSON.stringify(dailyLogs)) };
  } catch (error) {
    reportAiFailure('reflection', error);
    return fallback;
  }
}
/**
 * Intelligent DSA Coach: Given a problem title or prompt, recommends pattern, hints,
 * algorithmic approach, and common pitfalls without spoiling the entire solution immediately.
 */
export async function assistDsaProblem(problemTitle: string, platform: string, difficulty: string): Promise<DsaAiAssistance> {
  const ai = await getAiClient();

  if (!ai) {
    // Intelligent heuristic defaults based on common keywords
    const lower = problemTitle.toLowerCase();
    let pattern = 'Array / Two Pointers';
    let approach = 'Sort or use frequency map / two pointers to reduce quadratic checks to linear.';
    let timeHint = 'O(N) or O(N log N)';
    let spaceHint = 'O(1) auxiliary';

    if (lower.includes('tree') || lower.includes('bst') || lower.includes('depth')) {
      pattern = 'DFS / BFS Tree Traversal';
      approach = 'Recursive divide and conquer or queue-based level order traversal.';
      timeHint = 'O(N) visiting each node once';
      spaceHint = 'O(H) recursion stack height';
    } else if (lower.includes('dynamic') || lower.includes('subsequence') || lower.includes('knapsack') || lower.includes('jump')) {
      pattern = 'Dynamic Programming';
      approach = 'Define state dp[i], identify recurrence relation from subproblems, check base cases.';
      timeHint = 'O(N) or O(N*M)';
      spaceHint = 'O(N) memoization table';
    } else if (lower.includes('graph') || lower.includes('island') || lower.includes('cycle')) {
      pattern = 'Graph BFS / DFS / Disjoint Set';
      approach = 'Build adjacency list, track visited set to prevent infinite cycle loops.';
      timeHint = 'O(V + E)';
      spaceHint = 'O(V) visited array';
    }

    return {
      patternDetected: pattern,
      recommendedApproach: approach,
      timeComplexityHint: timeHint,
      spaceComplexityHint: spaceHint,
      keyObservation: 'Identify invariants before writing code. Trace with a small example on paper first.',
      pitfallToAvoid: 'Watch out for boundary conditions: empty inputs, single element, negative values, integer overflow.',
    };
  }

  try {
    const prompt = `You are a FAANG-level algorithmic interviewer and mentor.
Help a developer practicing DSA with problem: "${problemTitle}" on ${platform} (${difficulty} difficulty).
Do NOT write the full code solution. Instead, provide structured architectural hints to foster active recall and problem-solving intuition.

Return ONLY valid JSON matching this schema without markdown code blocks:
{
  "patternDetected": "Primary algorithmic pattern (e.g. Sliding Window, Monotonic Stack, Backtracking)",
  "recommendedApproach": "2-3 sentences explaining the optimal strategy and why it works",
  "timeComplexityHint": "Expected optimal time complexity (e.g. O(N log N))",
  "spaceComplexityHint": "Expected auxiliary space complexity (e.g. O(1))",
  "keyObservation": "The crucial mental breakthrough or invariant for this problem",
  "pitfallToAvoid": "The most common edge case or trap that causes Wrong Answer/TLE"
}`;

    const response = await waitForAiResponse(ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    }));

    return parseDsaAssistanceResponse(response.text || '');
  } catch (err) {
    reportAiFailure('DSA helper', err);
    return {
      patternDetected: 'Algorithmic Pattern',
      recommendedApproach: 'Break down subproblems, test constraints, and implement clean helper functions.',
      timeComplexityHint: 'O(N)',
      spaceComplexityHint: 'O(1)',
      keyObservation: 'Look for repeated work that can be cached or bypassed.',
      pitfallToAvoid: 'Empty collections and boundary indices.',
    };
  }
}

/**
 * Natural language omni-input parser:
 * e.g., "I solved LeetCode 3Sum in medium difficulty with two pointers"
 * -> automatically structures data into DayRecord update
 */
export async function parseNaturalLanguageLog(input: string): Promise<NaturalInputParsed> {
  const ai = await getAiClient();
  const trimmed = input.trim();

  if (!ai) {
    // Quick heuristic regex parsing
    if (/leetcode|codeforces|hackerrank|problem|solved|dsa/i.test(trimmed)) {
      return {
        type: 'dsa',
        summary: `Log DSA problem from: "${trimmed}"`,
        data: {
          problem: trimmed.replace(/^(solved|did|practiced|completed)\s+/i, ''),
          platform: /codeforces/i.test(trimmed) ? 'Codeforces' : 'LeetCode',
          difficulty: /hard/i.test(trimmed) ? 'Hard' : /easy/i.test(trimmed) ? 'Easy' : 'Medium',
          pattern: 'General Problem Solving',
          solvedIndependently: true,
        },
      };
    }
    return {
      type: 'schedule',
      summary: `Logged note: "${trimmed}"`,
      data: { note: trimmed },
    };
  }

  try {
    const prompt = `Parse this casual daily productivity log entry into structured data:
"${trimmed}"

Possible types: "dsa", "schedule", "habit", "workout", "reflection".
Return ONLY valid JSON matching this schema:
{
  "type": "dsa" | "schedule" | "habit" | "workout" | "reflection",
  "summary": "Clear 1-sentence confirmation of what was recognized",
  "data": {}
}`;

    const response = await waitForAiResponse(ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    }));

    return parseNaturalLanguageLogResponse(response.text || '{}', trimmed);
  } catch (err) {
    return {
      type: 'unknown',
      summary: trimmed,
      data: { text: trimmed },
    };
  }
}

/**
 * Weekly behavioral insights & pattern recognition
 */
export interface WeeklyInsight {
  type: 'streak' | 'energy' | 'discipline' | 'recommendation';
  title: string;
  description: string;
  badge: string;
}

export function analyzeWeeklyPatterns(records: DayRecord[]): WeeklyInsight[] {
  if (!records || records.length === 0) {
    return [
      {
        type: 'streak',
        title: 'New Journey Started',
        description: 'Log your daily activity regularly to unlock deep behavioral insights and pattern analytics.',
        badge: 'Getting Started',
      },
    ];
  }

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 7);

  const avgCompletion = Math.round(recent.reduce((acc, r) => acc + (r.completionPercentage || 0), 0) / recent.length);
  const avgMood = (recent.reduce((acc, r) => acc + (r.mood || 3), 0) / recent.length).toFixed(1);
  const avgSleep = (recent.reduce((acc, r) => acc + (r.sleep || 3), 0) / recent.length).toFixed(1);
  const dsaTotal = recent.reduce((acc, r) => acc + (r.dsa?.length || 0), 0);

  const insights: WeeklyInsight[] = [];

  // Streak & consistency
  insights.push({
    type: 'streak',
    title: `${avgCompletion}% Weekly Completion Average`,
    description: avgCompletion >= 75
      ? 'Exceptional discipline across your scheduled blocks and commitments.'
      : 'Steady baseline. Focus on protecting your top 2 non-negotiables each morning.',
    badge: avgCompletion >= 80 ? '🔥 On Fire' : '⚡ Steady',
  });

  // Energy & Sleep correlation
  insights.push({
    type: 'energy',
    title: `Sleep (${avgSleep}/5) & Energy (${avgMood}/5) Correlation`,
    description: Number(avgSleep) >= 3.5
      ? 'Strong recovery foundation correlates with higher deep-work block completion.'
      : 'Lighter sleep detected over recent days. Prioritize evening wind-down before 22:30.',
    badge: '🧠 Biometrics',
  });

  // DSA momentum
  if (dsaTotal > 0) {
    insights.push({
      type: 'discipline',
      title: `${dsaTotal} DSA Problems Solved Recently`,
      description: 'Consistent problem solving builds pattern recognition intuition faster than binge studying.',
      badge: '💻 Algorithms',
    });
  }

  // Actionable recommendation
  insights.push({
    type: 'recommendation',
    title: 'Behavioral Recommendation',
    description: 'Anchor tomorrow’s hardest task to your highest natural energy window.',
    badge: '💡 Coach Note',
  });

  return insights;
}
