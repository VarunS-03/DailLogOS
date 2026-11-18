import { createDefaultDayRecord } from '../src/constants/templates';
import { validateAndSanitizeBackup } from '../src/utils/backupValidation';
import { addDaysToDateId, getLocalDateId } from '../src/utils/localDate';
import {
  createSystemConfigurationFromRequirements,
  createDefaultSystemConfiguration,
  validateCustomTrackerValues,
  validateUserSystemConfiguration,
} from '../src/services/systemConfiguration';
import { createDefaultOnboardingAnswers } from '../src/services/accountLifecycle';
import { OnboardingRequirements } from '../src/types';

let passed = 0;

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
}

const legacyDay = createDefaultDayRecord('2026-09-11');
delete legacyDay.schemaVersion;

const validBehavioralDay = {
  ...createDefaultDayRecord('2026-09-11'),
  outcomes: [{
    id: 'outcome-1', domain: 'academics', title: 'Finish worksheet', minimumOutput: 'One submitted worksheet',
    priority: 1, status: 'planned', source: 'user', createdAt: '2026-09-11T08:00:00.000Z',
  }],
};

const validBackup = (day: unknown) => JSON.stringify({ days: { '2026-09-11': day } });

assert('legacy records without schemaVersion remain importable', validateAndSanitizeBackup(validBackup(legacyDay)).valid);
assert('behavioral fields serialize through import validation', Boolean(validateAndSanitizeBackup(validBackup(validBehavioralDay)).sanitizedDays?.['2026-09-11'].outcomes));
assert('invalid behavioral enums are rejected', !validateAndSanitizeBackup(validBackup({ ...validBehavioralDay, outcomes: [{ ...validBehavioralDay.outcomes[0], status: 'invalid' }] })).valid);
assert('oversized behavioral arrays are rejected', !validateAndSanitizeBackup(validBackup({ ...validBehavioralDay, focusSessions: Array.from({ length: 21 }, () => ({})) })).valid);
const systemConfiguration = createDefaultSystemConfiguration();
assert('default system configuration satisfies the versioned contract', validateUserSystemConfiguration(systemConfiguration) !== null);
assert('duplicate dashboard widgets are rejected', validateUserSystemConfiguration({
  ...systemConfiguration,
  dashboardLayout: ['briefing', 'briefing'],
}) === null);
assert('custom tracker values enforce bounded numeric values', validateCustomTrackerValues([{ trackerId: 'water', value: 1500 }]) !== null);
assert('custom tracker values reject negative values', validateCustomTrackerValues([{ trackerId: 'water', value: -1 }]) === null);
const onboardingAnswers = createDefaultOnboardingAnswers();
onboardingAnswers.primaryGoal = 'Finish the capstone project';
onboardingAnswers.secondaryGoals = 'Review databases\nPractice system design';
onboardingAnswers.trackingAreas = ['fitness', 'reading'];
const confirmedRequirements: OnboardingRequirements = {
  schemaVersion: 1,
  sourceAnswers: onboardingAnswers,
  interpretation: {
    summary: 'Prioritize fitness and deliberate reading.',
    priorityAreas: ['fitness', 'reading'],
    constraints: '',
  },
  source: 'offline',
  userConfirmed: true,
  generatedAt: '2026-09-11T08:00:00.000Z',
};
const onboardingConfiguration = createSystemConfigurationFromRequirements(confirmedRequirements);
assert('onboarding maps reviewed pillars into supported modules', onboardingConfiguration.enabledModules.includes('workout') && onboardingConfiguration.enabledModules.includes('academics'));
assert('onboarding maps weekly review preference into Insights', onboardingConfiguration.enabledModules.includes('insights'));
assert('onboarding carries goals and AI preferences into configuration', onboardingConfiguration.goals.primary === onboardingAnswers.primaryGoal && onboardingConfiguration.aiBehavior === 'enabled');
assert('onboarding adds the daily briefing widget only when selected', onboardingConfiguration.dashboardLayout.includes('briefing'));
const noAiConfiguration = createSystemConfigurationFromRequirements({
  ...confirmedRequirements,
  sourceAnswers: { ...onboardingAnswers, appPreferences: [] },
});
assert('onboarding disables AI when no AI preferences were selected', noAiConfiguration.aiBehavior === 'disabled' && !noAiConfiguration.dashboardLayout.includes('briefing'));
assert('backup validation retains a valid system configuration', validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-09-11': legacyDay },
  settings: { defaultWorkoutMode: 'gym', academicSchedule: {}, theme: 'dark', systemConfiguration },
})).sanitizedSettings?.systemConfiguration?.schemaVersion === 1);
assert('backup validation rejects malformed custom tracker values', !validateAndSanitizeBackup(validBackup({
  ...legacyDay,
  customTrackerValues: [{ trackerId: 'water', value: -1 }],
})).valid);
assert('malformed day keys are rejected', !validateAndSanitizeBackup(JSON.stringify({ days: { '11-09-2026': legacyDay } })).valid);
assert('impossible calendar dates are rejected', !validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-02-30': legacyDay },
})).valid);
assert('malformed day entries are rejected rather than silently skipped', !validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-09-11': null },
})).valid);
assert('out-of-range day numbers are rejected', !validateAndSanitizeBackup(validBackup({
  ...legacyDay,
  mood: 9,
})).valid);
assert('malformed settings structures are rejected', !validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-09-11': legacyDay },
  settings: { academicSchedule: [] },
})).valid);
assert('unsupported backup versions are rejected', !validateAndSanitizeBackup(JSON.stringify({
  schemaVersion: 2,
  days: { '2026-09-11': legacyDay },
})).valid);
assert('unknown backup root fields are rejected', !validateAndSanitizeBackup(JSON.stringify({
  schemaVersion: 1,
  days: { '2026-09-11': legacyDay },
  apiKey: 'must not be imported',
})).valid);
assert('unknown day fields are rejected', !validateAndSanitizeBackup(validBackup({
  ...legacyDay,
  uid: 'another-user',
})).valid);
assert('backup record-count mismatches are rejected', !validateAndSanitizeBackup(JSON.stringify({
  schemaVersion: 1,
  recordCount: 2,
  days: { '2026-09-11': legacyDay },
})).valid);
assert('backup input over 5 MiB is rejected before parsing', !validateAndSanitizeBackup(' '.repeat(5 * 1024 * 1024 + 1)).valid);
assert('versionless legacy backups remain importable', validateAndSanitizeBackup(validBackup(legacyDay)).valid);
assert('empty versioned backups remain importable', validateAndSanitizeBackup(JSON.stringify({
  schemaVersion: 1,
  recordCount: 0,
  settings: {},
  days: {},
})).valid);
const customSystemBackup = validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-09-11': legacyDay },
  settings: {
    defaultWorkoutMode: 'gym',
    academicSchedule: {},
    theme: 'dark',
    dailySystem: {
      workoutMode: 'gym',
      schedule: [{ id: 's1', time: '10:00', title: 'Focus', category: 'project', status: 'pending' }],
      habits: [{ id: 'h1', title: 'Walk', detail: 'Outside', completed: false }],
      nonNegotiables: [{ id: 'n1', name: 'Review', target: 'Daily', completed: false }],
      workoutCycle: 'Custom',
      workoutExercises: [{ name: 'Movement', target: '4 × 8', sets: 4 }],
    },
  },
}));
assert('backup validation preserves a bounded personalized daily system', customSystemBackup.sanitizedSettings?.dailySystem?.workoutExercises[0]?.sets === 4);
assert('malformed backup routines are rejected rather than replaced with defaults', !validateAndSanitizeBackup(JSON.stringify({
  days: { '2026-09-11': legacyDay },
  settings: {
    dailySystem: {
      workoutMode: 'gym',
      schedule: [{ id: 's1', time: '10:00', title: 'Focus', category: 'project', status: 'pending', script: 'no' }],
      habits: [{ id: 'h1', title: 'Walk', detail: 'Outside', completed: false }],
      nonNegotiables: [{ id: 'n1', name: 'Review', target: 'Daily', completed: false }],
      workoutCycle: 'Custom',
      workoutExercises: [{ name: 'Move', target: '4 x 8', sets: 4 }],
    },
  },
})).valid);
assert('local date uses local calendar fields', getLocalDateId(new Date(2026, 8, 11, 0, 5)) === '2026-09-11');
assert('calendar navigation crosses local month boundaries', addDaysToDateId('2026-03-01', -1) === '2026-02-28');

console.log(`Behavioral contract tests: ${passed} passed.`);
