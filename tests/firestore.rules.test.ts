/**
 * DAILY OS — Firestore Security Rules Test Suite
 * Validates Firestore authorization and schema invariants:
 * 1. Unauthenticated read denied
 * 2. Unauthenticated write denied
 * 3. Unauthenticated settings read denied
 * 4. Cross-user read denied (User A reading User B)
 * 5. Cross-user write denied (User A writing User B)
 * 6. Cross-user delete denied (User A deleting User B)
 * 7. Cross-user settings read denied
 * 8. Cross-user settings write denied
 * 9. Invalid date ID format rejected (non-YYYY-MM-DD or path traversal)
 * 10. Date mismatch between path and body rejected (spoofing protection)
 * 11. Invalid completion percentage (> 100 or < 0) rejected
 * 12. Invalid mood/energy/sleep (> 5 or < 1) rejected
 * 13. Volumetric limit exceeded (> 5000 chars notes) rejected
 * 14. Array cap exceeded (> 50 items in schedule/habits/dsa) rejected
 * 15. Unknown collections rejected (Deny-by-default)
 * 16. Non-'main' settings ID rejected
 * 17. Owner can write valid onboarding progress
 * 18. Cross-user onboarding access denied
 * 19. Invalid onboarding status rejected
 * 20. Unknown onboarding fields rejected
 */

import { createDefaultOnboardingAnswers } from '../src/services/accountLifecycle';

interface SecurityContext {
  auth: { uid: string } | null;
}

interface FirestoreDocument {
  [key: string]: any;
}

function isBoundedStringList(
  value: unknown,
  minItems: number,
  maxItems: number,
  choices: string[]
): value is string[] {
  return Array.isArray(value)
    && value.length >= minItems
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && item.length <= 32 && choices.includes(item));
}

function isValidOnboardingAnswers(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, any>;
  const expectedKeys = [
    'schemaVersion', 'targetRole', 'customRoleTitle', 'chronotype', 'wakeTime', 'sleepTime',
    'deepWorkCapacity', 'availableHoursPerDay', 'workDaysPerWeek', 'fixedCommitments',
    'primaryGoal', 'secondaryGoals', 'trackingAreas', 'workoutMode', 'preferredSessionMinutes',
    'planningStyle', 'appPreferences', 'customInstructions',
  ];
  return Object.keys(data).length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(data, key))
    && data.schemaVersion === 1
    && ['student', 'engineer', 'founder', 'creator', 'fitness', 'custom'].includes(data.targetRole)
    && typeof data.customRoleTitle === 'string' && data.customRoleTitle.length <= 80
    && ['early', 'standard', 'night'].includes(data.chronotype)
    && typeof data.wakeTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.wakeTime)
    && typeof data.sleepTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.sleepTime)
    && ['minimum', 'moderate', 'high'].includes(data.deepWorkCapacity)
    && Number.isInteger(data.availableHoursPerDay) && data.availableHoursPerDay >= 1 && data.availableHoursPerDay <= 16
    && Number.isInteger(data.workDaysPerWeek) && data.workDaysPerWeek >= 1 && data.workDaysPerWeek <= 7
    && typeof data.fixedCommitments === 'string' && data.fixedCommitments.length <= 1000
    && typeof data.primaryGoal === 'string' && data.primaryGoal.length <= 500
    && typeof data.secondaryGoals === 'string' && data.secondaryGoals.length <= 500
    && isBoundedStringList(data.trackingAreas, 1, 5, ['dsa', 'academics', 'fitness', 'projects', 'reading'])
    && ['gym', 'home'].includes(data.workoutMode)
    && [25, 50, 90].includes(data.preferredSessionMinutes)
    && ['minimal', 'balanced', 'structured'].includes(data.planningStyle)
    && isBoundedStringList(data.appPreferences, 0, 4, ['daily_briefing', 'gentle_prompts', 'weekly_review', 'ai_suggestions'])
    && typeof data.customInstructions === 'string' && data.customInstructions.length <= 1000;
}

function isValidOnboardingRequirements(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, any>;
  const expectedKeys = ['schemaVersion', 'sourceAnswers', 'interpretation', 'source', 'userConfirmed', 'generatedAt'];
  const interpretation = data.interpretation;
  if (!interpretation || typeof interpretation !== 'object' || Array.isArray(interpretation)) return false;
  const interpretationKeys = ['summary', 'priorityAreas', 'constraints'];
  return Object.keys(data).length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(data, key))
    && data.schemaVersion === 1
    && isValidOnboardingAnswers(data.sourceAnswers)
    && Object.keys(interpretation).length === interpretationKeys.length
    && interpretationKeys.every((key) => Object.prototype.hasOwnProperty.call(interpretation, key))
    && typeof interpretation.summary === 'string'
    && interpretation.summary.trim().length > 0
    && interpretation.summary.length <= 500
    && isBoundedStringList(interpretation.priorityAreas, 1, 5, ['dsa', 'academics', 'fitness', 'projects', 'reading'])
    && interpretation.priorityAreas.every((area: string) => data.sourceAnswers.trackingAreas.includes(area))
    && typeof interpretation.constraints === 'string'
    && interpretation.constraints.length <= 1000
    && ['gemini', 'offline'].includes(data.source)
    && typeof data.userConfirmed === 'boolean'
    && typeof data.generatedAt === 'string'
    && data.generatedAt.length <= 64;
}

function isValidSystemConfiguration(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, any>;
  const allowedKeys = ['schemaVersion', 'enabledModules', 'dashboardLayout', 'customTrackers', 'goals', 'aiBehavior'];
  const moduleIds = ['academics', 'dsa', 'workout', 'projects', 'insights'];
  const widgetIds = ['briefing', 'commitments', 'schedule', 'workspaces', 'goals', 'custom_trackers'];
  const goals = data.goals;
  if (!goals || typeof goals !== 'object' || Array.isArray(goals)) return false;
  return Object.keys(data).every((key) => allowedKeys.includes(key))
    && Object.keys(data).length === allowedKeys.length
    && data.schemaVersion === 1
    && Array.isArray(data.enabledModules)
    && data.enabledModules.length <= 5
    && data.enabledModules.every((module: unknown) => moduleIds.includes(String(module)))
    && new Set(data.enabledModules).size === data.enabledModules.length
    && Array.isArray(data.dashboardLayout)
    && data.dashboardLayout.length <= 6
    && data.dashboardLayout.every((widget: unknown) => widgetIds.includes(String(widget)))
    && new Set(data.dashboardLayout).size === data.dashboardLayout.length
    && Array.isArray(data.customTrackers)
    && data.customTrackers.length <= 10
    && data.customTrackers.every((tracker: any) => tracker && typeof tracker === 'object'
      && !Array.isArray(tracker)
      && Object.keys(tracker).every((key) => ['id', 'name', 'unit', 'dailyTarget'].includes(key))
      && ['id', 'name', 'unit'].every((key) => Object.prototype.hasOwnProperty.call(tracker, key))
      && typeof tracker.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(tracker.id)
      && typeof tracker.name === 'string' && tracker.name.trim().length > 0 && tracker.name.length <= 50
      && typeof tracker.unit === 'string' && tracker.unit.length <= 20
      && (tracker.dailyTarget === undefined || (typeof tracker.dailyTarget === 'number' && Number.isFinite(tracker.dailyTarget) && tracker.dailyTarget >= 0 && tracker.dailyTarget <= 100000)))
    && new Set(data.customTrackers.map((tracker: any) => tracker.id)).size === data.customTrackers.length
    && Object.keys(goals).length === 2
    && Object.prototype.hasOwnProperty.call(goals, 'primary')
    && Object.prototype.hasOwnProperty.call(goals, 'secondary')
    && typeof goals.primary === 'string' && goals.primary.length <= 500
    && Array.isArray(goals.secondary) && goals.secondary.length <= 5
    && goals.secondary.every((goal: unknown) => typeof goal === 'string' && goal.trim().length > 0 && goal.length <= 200)
    && ['enabled', 'disabled'].includes(data.aiBehavior);
}

function isValidCustomTrackerValues(value: unknown): boolean {
  return Array.isArray(value)
    && value.length <= 10
    && value.every((entry: any) => entry && typeof entry === 'object'
      && !Array.isArray(entry)
      && Object.keys(entry).length === 2
      && Object.prototype.hasOwnProperty.call(entry, 'trackerId')
      && Object.prototype.hasOwnProperty.call(entry, 'value')
      && typeof entry.trackerId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.trackerId)
      && typeof entry.value === 'number'
      && Number.isFinite(entry.value)
      && entry.value >= 0
      && entry.value <= 100000)
    && new Set(value.map((entry: any) => entry.trackerId)).size === value.length;
}

// Rules engine simulation that mirrors the exact logic of firestore.rules
export class FirestoreRulesEvaluator {
  // Global catch-all is false unless matched
  static evaluate(
    path: string,
    operation: 'read' | 'create' | 'update' | 'delete',
    context: SecurityContext,
    resourceData?: FirestoreDocument,
    requestData?: FirestoreDocument
  ): { allowed: boolean; reason?: string } {
    const segments = path.split('/').filter(Boolean);

    // Rule 1: Check if top level is 'users'
    if (segments.length < 2 || segments[0] !== 'users') {
      return { allowed: false, reason: 'DENY_BY_DEFAULT: Unknown root collection or path' };
    }

    const uid = segments[1];

    // Auth check
    if (!context.auth || !context.auth.uid) {
      return { allowed: false, reason: 'UNAUTHENTICATED: request.auth is null' };
    }

    if (context.auth.uid !== uid) {
      return { allowed: false, reason: 'UNAUTHORIZED: request.auth.uid != path.uid' };
    }

    // Path 1: /users/{uid}
    if (segments.length === 2) {
      if (operation === 'read' || operation === 'delete') {
        return { allowed: true };
      }
      if (operation === 'create' || operation === 'update') {
        const data = requestData || {};
        if (data.uid && data.uid !== uid) {
          return { allowed: false, reason: 'INVALID_USER: uid mismatch' };
        }
        if (data.email && (typeof data.email !== 'string' || data.email.length > 256)) {
          return { allowed: false, reason: 'INVALID_USER: email too long or non-string' };
        }
        return { allowed: true };
      }
    }

    // Path 2: /users/{uid}/settings/{settingId}
    if (segments.length === 4 && segments[2] === 'settings') {
      const settingId = segments[3];
      if (settingId !== 'main') {
        return { allowed: false, reason: 'INVALID_SETTING_ID: Only main settings allowed' };
      }
      if (operation === 'read' || operation === 'delete') {
        return { allowed: true };
      }
      if (operation === 'create' || operation === 'update') {
        const data = requestData || {};
        if (data.defaultWorkoutMode && !['gym', 'home'].includes(data.defaultWorkoutMode)) {
          return { allowed: false, reason: 'INVALID_SETTINGS: defaultWorkoutMode invalid' };
        }
        if (data.theme && !['dark', 'light'].includes(data.theme)) {
          return { allowed: false, reason: 'INVALID_SETTINGS: theme invalid' };
        }
        if (data.systemConfiguration !== undefined && !isValidSystemConfiguration(data.systemConfiguration)) {
          return { allowed: false, reason: 'INVALID_SETTINGS: systemConfiguration invalid' };
        }
        return { allowed: true };
      }
    }

    // Path 3: /users/{uid}/onboarding/main
    if (segments.length === 4 && segments[2] === 'onboarding') {
      if (segments[3] !== 'main') {
        return { allowed: false, reason: 'INVALID_ONBOARDING_ID: Only main onboarding allowed' };
      }
      if (operation === 'read' || operation === 'delete') {
        return { allowed: true };
      }
      if (operation === 'create' || operation === 'update') {
        const data = requestData || {};
        const allowedKeys = ['status', 'version', 'currentStage', 'startedAt', 'completedAt', 'updatedAt', 'answers', 'requirements', 'systemConfiguration'];
        if (Object.keys(data).some((key) => !allowedKeys.includes(key))) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: unexpected field' };
        }
        if (!['not_started', 'in_progress', 'completed'].includes(data.status)) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: status invalid' };
        }
        if (!Number.isInteger(data.version) || data.version < 1 || data.version > 100) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: version invalid' };
        }
        if (!Number.isInteger(data.currentStage) || data.currentStage < 1 || data.currentStage > 6) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: stage invalid' };
        }
        if (typeof data.updatedAt !== 'string' || data.updatedAt.length > 64) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: updatedAt invalid' };
        }
        for (const field of ['startedAt', 'completedAt']) {
          if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 64)) {
            return { allowed: false, reason: `INVALID_ONBOARDING: ${field} invalid` };
          }
        }
        if (data.answers !== undefined && !isValidOnboardingAnswers(data.answers)) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: answers invalid' };
        }
        if (
          data.requirements !== undefined
          && (
            !isValidOnboardingRequirements(data.requirements)
            || !data.answers
            || JSON.stringify(data.requirements.sourceAnswers) !== JSON.stringify(data.answers)
          )
        ) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: requirements invalid' };
        }
        if (
          data.systemConfiguration !== undefined
          && (
            !isValidSystemConfiguration(data.systemConfiguration)
            || !data.requirements
            || data.requirements.userConfirmed !== true
          )
        ) {
          return { allowed: false, reason: 'INVALID_ONBOARDING: systemConfiguration invalid or unconfirmed' };
        }
        return { allowed: true };
      }
    }

    // Path 3: /users/{uid}/days/{dateId}
    if (segments.length === 4 && segments[2] === 'days') {
      const dateId = segments[3];
      const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
      if (!dateRegex.test(dateId)) {
        return { allowed: false, reason: 'INVALID_DATE_ID: dateId format must be YYYY-MM-DD' };
      }

      if (operation === 'read' || operation === 'delete') {
        return { allowed: true };
      }

      if (operation === 'create' || operation === 'update') {
        const data = requestData || {};
        if (typeof data.date !== 'string' || data.date !== dateId || !dateRegex.test(data.date)) {
          return { allowed: false, reason: 'DATE_MISMATCH: data.date must match dateId and ISO format' };
        }
        if (data.mood !== undefined && (typeof data.mood !== 'number' || data.mood < 1 || data.mood > 5)) {
          return { allowed: false, reason: 'RANGE_VIOLATION: mood must be between 1 and 5' };
        }
        if (data.energy !== undefined && (typeof data.energy !== 'number' || data.energy < 1 || data.energy > 5)) {
          return { allowed: false, reason: 'RANGE_VIOLATION: energy must be between 1 and 5' };
        }
        if (data.sleep !== undefined && (typeof data.sleep !== 'number' || data.sleep < 1 || data.sleep > 5)) {
          return { allowed: false, reason: 'RANGE_VIOLATION: sleep must be between 1 and 5' };
        }
        if (data.completionPercentage !== undefined && (typeof data.completionPercentage !== 'number' || data.completionPercentage < 0 || data.completionPercentage > 100)) {
          return { allowed: false, reason: 'RANGE_VIOLATION: completionPercentage must be 0-100' };
        }
        if (data.notes && (typeof data.notes !== 'string' || data.notes.length > 5000)) {
          return { allowed: false, reason: 'SIZE_VIOLATION: notes string exceeds 5000 characters' };
        }
        if (data.tomorrowFirstAction && (typeof data.tomorrowFirstAction !== 'string' || data.tomorrowFirstAction.length > 1000)) {
          return { allowed: false, reason: 'SIZE_VIOLATION: tomorrowFirstAction exceeds 1000 characters' };
        }
        if (data.schedule && (!Array.isArray(data.schedule) || data.schedule.length > 50)) {
          return { allowed: false, reason: 'ARRAY_LIMIT_EXCEEDED: schedule exceeds 50 items' };
        }
        if (data.habits && (!Array.isArray(data.habits) || data.habits.length > 50)) {
          return { allowed: false, reason: 'ARRAY_LIMIT_EXCEEDED: habits exceeds 50 items' };
        }
        if (data.dsa && (!Array.isArray(data.dsa) || data.dsa.length > 50)) {
          return { allowed: false, reason: 'ARRAY_LIMIT_EXCEEDED: dsa exceeds 50 items' };
        }
        if (data.schemaVersion !== undefined && (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 0 || data.schemaVersion > 100)) {
          return { allowed: false, reason: 'INVALID_SCHEMA_VERSION: schemaVersion must be 0-100' };
        }
        if (data.customTrackerValues !== undefined && !isValidCustomTrackerValues(data.customTrackerValues)) {
          return { allowed: false, reason: 'INVALID_TRACKERS: customTrackerValues invalid' };
        }
        for (const [field, limit] of [['outcomes', 10], ['focusSessions', 20], ['recoveryDecisions', 20], ['creditEvents', 20]] as const) {
          if (data[field] && (!Array.isArray(data[field]) || data[field].length > limit)) {
            return { allowed: false, reason: `ARRAY_LIMIT_EXCEEDED: ${field} exceeds ${limit} items` };
          }
        }
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'DENY_BY_DEFAULT: Unhandled subcollection or path' };
  }
}

// Automated Test Runner
function runSecurityTests() {
  console.log('========================================================');
  console.log('  DAILY OS — RUNNING FIRESTORE SECURITY RULES TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assertRule(name: string, shouldAllow: boolean, res: { allowed: boolean; reason?: string }) {
    if (res.allowed === shouldAllow) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: Expected allowed=${shouldAllow}, got allowed=${res.allowed} (reason: ${res.reason})`);
      failed++;
    }
  }

  const userA = { auth: { uid: 'user_alice_123' } };
  const userB = { auth: { uid: 'user_bob_456' } };
  const anon = { auth: null };

  const validDayRecord = {
    date: '2026-09-03',
    completionPercentage: 85,
    mood: 4,
    energy: 4,
    sleep: 4,
    notes: 'Studied dynamic programming and push day workout.',
    schedule: [{ id: '1', title: 'Deep Work' }],
    habits: [{ id: '1', title: 'Hydration' }],
    dsa: [{ id: '1', problem: 'Two Sum' }],
  };

  // Test 1: Unauthenticated user cannot read any day record
  assertRule(
    '1. Unauthenticated read of day record denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'read', anon)
  );

  // Test 2: Unauthenticated user cannot create a day record
  assertRule(
    '2. Unauthenticated write of day record denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', anon, undefined, validDayRecord)
  );

  // Test 3: Unauthenticated user cannot read settings
  assertRule(
    '3. Unauthenticated read of user settings denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/main', 'read', anon)
  );

  // Test 4: Authenticated user A cannot read user B's day records
  assertRule(
    '4. Cross-user read denied (Bob cannot read Alice)',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'read', userB)
  );

  // Test 5: Authenticated user A cannot write to user B's day records
  assertRule(
    '5. Cross-user write denied (Bob cannot write to Alice)',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userB, undefined, validDayRecord)
  );

  // Test 6: Authenticated user A cannot delete user B's day records
  assertRule(
    '6. Cross-user delete denied (Bob cannot delete Alice)',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'delete', userB)
  );

  // Test 7: Authenticated user A cannot read user B's settings
  assertRule(
    '7. Cross-user settings read denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/main', 'read', userB)
  );

  // Test 8: Authenticated user A cannot write user B's settings
  assertRule(
    '8. Cross-user settings write denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/main', 'update', userB, undefined, { theme: 'light' })
  );

  // Test 9: Authenticated user CAN read/write their OWN day record
  assertRule(
    '9. Owner can read/write their own day record',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, validDayRecord)
  );

  // Test 10: Write with invalid date format is rejected
  assertRule(
    '10. Write with invalid date ID format rejected (non-ISO)',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/invalid-date-format', 'create', userA, undefined, {
      ...validDayRecord,
      date: 'invalid-date-format',
    })
  );

  // Test 11: Write with date mismatch between path and body rejected
  assertRule(
    '11. Write with path-to-body date mismatch rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      date: '2026-09-04',
    })
  );

  // Test 12: Write with completionPercentage > 100 rejected
  assertRule(
    '12. Write with completionPercentage > 100 rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      completionPercentage: 150,
    })
  );

  // Test 13: Write with mood > 5 rejected
  assertRule(
    '13. Write with mood > 5 rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      mood: 9,
    })
  );

  // Test 14: Volumetric limit violation (> 5000 chars notes) rejected
  const hugeNotes = 'A'.repeat(5001);
  assertRule(
    '14. Write with excessive notes length (> 5000 chars) rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      notes: hugeNotes,
    })
  );

  // Test 15: Array item limit violation (> 50 items) rejected
  const hugeSchedule = Array.from({ length: 51 }, (_, i) => ({ id: `${i}`, title: `Item ${i}` }));
  assertRule(
    '15. Write with oversized array (> 50 items) rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      schedule: hugeSchedule,
    })
  );

  // Test 16: Unknown collections and non-main settings ID rejected
  assertRule(
    '16a. Access to unknown collection rejected (Deny-by-default)',
    false,
    FirestoreRulesEvaluator.evaluate('global_records/public_notes', 'read', userA)
  );

  assertRule(
    '16b. Non-main settings ID rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/malicious_custom_id', 'create', userA, undefined, { theme: 'light' })
  );

  const onboardingProgress = {
    status: 'in_progress',
    version: 1,
    currentStage: 2,
    startedAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  };
  assertRule(
    '17. Owner can create valid onboarding progress',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'create', userA, undefined, onboardingProgress)
  );
  const validAnswers = createDefaultOnboardingAnswers();
  assertRule(
    '17a. Owner can persist valid questionnaire answers',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
    })
  );
  const validRequirements = {
    schemaVersion: 1,
    sourceAnswers: validAnswers,
    interpretation: {
      summary: 'Plan around the selected goal and available time.',
      priorityAreas: validAnswers.trackingAreas,
      constraints: '',
    },
    source: 'offline',
    userConfirmed: false,
    generatedAt: '2026-09-03T08:00:00.000Z',
  };
  assertRule(
    '17e. Owner can persist a valid requirements specification',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
      requirements: validRequirements,
    })
  );
  assertRule(
    '17f. Requirements must match their saved questionnaire answers',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
      requirements: {
        ...validRequirements,
        sourceAnswers: { ...validAnswers, primaryGoal: 'A different goal' },
      },
    })
  );
  assertRule(
    '17g. Unsupported interpreted priorities are rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
      requirements: {
        ...validRequirements,
        interpretation: { ...validRequirements.interpretation, priorityAreas: ['reading'] },
      },
    })
  );
  assertRule(
    '17b. Oversized tracking selection rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: { ...validAnswers, trackingAreas: Array(6).fill('projects') },
    })
  );
  assertRule(
    '17c. Invalid schedule time rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: { ...validAnswers, wakeTime: '25:70' },
    })
  );
  assertRule(
    '17d. Unsupported tracking area rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: { ...validAnswers, trackingAreas: ['arbitrary'] },
    })
  );
  assertRule(
    '18. Cross-user onboarding access denied',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'read', userB)
  );
  assertRule(
    '19. Invalid onboarding status rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      status: 'done',
    })
  );
  assertRule(
    '20. Unknown onboarding fields rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      arbitrary: true,
    })
  );

  assertRule(
    '21. Write with oversized Behavioral Core focus sessions rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      focusSessions: Array.from({ length: 21 }, () => ({})),
    })
  );

  const validSystemConfiguration = {
    schemaVersion: 1,
    enabledModules: ['academics', 'dsa', 'workout', 'projects', 'insights'],
    dashboardLayout: ['briefing', 'commitments', 'schedule', 'workspaces', 'goals', 'custom_trackers'],
    customTrackers: [{ id: 'water', name: 'Water', unit: 'ml', dailyTarget: 2000 }],
    goals: { primary: 'Build consistent habits', secondary: ['Ship the project'] },
    aiBehavior: 'enabled',
  };
  assertRule(
    '22. Owner can save valid system configuration',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/main', 'update', userA, undefined, {
      theme: 'dark',
      systemConfiguration: validSystemConfiguration,
    })
  );
  assertRule(
    '23. Invalid system configuration values are rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/settings/main', 'update', userA, undefined, {
      theme: 'dark',
      systemConfiguration: { ...validSystemConfiguration, aiBehavior: 'unrestricted' },
    })
  );
  assertRule(
    '24. Owner can save bounded custom tracker values',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'update', userA, undefined, {
      ...validDayRecord,
      customTrackerValues: [{ trackerId: 'water', value: 1500 }],
    })
  );
  assertRule(
    '25. Invalid custom tracker values are rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'update', userA, undefined, {
      ...validDayRecord,
      customTrackerValues: [{ trackerId: 'water', value: 150001 }],
    })
  );
  const confirmedRequirements = { ...validRequirements, userConfirmed: true };
  assertRule(
    '26. Confirmed onboarding configuration can be persisted',
    true,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
      requirements: confirmedRequirements,
      systemConfiguration: validSystemConfiguration,
    })
  );
  assertRule(
    '27. Unconfirmed onboarding requirements cannot persist a system configuration',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/onboarding/main', 'update', userA, undefined, {
      ...onboardingProgress,
      answers: validAnswers,
      requirements: validRequirements,
      systemConfiguration: validSystemConfiguration,
    })
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
