import {
  createDefaultOnboardingAnswers,
  onboardingRequirementsMatchAnswers,
  validateOnboardingRequirements,
} from '../src/services/accountLifecycle';
import {
  createOfflineOnboardingRequirements,
  validateRequirementsInterpretation,
} from '../src/services/requirementsInterpreter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const answers = {
  ...createDefaultOnboardingAnswers(),
  primaryGoal: 'Complete a portfolio project',
  fixedCommitments: 'Classes from 9 to 1',
  trackingAreas: ['projects', 'academics'] as ('projects' | 'academics')[],
};
const interpreted = validateRequirementsInterpretation({
  summary: "Prioritize the portfolio goal within the user's class schedule.",
  priorityAreas: ['projects', 'academics'],
  constraints: 'Classes from 9 to 1',
}, answers);
assert(interpreted !== null, 'A bounded interpretation using selected areas should be accepted.');
assert(
  validateRequirementsInterpretation({
    summary: 'Focus on everything.',
    priorityAreas: ['reading'],
    constraints: '',
  }, answers) === null,
  'AI output must not add tracking areas the user did not select.'
);
assert(
  validateRequirementsInterpretation({
    summary: 'A valid summary.',
    priorityAreas: ['projects', 'projects'],
    constraints: '',
  }, answers) === null,
  'Duplicate priority areas should be rejected.'
);
assert(
  validateRequirementsInterpretation({
    summary: 'A valid summary.',
    priorityAreas: ['projects'],
    constraints: 'x'.repeat(1001),
  }, answers) === null,
  'Oversized interpreted constraints should be rejected.'
);

const offlineDraft = createOfflineOnboardingRequirements(answers);
assert(offlineDraft.source === 'offline', 'Offline requirements should clearly identify their source.');
assert(!offlineDraft.userConfirmed, 'Generated requirements must await user confirmation.');
assert(validateOnboardingRequirements(offlineDraft) !== null, 'Offline requirements should satisfy the persisted schema.');
assert(
  validateOnboardingRequirements({ ...offlineDraft, unexpected: true }) === null,
  'Unknown requirements fields should be rejected.'
);
assert(
  !onboardingRequirementsMatchAnswers(
    offlineDraft,
    { ...answers, primaryGoal: 'Changed after interpretation' }
  ),
  'Requirements must match the validated source answers when persisted.'
);

console.log('Requirements interpreter tests passed.');
