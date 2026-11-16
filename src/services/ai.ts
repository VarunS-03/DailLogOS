import { GoogleGenAI } from '@google/genai';
import { DayRecord, DailyReflection, DsaProblem, UserSettings } from '../types';

// Read API key from environment or localStorage if user set it in Settings
export function getGeminiApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
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

function getAiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
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

export interface NaturalInputParsed {
  type: 'dsa' | 'schedule' | 'habit' | 'workout' | 'reflection' | 'unknown';
  summary: string;
  data: any;
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
  const ai = getAiClient();
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text || '';
    return JSON.parse(text);
  } catch (err) {
    console.warn('AI Briefing fallback used:', err);
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
  const completedSchedule = day.schedule?.filter((s) => s.status === 'completed').map((s) => s.title).join(', ') || 'Various schedule blocks';
  const dsaCount = day.dsa?.length || 0;
  const dsaNames = day.dsa?.map((d) => d.problem).join(', ') || '';
  const workoutDone = day.workout?.status === 'completed';
  const academicSubject = day.academics?.subject || 'Academics';

  const ai = getAiClient();

  if (!ai) {
    // Intelligent heuristic synthesis
    return {
      academicLearned: day.academics?.learned || (day.academics?.objective ? `Covered core tenets of ${day.academics.objective}.` : `Focused review on ${academicSubject}.`),
      academicRetrieve: day.academics?.retrieve || `Active recall completed for key concepts in ${academicSubject}.`,
      academicWeak: day.academics?.weak || 'Edge cases and speed of synthesis require repetition.',
      dsaProblem: dsaNames || (dsaCount > 0 ? `${dsaCount} problem(s) reviewed` : 'Core algorithm pattern practice'),
      dsaPattern: day.dsa?.[0]?.pattern || 'Two Pointers / Hash Map / DP',
      dsaInsight: day.dsa?.[0]?.insight || 'Careful index boundary checking prevents off-by-one errors.',
      dsaMistake: day.dsa?.[0]?.failureMistake || 'Avoid premature optimization before validating the brute-force baseline.',
      projectArtifact: day.project?.artifact || day.project?.goal || 'Consistent step forward on active build.',
      tomorrowFirstAction: day.tomorrowFirstAction || '06:00 AM — Open first academic module with zero phone friction',
      notes: `Solid day with ${day.completionPercentage}% completion. Maintained focus across ${completedSchedule || 'daily commitments'}. ${workoutDone ? 'Workout session finished strong.' : ''}`,
    };
  }

  try {
    const prompt = `You are an AI assistant in Daily OS. Synthesize the user's daily activity into an insightful, structured reflection draft.

Data for date: ${day.date} (${day.dayOfWeek})
Completion rate: ${day.completionPercentage}%
Schedule completed: ${completedSchedule}
Academic Subject: ${academicSubject}
Academic notes: ${day.academics?.learned || 'None'}
DSA Problems (${dsaCount}): ${dsaNames}
Workout cycle: ${day.workout?.cycleDay} (Status: ${day.workout?.status})
Mood: ${day.mood}/5, Energy: ${day.energy}/5, Sleep: ${day.sleep}/5

Return ONLY valid JSON with these keys without markdown code blocks:
{
  "academicLearned": "Synthesized 1-2 sentence core learning",
  "academicRetrieve": "Key principle or formula to recall",
  "academicWeak": "One identified friction or weak area",
  "dsaProblem": "Primary problem name or topic reviewed",
  "dsaPattern": "Recognized algorithmic pattern",
  "dsaInsight": "Key algorithmic or structural insight",
  "dsaMistake": "Common trap or oversight avoided/encountered",
  "projectArtifact": "Tangible progress or output achieved",
  "tomorrowFirstAction": "Actionable, precise first step for tomorrow morning",
  "notes": "Holistic, constructive reflection on discipline and energy management today"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text || '';
    return JSON.parse(text);
  } catch (err) {
    console.warn('AI Reflection fallback used:', err);
    return {
      tomorrowFirstAction: 'Review top objective with fresh mind in the morning block',
      notes: `Finished today with ${day.completionPercentage}% completion. Continuous consistency over intensity.`,
    };
  }
}

/**
 * Intelligent DSA Coach: Given a problem title or prompt, recommends pattern, hints,
 * algorithmic approach, and common pitfalls without spoiling the entire solution immediately.
 */
export async function assistDsaProblem(problemTitle: string, platform: string, difficulty: string): Promise<DsaAiAssistance> {
  const ai = getAiClient();

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text || '';
    return JSON.parse(text);
  } catch (err) {
    console.warn('AI DSA helper error:', err);
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
  const ai = getAiClient();
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return JSON.parse(response.text || '{}');
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
