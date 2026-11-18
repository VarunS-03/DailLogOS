import {
  createDefaultOnboardingAnswers,
  validateOnboardingAnswers,
} from '../src/services/accountLifecycle';
import { agentBehavioralProfiler } from '../src/services/onboardingPipeline';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const defaults = createDefaultOnboardingAnswers();
assert(validateOnboardingAnswers(defaults) !== null, 'Default answers should form a valid resumable draft.');
assert(
  validateOnboardingAnswers({ ...defaults, wakeTime: '24:00' }) === null,
  'Invalid 24-hour times should be rejected.'
);
assert(
  validateOnboardingAnswers({ ...defaults, trackingAreas: [] }) === null,
  'At least one tracking area must be selected.'
);
assert(
  validateOnboardingAnswers({ ...defaults, trackingAreas: ['dsa', 'dsa'] }) === null,
  'Duplicate tracking areas should be rejected.'
);
assert(
  validateOnboardingAnswers({ ...defaults, appPreferences: ['daily_briefing', 'unknown'] }) === null,
  'Unsupported app preferences should be rejected.'
);
assert(
  validateOnboardingAnswers({ ...defaults, fixedCommitments: 'x'.repeat(1001) }) === null,
  'Oversized free-text constraints should be rejected.'
);
assert(
  validateOnboardingAnswers({ ...defaults, unexpected: 'value' }) === null,
  'Unknown answer fields should be rejected.'
);

const profiler = agentBehavioralProfiler({
  targetRole: 'custom',
  customRoleTitle: 'Designer',
  chronotype: 'early',
  wakeTime: '08:15',
  sleepTime: '00:30',
  deepWorkCapacity: 'minimum',
  pillars: ['projects'],
  primaryGoal: 'Finish a portfolio project',
  workoutMode: 'home',
});
assert(profiler.constraints.wake === '08:15', "Use the user's explicit wake time.");
assert(profiler.constraints.sleep === '00:30', "Use the user's explicit sleep time.");

console.log('Onboarding questionnaire tests passed.');
