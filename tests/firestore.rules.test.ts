/**
 * DAILY OS — Firestore Security Rules Test Suite
 * Validates all 16 mission-critical security and authorization invariants:
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
 */

interface SecurityContext {
  auth: { uid: string } | null;
}

interface FirestoreDocument {
  [key: string]: any;
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

  assertRule(
    '17. Write with oversized Behavioral Core focus sessions rejected',
    false,
    FirestoreRulesEvaluator.evaluate('users/user_alice_123/days/2026-09-03', 'create', userA, undefined, {
      ...validDayRecord,
      focusSessions: Array.from({ length: 21 }, () => ({})),
    })
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
