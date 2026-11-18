export interface AccountDeletionActions {
  markPending: () => Promise<void>;
  purgeOutbox: () => Promise<void>;
  clearLocalCache: () => void | Promise<void>;
  deleteDays: () => Promise<void>;
  deleteSyncState: () => Promise<void>;
  deleteSettings: () => Promise<void>;
  deleteOnboarding: () => Promise<void>;
  deleteProfile: () => Promise<void>;
  deleteAuthentication: () => Promise<void>;
}

export class AccountDeletionCleanupError extends Error {
  readonly cause: unknown;
  readonly stage: string;

  constructor(cause: unknown, stage: string) {
    const message = stage === 'Firebase Authentication deletion'
      ? 'User data cleanup finished and writes remain blocked, but Firebase Authentication deletion did not complete. Reauthenticate and resume deletion.'
      : `Account deletion started and writes remain blocked, but cleanup failed during ${stage}. Resume deletion to continue.`;
    super(message);
    this.name = 'AccountDeletionCleanupError';
    this.cause = cause;
    this.stage = stage;
    Object.setPrototypeOf(this, AccountDeletionCleanupError.prototype);
  }
}

export async function completeAccountDeletion(actions: AccountDeletionActions): Promise<void> {
  await actions.markPending();
  const steps: Array<[string, () => void | Promise<void>]> = [
    ['local outbox cleanup', actions.purgeOutbox],
    ['local cache cleanup', actions.clearLocalCache],
    ['day record cleanup', actions.deleteDays],
    ['sync metadata cleanup', actions.deleteSyncState],
    ['settings cleanup', actions.deleteSettings],
    ['onboarding cleanup', actions.deleteOnboarding],
    ['profile cleanup', actions.deleteProfile],
    ['Firebase Authentication deletion', actions.deleteAuthentication],
  ];
  for (const [stage, run] of steps) {
    try {
      await run();
    } catch (error) {
      throw new AccountDeletionCleanupError(error, stage);
    }
  }
}
