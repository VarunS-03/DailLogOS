import {
  createInitialOnboardingProgress,
  shouldShowOnboarding,
} from '../src/services/accountLifecycle';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

const now = '2026-09-03T08:00:00.000Z';
const newAccount = createInitialOnboardingProgress(false, now);
assertEqual(newAccount.status, 'not_started', 'New accounts start onboarding');
assertEqual(newAccount.currentStage, 1, 'New accounts start at the first stage');

const legacyAccount = createInitialOnboardingProgress(true, now);
assertEqual(legacyAccount.status, 'completed', 'Legacy accounts are not sent through onboarding again');
assertEqual(legacyAccount.completedAt, now, 'Legacy completion is timestamped');

const baseInput = {
  authResolved: true,
  isAuthenticated: false,
  accountReady: true,
  onboardingStatus: null,
  guestOnboardingComplete: false,
  dismissed: false,
};
assertEqual(shouldShowOnboarding({ ...baseInput, authResolved: false }), false, 'Wait for auth restoration');
assertEqual(shouldShowOnboarding(baseInput), true, 'Show onboarding to a new guest');
assertEqual(
  shouldShowOnboarding({ ...baseInput, guestOnboardingComplete: true }),
  false,
  'Do not repeat completed guest onboarding'
);
assertEqual(
  shouldShowOnboarding({ ...baseInput, isAuthenticated: true, accountReady: false, onboardingStatus: 'not_started' }),
  false,
  'Wait for account initialization'
);
assertEqual(
  shouldShowOnboarding({ ...baseInput, isAuthenticated: true, onboardingStatus: 'completed' }),
  false,
  'Do not repeat completed account onboarding'
);
assertEqual(
  shouldShowOnboarding({ ...baseInput, isAuthenticated: true, onboardingStatus: 'in_progress' }),
  true,
  'Resume incomplete account onboarding'
);
assertEqual(
  shouldShowOnboarding({ ...baseInput, dismissed: true }),
  false,
  'Respect dismissal for the current app session'
);

console.log('Account lifecycle tests passed.');
