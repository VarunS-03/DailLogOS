import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
  reauthenticateWithPopup,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  getDocsFromServer,
  deleteDoc,
  Firestore,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  QueryConstraint,
  runTransaction,
} from 'firebase/firestore';
import type { AppCheck } from 'firebase/app-check';
import {
  AuthErrorInfo,
  AuthUser,
  DayRecord,
  OnboardingAnswers,
  OnboardingProgress,
  OnboardingRequirements,
  UserSystemConfiguration,
  UserSettings,
} from './types';
import { calculateCompletionPercentage, createDefaultDayRecord } from './constants/templates';
import { normalizeDayRecord, withCurrentSchemaVersion } from './utils/dayRecord';
import {
  createDayMutation,
  DayMutation,
  diffDayRecord,
  indexedDbDayOutbox,
} from './services/dayOutbox';
import {
  applyDayMutationTransaction,
  DayMutationApplyResult,
  createDayCacheRecovery,
  getRecoverableCacheOnlyDays,
  reconcileDayRecordWithMutations,
} from './services/daySync';
import {
  createSystemConfigurationFromRequirements,
  normalizeUserSettings,
  validateUserSystemConfiguration,
} from './services/systemConfiguration';
import {
  createInitialOnboardingProgress,
  CURRENT_ONBOARDING_VERSION,
  isOnboardingStatus,
  onboardingRequirementsMatchAnswers,
  validateOnboardingAnswers,
  validateOnboardingRequirements,
} from './services/accountLifecycle';
import {
  AccountDeletionCleanupError,
  completeAccountDeletion,
} from './services/accountDeletion';
import {
  appendDayHistoryPage,
  createCachedDayHistoryPage,
  DEFAULT_HISTORY_PAGE_SIZE,
  DayHistoryPage,
  DayHistoryPageOptions,
  mergeDayRecords,
  paginateDayHistory,
} from './utils/dayHistory';

// Firebase Configuration Interface
interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  recaptchaSiteKey?: string;
}

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;
let appCheckInitialization: Promise<void> = Promise.resolve();
let isConfigured = false;
const GUEST_DAY_COLLECTION_KEY = 'daily_os_guest_days_v1';

export class AppAuthError extends Error implements AuthErrorInfo {
  code: string;
  category: string;
  hostname?: string;
  actionableStep?: string;

  constructor(info: { code: string; category: string; message: string; hostname?: string; actionableStep?: string }) {
    super(info.message);
    this.name = 'AppAuthError';
    this.code = info.code;
    this.category = info.category;
    this.hostname = info.hostname;
    this.actionableStep = info.actionableStep;
    Object.setPrototypeOf(this, AppAuthError.prototype);
  }
}

export class AccountDeletionError extends Error {
  readonly deletionStarted = true;
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AccountDeletionError';
    this.cause = cause;
    Object.setPrototypeOf(this, AccountDeletionError.prototype);
  }
}

/**
 * Sanitized, privacy-preserving error handler.
 * Prevents disclosure of user reflection data, internal document paths, or tokens in logs.
 */
export function handleFirestoreError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Categorize known error patterns safely
  if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    console.warn(`[DAILY OS] Access denied during ${operation}. Authorization invariant enforced.`);
    return new Error('Access denied: You do not have permission to perform this action.');
  }
  if (message.includes('unavailable') || message.includes('network')) {
    console.warn(`[DAILY OS] Network error during ${operation}.`);
    return new Error('Network connection issue. Please check your internet connection.');
  }
  console.warn(`[DAILY OS] Database operation error during ${operation}.`);
  return new Error('Unable to complete the operation. Please try again.');
}

/**
 * Sanitized, user-friendly authentication error handler.
 * Distinguishes authentication failures from database errors and handles standard Firebase Auth codes.
 * Returns AppAuthError containing structured category and actionable instructions without exposing secrets or personal data.
 */
export function handleAuthError(error: unknown): AppAuthError {
  const errCode = (error as { code?: string })?.code || '';
  const errMessage = error instanceof Error ? error.message : String(error);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  if (import.meta.env.DEV) {
    console.warn('[DAILY OS Auth Debug]', { code: errCode, message: errMessage, hostname: currentHostname });
  }

  switch (errCode) {
    case 'auth/unauthorized-domain':
      return new AppAuthError({
        code: 'auth/unauthorized-domain',
        category: 'Unauthorized Domain',
        message: `This domain (${currentHostname || 'preview'}) is not authorized in your Firebase project.`,
        hostname: currentHostname,
        actionableStep: `Add "${currentHostname}" to Firebase Console > Authentication > Settings > Authorized domains.`,
      });

    case 'auth/popup-closed-by-user':
      return new AppAuthError({
        code: 'auth/popup-closed-by-user',
        category: 'Popup Closed',
        message: 'Sign-in cancelled. The Google authentication popup was closed before completing.',
      });

    case 'auth/popup-blocked':
      return new AppAuthError({
        code: 'auth/popup-blocked',
        category: 'Popup Blocked',
        message: 'Sign-in popup was blocked by your browser. Please allow popups for this window and try again.',
        actionableStep: 'Enable popups in your browser address bar for this page.',
      });

    case 'auth/operation-not-allowed':
      return new AppAuthError({
        code: 'auth/operation-not-allowed',
        category: 'Provider Disabled',
        message: 'Google Sign-In is not enabled in your Firebase Authentication console.',
        actionableStep: 'Go to Firebase Console > Authentication > Sign-in method, click Google, and enable it.',
      });

    case 'auth/network-request-failed':
      return new AppAuthError({
        code: 'auth/network-request-failed',
        category: 'Network Error',
        message: 'Network error during authentication. Please check your internet connection and try again.',
      });

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.':
      return new AppAuthError({
        code: 'auth/invalid-api-key',
        category: 'Invalid API Key',
        message: 'Firebase configuration error: Invalid API key. Please check your VITE_FIREBASE_API_KEY.',
      });

    case 'auth/cancelled-popup-request':
      return new AppAuthError({
        code: 'auth/cancelled-popup-request',
        category: 'Request Cancelled',
        message: 'Sign-in request cancelled because another popup request was already initiated.',
      });

    case 'auth/internal-error':
      return new AppAuthError({
        code: 'auth/internal-error',
        category: 'Internal Error',
        message: 'Firebase Authentication encountered an internal error. Please verify your Firebase project setup.',
      });

    default:
      if (errMessage.includes('configuration') || errMessage.includes('not yet configured')) {
        return new AppAuthError({
          code: 'auth/not-configured',
          category: 'Configuration Missing',
          message: errMessage,
        });
      }
      return new AppAuthError({
        code: errCode || 'auth/unknown',
        category: 'Authentication Error',
        message: 'Authentication failed. Please verify project settings or try again.',
      });
  }
}

/**
 * Strips protocol and trailing slashes from authDomain to prevent malformed OAuth handler URLs
 */
function sanitizeAuthDomain(rawDomain: string | undefined, projectId: string): string {
  if (!rawDomain) {
    return `${projectId}.firebaseapp.com`;
  }
  return rawDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Detects Firebase Configuration strictly from Vite environment variables.
 * Disallows storing secret credentials or API keys in localStorage.
 */
function detectFirebaseConfig(): FirebaseConfig | null {
  const apiKey =
    import.meta.env.VITE_FIREBASE_API_KEY ||
    (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_API_KEY);

  const projectId =
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_PROJECT_ID);

  if (apiKey && projectId) {
    const rawAuthDomain =
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_AUTH_DOMAIN);

    const authDomain = sanitizeAuthDomain(rawAuthDomain, projectId);

    const storageBucket =
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_STORAGE_BUCKET);

    const messagingSenderId =
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_MESSAGING_SENDER_ID);

    const appId =
      import.meta.env.VITE_FIREBASE_APP_ID ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_APP_ID);

    const recaptchaSiteKey =
      import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_RECAPTCHA_SITE_KEY);

    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      recaptchaSiteKey,
    };
  }
  return null;
}

const config = detectFirebaseConfig();

if (config && config.apiKey && config.projectId) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
    authInstance = getAuth(firebaseApp);
    firestoreInstance = getFirestore(firebaseApp);
    isConfigured = true;

    // Optional Firebase App Check Initialization
    if (typeof window !== 'undefined') {
      if (import.meta.env.DEV && typeof self !== 'undefined') {
        // Support debug token in local development
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      if (config.recaptchaSiteKey) {
        appCheckInitialization = import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
          appCheckInstance = initializeAppCheck(firebaseApp!, {
            provider: new ReCaptchaV3Provider(config.recaptchaSiteKey!),
            isTokenAutoRefreshEnabled: true,
          });
        }).catch((error: unknown) => {
          console.warn(
            '[DAILY OS] App Check initialization failed:',
            error instanceof Error ? error.name : 'AppCheckInitError'
          );
        });
      }
    }
  } catch (err) {
    console.warn('[DAILY OS] Firebase initialization deferred:', err instanceof Error ? err.name : 'InitError');
  }
}

export const auth = authInstance;
export const db = firestoreInstance;
export const appCheck = appCheckInstance;
export const isFirebaseConfigured = isConfigured;

export interface FirebaseAuthDiagnostics {
  isConfigured: boolean;
  projectId: string | null;
  authDomain: string | null;
  currentHostname: string;
  currentOrigin: string;
}

export function getFirebaseAuthDiagnostics(): FirebaseAuthDiagnostics {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const detected = detectFirebaseConfig();
  return {
    isConfigured,
    projectId: detected?.projectId || null,
    authDomain: detected?.authDomain || null,
    currentHostname,
    currentOrigin,
  };
}

/**
 * Google Sign-In with popup.
 * Strictly uses Firebase Authentication. Never fabricates credentials or relies on mock logins.
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  if (!authInstance) {
    const errorMsg =
      'Firebase is not yet configured with your project credentials. Please configure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in your environment (.env file).';
    if (import.meta.env.DEV) {
      console.warn('[DAILY OS]', errorMsg);
    }
    throw new Error(errorMsg);
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(authInstance, provider);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Personal User',
      photoURL: user.photoURL,
    };
  } catch (err: unknown) {
    throw handleAuthError(err);
  }
}

/**
 * Clean sign-out. Clears local device caches for the active session.
 */
export async function signOutUser(uid?: string | null): Promise<void> {
  if (authInstance) {
    await signOut(authInstance);
  }
  if (uid) clearUserLocalCache(uid);
}

/**
 * Subscribes to Firebase Authentication state changes.
 * Purely server-authoritative; rejects unauthorized client mutations.
 */
export function subscribeToAuth(
  callback: (user: AuthUser | null) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!authInstance) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(authInstance, (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      callback({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Personal User',
        photoURL: fbUser.photoURL,
      });
    } else {
      callback(null);
    }
  }, (error) => onError?.(error));
}

export interface InitializedUserAccount {
  onboarding: OnboardingProgress;
  settings: UserSettings | null;
}

function parseOnboardingProgress(value: unknown): OnboardingProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The saved onboarding status is invalid. Account initialization cannot continue.');
  }
  const data = value as Record<string, unknown>;
  const answers = data.answers === undefined ? undefined : validateOnboardingAnswers(data.answers);
  const requirements = data.requirements === undefined ? undefined : validateOnboardingRequirements(data.requirements);
  const systemConfiguration = data.systemConfiguration === undefined
    ? undefined
    : validateUserSystemConfiguration(data.systemConfiguration);
  const allowedKeys = [
    'status', 'version', 'currentStage', 'startedAt', 'completedAt', 'updatedAt',
    'answers', 'requirements', 'systemConfiguration',
  ];
  if (
    Object.keys(data).some((key) => !allowedKeys.includes(key))
    || !isOnboardingStatus(data.status)
    || typeof data.version !== 'number'
    || !Number.isInteger(data.version)
    || data.version < 1
    || data.version > 100
    || typeof data.currentStage !== 'number'
    || !Number.isInteger(data.currentStage)
    || data.currentStage < 1
    || data.currentStage > 6
    || typeof data.updatedAt !== 'string'
    || data.updatedAt.length > 64
    || (data.startedAt !== undefined && (typeof data.startedAt !== 'string' || data.startedAt.length > 64))
    || (data.completedAt !== undefined && (typeof data.completedAt !== 'string' || data.completedAt.length > 64))
    || (data.answers !== undefined && !answers)
    || (data.requirements !== undefined && (!requirements || !answers || !onboardingRequirementsMatchAnswers(requirements, answers)))
    || (data.systemConfiguration !== undefined && (!systemConfiguration || !requirements?.userConfirmed))
  ) {
    throw new Error('The saved onboarding status is invalid. Account initialization cannot continue.');
  }
  return {
    status: data.status,
    version: data.version,
    currentStage: data.currentStage,
    ...(typeof data.startedAt === 'string' ? { startedAt: data.startedAt } : {}),
    ...(typeof data.completedAt === 'string' ? { completedAt: data.completedAt } : {}),
    updatedAt: data.updatedAt,
    ...(answers ? { answers } : {}),
    ...(requirements ? { requirements } : {}),
    ...(systemConfiguration ? { systemConfiguration } : {}),
  };
}

/**
 * Initializes the authenticated account without overwriting existing profile or onboarding data.
 * Legacy accounts with a profile, settings, or day record are treated as already onboarded.
 */
export async function initializeUserAccount(user: AuthUser): Promise<InitializedUserAccount> {
  if (!firestoreInstance) {
    throw new Error('Cloud account initialization is unavailable because Firebase is not configured.');
  }
  await appCheckInitialization;

  const profileRef = doc(firestoreInstance, 'users', user.uid);
  const deletionTombstoneRef = doc(firestoreInstance, 'accountDeletionTombstones', user.uid);
  const settingsRef = doc(firestoreInstance, 'users', user.uid, 'settings', 'main');
  const onboardingRef = doc(firestoreInstance, 'users', user.uid, 'onboarding', 'main');
  const daysQuery = query(collection(firestoreInstance, 'users', user.uid, 'days'), limit(1));

  let profileSnapshot;
  let deletionTombstoneSnapshot;
  let settingsSnapshot;
  let existingDays;
  try {
    [profileSnapshot, deletionTombstoneSnapshot, settingsSnapshot, existingDays] = await Promise.all([
      getDocFromServer(profileRef),
      getDocFromServer(deletionTombstoneRef),
      getDoc(settingsRef),
      getDocs(daysQuery),
    ]);
  } catch (err) {
    throw handleFirestoreError('initializeUserAccount', err);
  }

  if (deletionTombstoneSnapshot.exists() || (profileSnapshot.exists() && profileSnapshot.data().deletionInProgress === true)) {
    throw new AccountDeletionError('Account deletion is incomplete. Resume deletion to continue.');
  }

  const hasLegacyAccountData =
    profileSnapshot.exists() || settingsSnapshot.exists() || !existingDays.empty;
  const now = new Date().toISOString();
  let onboarding: OnboardingProgress;
  try {
    onboarding = await runTransaction(firestoreInstance, async (transaction) => {
      const current = await transaction.get(onboardingRef);
      if (current.exists()) return parseOnboardingProgress(current.data());

      const initial = createInitialOnboardingProgress(hasLegacyAccountData, now);
      transaction.set(onboardingRef, initial);
      return initial;
    });

    await setDoc(
      profileRef,
      {
        uid: user.uid,
        ...(user.email ? { email: user.email } : {}),
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        ...(!profileSnapshot.exists() ? { createdAt: now } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    const cachedSettings = localStorage.getItem(`daily_os_settings_${user.uid}`);
    const pendingSettingsKey = `daily_os_settings_pending_${user.uid}`;
    if (cachedSettings && localStorage.getItem(pendingSettingsKey) === 'true') {
      const settings = normalizeUserSettings(JSON.parse(cachedSettings) as UserSettings);
      await saveUserSettings(user.uid, settings);
      return { onboarding, settings };
    }

    if (settingsSnapshot.exists()) {
      const settings = normalizeUserSettings(settingsSnapshot.data() as UserSettings);
      localStorage.setItem(`daily_os_settings_${user.uid}`, JSON.stringify(settings));
      return { onboarding, settings };
    }

    return {
      onboarding,
      settings: cachedSettings ? normalizeUserSettings(JSON.parse(cachedSettings) as UserSettings) : null,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('onboarding status is invalid')) throw err;
    throw handleFirestoreError('initializeUserAccount', err);
  }
}

export async function markOnboardingInProgress(uid: string): Promise<OnboardingProgress> {
  if (!firestoreInstance || !uid) {
    throw new Error('Cannot save onboarding progress without an authenticated Firebase account.');
  }
  const ref = doc(firestoreInstance, 'users', uid, 'onboarding', 'main');
  const now = new Date().toISOString();
  try {
    return await runTransaction(firestoreInstance, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        throw new Error('Onboarding status has not been initialized for this account.');
      }
      const current = parseOnboardingProgress(snapshot.data());
      if (current.status === 'completed') return current;
      const next: OnboardingProgress = {
        ...current,
        status: 'in_progress',
        version: CURRENT_ONBOARDING_VERSION,
        currentStage: Math.max(2, current.currentStage),
        startedAt: current.startedAt || now,
        updatedAt: now,
      };
      transaction.set(ref, next);
      return next;
    });
  } catch (err) {
    throw handleFirestoreError('markOnboardingInProgress', err);
  }
}

export async function markOnboardingCompleted(
  uid: string,
  initialDayDate: string,
  systemConfiguration: UserSystemConfiguration
): Promise<OnboardingProgress> {
  if (!firestoreInstance || !uid) {
    throw new Error('Cannot complete onboarding without an authenticated Firebase account.');
  }
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(initialDayDate)) {
    throw new Error('Cannot complete onboarding with an invalid initial day date.');
  }
  const onboardingRef = doc(firestoreInstance, 'users', uid, 'onboarding', 'main');
  const settingsRef = doc(firestoreInstance, 'users', uid, 'settings', 'main');
  const dayRef = doc(firestoreInstance, 'users', uid, 'days', initialDayDate);
  const validatedConfiguration = validateUserSystemConfiguration(systemConfiguration);
  if (!validatedConfiguration) throw new Error('Cannot complete onboarding with an invalid system configuration.');
  const now = new Date().toISOString();
  try {
    return await runTransaction(firestoreInstance, async (transaction) => {
      const [snapshot, settingsSnapshot, daySnapshot] = await Promise.all([
        transaction.get(onboardingRef),
        transaction.get(settingsRef),
        transaction.get(dayRef),
      ]);
      if (!snapshot.exists()) {
        throw new Error('Onboarding status has not been initialized for this account.');
      }
      const current = parseOnboardingProgress(snapshot.data());
      if (current.status === 'completed') return current;
      if (!current.requirements?.userConfirmed || !current.systemConfiguration) {
        throw new Error('Confirm the requirements and application configuration before completing onboarding.');
      }
      if (JSON.stringify(current.systemConfiguration) !== JSON.stringify(validatedConfiguration)) {
        throw new Error('The saved application configuration does not match the confirmed onboarding configuration.');
      }
      if (!settingsSnapshot.exists()) {
        throw new Error('The initial user settings have not been saved.');
      }
      const persistedConfiguration = validateUserSystemConfiguration(settingsSnapshot.data().systemConfiguration);
      if (!persistedConfiguration || JSON.stringify(persistedConfiguration) !== JSON.stringify(validatedConfiguration)) {
        throw new Error('The confirmed application configuration has not been saved to user settings.');
      }
      if (!daySnapshot.exists() || daySnapshot.data().date !== initialDayDate) {
        throw new Error('The initial day record has not been saved.');
      }
      const completed: OnboardingProgress = {
        ...current,
        status: 'completed',
        version: CURRENT_ONBOARDING_VERSION,
        currentStage: 6,
        startedAt: current.startedAt || now,
        completedAt: current.completedAt || now,
        updatedAt: now,
      };
      transaction.set(onboardingRef, completed);
      return completed;
    });
  } catch (err) {
    throw handleFirestoreError('markOnboardingCompleted', err);
  }
}

export async function saveOnboardingProgress(
  uid: string,
  answers: OnboardingAnswers,
  currentStage: number,
  requirements?: OnboardingRequirements | null,
  systemConfiguration?: UserSystemConfiguration
): Promise<OnboardingProgress> {
  if (!firestoreInstance || !uid) {
    throw new Error('Cannot save onboarding answers without an authenticated Firebase account.');
  }
  const validatedAnswers = validateOnboardingAnswers(answers);
  const validatedRequirements = requirements ? validateOnboardingRequirements(requirements) : null;
  const validatedConfiguration = systemConfiguration
    ? validateUserSystemConfiguration(systemConfiguration)
    : validatedRequirements?.userConfirmed
      ? createSystemConfigurationFromRequirements(validatedRequirements)
      : null;
  if (
    !validatedAnswers
    || !Number.isInteger(currentStage)
    || currentStage < 1
    || currentStage > 6
    || (requirements !== undefined && requirements !== null && !validatedRequirements)
    || (validatedRequirements && !onboardingRequirementsMatchAnswers(validatedRequirements, validatedAnswers))
    || (systemConfiguration !== undefined && systemConfiguration !== null && !validatedConfiguration)
    || (validatedConfiguration && !validatedRequirements?.userConfirmed)
  ) {
    throw new Error('The onboarding answers or current stage are invalid.');
  }
  if (validatedRequirements?.userConfirmed && !validatedConfiguration) {
    throw new Error('Confirmed onboarding requirements need a valid system configuration.');
  }
  if (
    validatedRequirements?.userConfirmed
    && JSON.stringify(validatedConfiguration) !== JSON.stringify(createSystemConfigurationFromRequirements(validatedRequirements))
  ) {
    throw new Error('The saved system configuration does not match the confirmed onboarding requirements.');
  }

  const ref = doc(firestoreInstance, 'users', uid, 'onboarding', 'main');
  const now = new Date().toISOString();
  try {
    return await runTransaction(firestoreInstance, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        throw new Error('Onboarding status has not been initialized for this account.');
      }
      const current = parseOnboardingProgress(snapshot.data());
      if (current.status === 'completed') return current;
      const answersChanged = !current.answers || JSON.stringify(current.answers) !== JSON.stringify(validatedAnswers);
      const next: OnboardingProgress = {
        ...current,
        status: 'in_progress',
        version: CURRENT_ONBOARDING_VERSION,
        currentStage: Math.max(2, currentStage),
        startedAt: current.startedAt || now,
        updatedAt: now,
        answers: validatedAnswers,
      };
      if (answersChanged) {
        delete next.requirements;
        delete next.systemConfiguration;
      }
      if (validatedRequirements) next.requirements = validatedRequirements;
      if (validatedRequirements && !validatedRequirements.userConfirmed) delete next.systemConfiguration;
      if (validatedRequirements?.userConfirmed && validatedConfiguration) next.systemConfiguration = validatedConfiguration;
      transaction.set(ref, next);
      return next;
    });
  } catch (err) {
    throw handleFirestoreError('saveOnboardingProgress', err);
  }
}

function normalizeCloudDayRecord(record: DayRecord): DayRecord {
  const normalized = normalizeDayRecord(record);
  return {
    ...normalized,
    syncRevision: typeof record.syncRevision === 'number' ? record.syncRevision : 0,
  };
}

function overlayDayOperations(
  records: Record<string, DayRecord>,
  operations: DayMutation[]
): Record<string, DayRecord> {
  const result = { ...records };
  const operationsByDate = new Map<string, DayMutation[]>();
  operations.forEach((operation) => {
    const dateOperations = operationsByDate.get(operation.date) ?? [];
    dateOperations.push(operation);
    operationsByDate.set(operation.date, dateOperations);
  });
  operationsByDate.forEach((dateOperations, date) => {
    const base = result[date] ?? dateOperations[0].baseRecord;
    result[date] = reconcileDayRecordWithMutations(base, dateOperations);
  });
  return result;
}

/**
 * Loads the server record and layers durable local operations over it.
 */
export async function loadDayRecord(
  uid: string | null,
  dateStr: string,
  settings?: UserSettings
): Promise<DayRecord> {
  // If user is authenticated, query Cloud Firestore
  if (uid && firestoreInstance) {
    try {
      const dayDocRef = doc(firestoreInstance, 'users', uid, 'days', dateStr);
      const snapshot = await getDoc(dayDocRef);
      if (snapshot.exists()) {
        const cloudRecord = normalizeCloudDayRecord(snapshot.data() as DayRecord);
        const operations = await indexedDbDayOutbox.list(uid);
        const record = reconcileDayRecordWithMutations(
          cloudRecord,
          operations.filter((operation) => operation.date === dateStr)
        );
        cacheUserDay(uid, record);
        return record;
      }
    } catch (err) {
      throw handleFirestoreError('loadDayRecord', err);
    }
  }

  const record = loadDayRecordFromStorage(uid, dateStr, settings);
  if (uid) {
    const operations = await indexedDbDayOutbox.list(uid);
    return reconcileDayRecordWithMutations(
      record,
      operations.filter((operation) => operation.date === dateStr)
    );
  }
  return record;
}

export async function loadCloudDayRecord(uid: string, dateStr: string): Promise<DayRecord | null> {
  if (!firestoreInstance || !uid) {
    throw new Error('Cloud day data is unavailable.');
  }
  try {
    const snapshot = await getDocFromServer(doc(firestoreInstance, 'users', uid, 'days', dateStr));
    if (!snapshot.exists()) return null;
    const record = normalizeCloudDayRecord(snapshot.data() as DayRecord);
    cacheUserDay(uid, record);
    return record;
  } catch (error) {
    throw handleFirestoreError('loadCloudDayRecord', error);
  }
}

export function loadDayRecordFromStorage(
  uid: string | null,
  dateStr: string,
  settings?: UserSettings
): DayRecord {
  const cached = uid ? getUserCachedDay(uid, dateStr) : getGuestCachedDay(dateStr);
  return cached ? normalizeDayRecord(cached) : createDefaultDayRecord(dateStr, settings);
}

/**
 * Durably queues the changed fields before updating the local cache.
 */
export async function queueDayRecordUpdate(
  uid: string | null,
  baseRecord: DayRecord,
  updatedRecord: DayRecord
): Promise<void> {
  if (!uid) {
    cacheGuestDay(updatedRecord);
    return;
  }

  if (baseRecord.date !== updatedRecord.date) {
    throw new Error('A day change cannot move data between dates.');
  }
  const patch = diffDayRecord(baseRecord, updatedRecord);
  if (Object.keys(patch).length === 0) return;

  const operation = createDayMutation(uid, baseRecord, patch);
  await indexedDbDayOutbox.enqueue(operation);
  const cachedRecord = getUserCachedDay(uid, baseRecord.date) ?? baseRecord;
  const localRecord = {
    ...cachedRecord,
    ...patch,
    completionPercentage: calculateCompletionPercentage({ ...cachedRecord, ...patch }),
    updatedAt: updatedRecord.updatedAt,
  };
  cacheUserDay(uid, withCurrentSchemaVersion(localRecord));
}

export async function queueDayRecordUpdates(
  uid: string,
  updates: Array<{ baseRecord: DayRecord; updatedRecord: DayRecord }>
): Promise<void> {
  const operations = updates.flatMap(({ baseRecord, updatedRecord }) => {
    if (baseRecord.date !== updatedRecord.date) {
      throw new Error('A day change cannot move data between dates.');
    }
    const patch = diffDayRecord(baseRecord, updatedRecord);
    return Object.keys(patch).length > 0
      ? [{ baseRecord, updatedRecord, patch, operation: createDayMutation(uid, baseRecord, patch) }]
      : [];
  });
  await indexedDbDayOutbox.enqueueMany(operations.map(({ operation }) => operation));
  operations.forEach(({ baseRecord, updatedRecord, patch }) => {
    const cachedRecord = getUserCachedDay(uid, baseRecord.date) ?? baseRecord;
    const localRecord = {
      ...cachedRecord,
      ...patch,
      completionPercentage: calculateCompletionPercentage({ ...cachedRecord, ...patch }),
      updatedAt: updatedRecord.updatedAt,
    };
    cacheUserDay(uid, withCurrentSchemaVersion(localRecord));
  });
}

export function replaceGuestDayRecords(records: Record<string, DayRecord>): void {
  const serialized = JSON.stringify(records);
  localStorage.setItem(GUEST_DAY_COLLECTION_KEY, serialized);

  const legacyKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('daily_os_guest_day_')) legacyKeys.push(key);
  }
  try {
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Legacy guest day cache cleanup was incomplete after replacement.', error);
  }
}

export async function queueImportedDayRecord(
  uid: string | null,
  baseRecord: DayRecord,
  importedRecord: DayRecord
): Promise<void> {
  await queueDayRecordUpdate(uid, baseRecord, importedRecord);
}

export async function syncDayMutation(operation: DayMutation): Promise<DayMutationApplyResult> {
  if (!authInstance || authInstance.currentUser?.uid !== operation.uid) {
    const error = new Error('The active account does not match the queued day change.');
    Object.assign(error, { code: 'permission-denied' });
    throw error;
  }
  if (!firestoreInstance) {
    const error = new Error('Firestore is unavailable.');
    Object.assign(error, { code: 'unavailable' });
    throw error;
  }
  const result = await applyDayMutationTransaction(firestoreInstance, operation);
  cacheUserDay(operation.uid, result.record);
  return result;
}

/**
 * Real-time snapshot listener for the active DayRecord.
 */
export function subscribeToDayRecord(
  uid: string,
  dateStr: string,
  callback: (record: DayRecord | null) => void
): () => void {
  if (!firestoreInstance || !uid) return () => {};

  try {
    const dayDocRef = doc(firestoreInstance, 'users', uid, 'days', dateStr);
    const unsubscribe = onSnapshot(
      dayDocRef,
      (docSnap) => {
        const isCacheSnapshot = docSnap.metadata.fromCache;
        if (docSnap.exists()) {
          const record = normalizeCloudDayRecord(docSnap.data() as DayRecord);
          cacheUserDay(uid, record);
          callback(record);
        } else {
          if (!isCacheSnapshot) callback(null);
        }
      },
      (err) => {
        handleFirestoreError('subscribeToDayRecord', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError('setupSnapshotListener', err);
    return () => {};
  }
}

export async function handleMissingCloudDay(uid: string, date: string): Promise<DayRecord | null> {
  const cachedRecord = getUserCachedDay(uid, date);
  const operations = (await indexedDbDayOutbox.list(uid)).filter((operation) => operation.date === date);

  for (const operation of operations) {
    if (operation.baseKnownOnCloud === false || operation.status === 'recovery') {
      continue;
    }
    await indexedDbDayOutbox.update(operation.id, {
      status: 'recovery',
      conflicts: undefined,
      conflictRecord: undefined,
      remoteDeleted: true,
      lastError: 'remote-day-deleted',
      lockOwner: undefined,
      lockExpiresAt: undefined,
      nextAttemptAt: 0,
    });
  }

  if (operations.length === 0 && cachedRecord) {
    await indexedDbDayOutbox.enqueue(createDayCacheRecovery(uid, cachedRecord));
  } else if (!cachedRecord && operations.length === 0) {
    removeUserCachedDay(uid, date);
  }

  return cachedRecord;
}

/**
 * Loads all daily records for the authenticated user using bounded Firestore pages.
 */
export async function loadAllDays(uid: string, dayLimit = 180): Promise<Record<string, DayRecord>> {
  if (!Number.isInteger(dayLimit) || dayLimit < 1 || dayLimit > 500) {
    throw new Error('The history page size must be between 1 and 500.');
  }
  const result: Record<string, DayRecord> = {};

  if (!firestoreInstance) {
    const cachedDays = getAllUserCachedDays(uid);
    return overlayDayOperations(cachedDays, await indexedDbDayOutbox.list(uid));
  }

  const cachedDays = getAllUserCachedDays(uid);
  try {
    const daysColRef = collection(firestoreInstance, 'users', uid, 'days');
    let page = await getDocsFromServer(query(daysColRef, orderBy('date', 'desc'), limit(dayLimit)));
    while (!page.empty) {
      page.forEach((docSnap) => {
        const record = normalizeCloudDayRecord(docSnap.data() as DayRecord);
        result[docSnap.id] = record;
      });
      if (page.size < dayLimit) break;
      const lastDocument = page.docs[page.docs.length - 1];
      page = await getDocsFromServer(query(daysColRef, orderBy('date', 'desc'), startAfter(lastDocument), limit(dayLimit)));
    }
    const merged: Record<string, DayRecord> = { ...cachedDays, ...result };
    const queuedDates = new Set((await indexedDbDayOutbox.list(uid)).map((operation) => operation.date));
    for (const { record } of getRecoverableCacheOnlyDays(cachedDays, result, queuedDates)) {
      await indexedDbDayOutbox.enqueue(createDayCacheRecovery(uid, record));
    }
    const operations = await indexedDbDayOutbox.list(uid);
    const recovered = overlayDayOperations(merged, operations);
    Object.values(recovered).forEach((record) => cacheUserDay(uid, record));
    return recovered;
  } catch (err) {
    const code = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
      ? err.code.split('/').pop()
      : '';
    if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
      return overlayDayOperations(cachedDays, await indexedDbDayOutbox.list(uid));
    }
    throw handleFirestoreError('loadAllDays', err);
  }
}

/** Loads one bounded history page. A cache result is explicitly marked incomplete. */
export async function loadDayHistoryPage(
  uid: string,
  options: DayHistoryPageOptions & { localBeforeDate?: string | null } = {},
): Promise<DayHistoryPage> {
  const pageSize = options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('The history page size must be between 1 and 500.');
  }
  if (!uid) throw new Error('Authentication is required to load cloud history.');

  const cachedDays = getAllUserCachedDays(uid);
  const pendingOperations = await indexedDbDayOutbox.list(uid);
  const readCachePage = (): DayHistoryPage => {
    const localRecords = overlayDayOperations(cachedDays, pendingOperations);
    return createCachedDayHistoryPage(localRecords, {
      pageSize,
      beforeDate: options.beforeDate,
      localCursor: options.localBeforeDate,
      cloudCursor: options.beforeDate,
      fromDate: options.fromDate,
      throughDate: options.throughDate,
    });
  };

  if (!firestoreInstance) return readCachePage();

  try {
    const daysCollection = collection(firestoreInstance, 'users', uid, 'days');
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
    if (options.beforeDate) constraints.push(startAfter(options.beforeDate));
    if (options.fromDate) constraints.push(where('date', '>=', options.fromDate));
    if (options.throughDate) constraints.push(where('date', '<=', options.throughDate));
    constraints.push(limit(pageSize));
    const snapshot = await getDocsFromServer(query(daysCollection, ...constraints));
    const cloudRecords: Record<string, DayRecord> = {};
    snapshot.forEach((document) => {
      cloudRecords[document.id] = normalizeCloudDayRecord(document.data() as DayRecord);
    });

    const oldestCloudDate = snapshot.docs[snapshot.docs.length - 1]?.id;
    const cachePage = Object.fromEntries(
      Object.entries(cachedDays).filter(([date]) =>
        (!options.beforeDate || date < options.beforeDate) &&
        (snapshot.size < pageSize || !oldestCloudDate || date >= oldestCloudDate) &&
        (!options.fromDate || date >= options.fromDate) &&
        (!options.throughDate || date <= options.throughDate),
      ),
    );
    const pageDates = new Set(Object.keys(cachePage));
    const operationsInPage = pendingOperations.filter((operation) =>
      (!options.beforeDate || operation.date < options.beforeDate) &&
      (snapshot.size < pageSize || !oldestCloudDate || operation.date >= oldestCloudDate) &&
      (!options.fromDate || operation.date >= options.fromDate) &&
      (!options.throughDate || operation.date <= options.throughDate),
    );
    const queuedDates = new Set(operationsInPage.map((operation) => operation.date));
    operationsInPage.forEach((operation) => pageDates.add(operation.date));
    for (const { record } of getRecoverableCacheOnlyDays(cachePage, cloudRecords, queuedDates)) {
      await indexedDbDayOutbox.enqueue(createDayCacheRecovery(uid, record));
      pageDates.add(record.date);
    }

    const operationsAfterRecovery = (await indexedDbDayOutbox.list(uid))
      .filter((operation) => pageDates.has(operation.date));
    const combined = mergeDayRecords(cachePage, cloudRecords);
    const records = overlayDayOperations(combined, operationsAfterRecovery);
    Object.values(records).forEach((record) => cacheUserDay(uid, record));
    const complete = snapshot.size < pageSize;
    const nextCursor = complete ? null : snapshot.docs[snapshot.docs.length - 1]?.id ?? null;
    return {
      records,
      nextCursor,
      nextLocalCursor: null,
      hasMore: !complete,
      complete,
      source: 'firestore',
    };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code.split('/').pop()
      : '';
    if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
      return readCachePage();
    }
    throw handleFirestoreError('loadDayHistoryPage', error);
  }
}

/**
 * Loads user settings from /users/{uid}/settings/main.
 */
export async function loadUserSettings(uid: string): Promise<UserSettings | null> {
  if (firestoreInstance && uid) {
    try {
      const settingsDocRef = doc(firestoreInstance, 'users', uid, 'settings', 'main');
      const snap = await getDoc(settingsDocRef);
      if (snap.exists()) {
        const settings = normalizeUserSettings(snap.data() as UserSettings);
        localStorage.setItem(`daily_os_settings_${uid}`, JSON.stringify(settings));
        return settings;
      }
    } catch (err) {
      throw handleFirestoreError('loadUserSettings', err);
    }
  }

  const local = localStorage.getItem(`daily_os_settings_${uid}`);
  if (local) {
    let settings: UserSettings;
    try {
      settings = JSON.parse(local) as UserSettings;
    } catch {
      return null;
    }
    return normalizeUserSettings(settings);
  }
  return null;
}

/**
 * Saves user settings strictly to /users/{uid}/settings/main.
 */
export async function saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
  if (!uid) {
    throw new Error('Authentication required to save settings.');
  }
  settings = normalizeUserSettings(settings);

  localStorage.setItem(`daily_os_settings_${uid}`, JSON.stringify(settings));

  if (firestoreInstance) {
    const pendingKey = `daily_os_settings_pending_${uid}`;
    try {
      const settingsDocRef = doc(firestoreInstance, 'users', uid, 'settings', 'main');
      await setDoc(settingsDocRef, settings, { merge: true });
      localStorage.removeItem(pendingKey);
    } catch (err) {
      localStorage.setItem(pendingKey, 'true');
      throw handleFirestoreError('saveUserSettings', err);
    }
  }
}

export async function retryPendingUserSettings(uid: string): Promise<void> {
  if (!uid) throw new Error('Authentication is required to retry settings persistence.');
  const pendingKey = `daily_os_settings_pending_${uid}`;
  if (localStorage.getItem(pendingKey) !== 'true') return;
  if (firestoreInstance) {
    const accountSnapshot = await getDocFromServer(doc(firestoreInstance, 'users', uid));
    if (accountSnapshot.exists() && accountSnapshot.data().deletionInProgress === true) return;
  }
  const cached = localStorage.getItem(`daily_os_settings_${uid}`);
  if (!cached) throw new Error('Pending settings data is missing from this device and cannot be restored.');
  let settings: UserSettings;
  try {
    settings = JSON.parse(cached) as UserSettings;
  } catch {
    throw new Error('Pending settings data is invalid and cannot be restored.');
  }
  await saveUserSettings(uid, normalizeUserSettings(settings));
}

export async function reauthenticateForAccountDeletion(uid: string): Promise<void> {
  const activeUser = authInstance?.currentUser;
  if (!activeUser || activeUser.uid !== uid) {
    throw new Error('Sign in to the account you want to delete before continuing.');
  }
  await reauthenticateWithPopup(activeUser, new GoogleAuthProvider());
}

/**
 * Permanently deletes all personal tracker documents and clears all cached data.
 */
export async function deleteUserAccountAndData(uid: string): Promise<void> {
  if (!uid) return;
  const activeUser = authInstance?.currentUser;
  const database = firestoreInstance;
  if (!database || !activeUser || activeUser.uid !== uid) {
    throw new Error('Sign in to the account you want to delete before continuing.');
  }

  const userDocRef = doc(database, 'users', uid);
  const deletionTombstoneRef = doc(database, 'accountDeletionTombstones', uid);
  try {
    await completeAccountDeletion({
      markPending: async () => {
        try {
          const tombstoneSnapshot = await getDocFromServer(deletionTombstoneRef);
          if (!tombstoneSnapshot.exists()) {
            await setDoc(deletionTombstoneRef, {
              status: 'pending',
              startedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          throw handleFirestoreError('startAccountDeletion', error);
        }
      },
      purgeOutbox: () => indexedDbDayOutbox.removeForUid(uid),
      clearLocalCache: () => clearUserLocalCache(uid),
      deleteDays: async () => {
        const daysColRef = collection(database, 'users', uid, 'days');
        let remainingDays = await getDocsFromServer(query(daysColRef, limit(250)));
        while (!remainingDays.empty) {
          await Promise.all(remainingDays.docs.map((daySnapshot) => deleteDoc(daySnapshot.ref)));
          remainingDays = await getDocsFromServer(query(daysColRef, limit(250)));
        }
      },
      deleteSyncState: async () => {
        const syncStateColRef = collection(database, 'users', uid, 'daySyncState');
        let remainingSyncState = await getDocsFromServer(query(syncStateColRef, limit(250)));
        while (!remainingSyncState.empty) {
          await Promise.all(remainingSyncState.docs.map((stateSnapshot) => deleteDoc(stateSnapshot.ref)));
          remainingSyncState = await getDocsFromServer(query(syncStateColRef, limit(250)));
        }
      },
      deleteSettings: () => deleteDoc(doc(database, 'users', uid, 'settings', 'main')),
      deleteOnboarding: () => deleteDoc(doc(database, 'users', uid, 'onboarding', 'main')),
      deleteProfile: async () => {
        const profileSnapshot = await getDocFromServer(userDocRef);
        if (profileSnapshot.exists()) await deleteDoc(userDocRef);
      },
      deleteAuthentication: async () => {
        try {
          await deleteUser(activeUser);
        } catch (error) {
          if (
            typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === 'auth/requires-recent-login'
          ) {
            await reauthenticateWithPopup(activeUser, new GoogleAuthProvider());
            await deleteUser(activeUser);
            return;
          }
          throw error;
        }
      },
    });
  } catch (error) {
    if (error instanceof AccountDeletionCleanupError) {
      throw new AccountDeletionError(error.message, error.cause);
    }
    throw error;
  }
}

export const deleteUserData = deleteUserAccountAndData;

// =============================================================================
// USER-SCOPED CACHE MANAGEMENT (Privacy Preserving)
// =============================================================================

function cacheUserDay(uid: string, day: DayRecord): void {
  try {
    localStorage.setItem(`daily_os_day_${uid}_${day.date}`, JSON.stringify(day));
  } catch {
    // Quota exceeded or private browsing restrictions
  }
}

function getUserCachedDay(uid: string, dateStr: string): DayRecord | null {
  try {
    const val = localStorage.getItem(`daily_os_day_${uid}_${dateStr}`);
    return val ? (JSON.parse(val) as DayRecord) : null;
  } catch {
    return null;
  }
}

function cacheGuestDay(day: DayRecord): void {
  const cachedCollection = readGuestDayCollection();
  if (cachedCollection) {
    localStorage.setItem(
      GUEST_DAY_COLLECTION_KEY,
      JSON.stringify({ ...cachedCollection, [day.date]: day })
    );
    return;
  }
  localStorage.setItem(`daily_os_guest_day_${day.date}`, JSON.stringify(day));
}

function getGuestCachedDay(dateStr: string): DayRecord | null {
  const collectionCache = readGuestDayCollection();
  if (collectionCache) return collectionCache[dateStr] ?? null;
  try {
    const value = localStorage.getItem(`daily_os_guest_day_${dateStr}`);
    return value ? JSON.parse(value) as DayRecord : null;
  } catch {
    return null;
  }
}

function getAllGuestCachedDays(): Record<string, DayRecord> {
  const collectionCache = readGuestDayCollection();
  if (collectionCache) {
    return Object.fromEntries(
      Object.entries(collectionCache).map(([date, record]) => [date, normalizeDayRecord(record)])
    );
  }
  const result: Record<string, DayRecord> = {};
  const prefix = 'daily_os_guest_day_';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const date = key.slice(prefix.length);
    try {
      const value = localStorage.getItem(key);
      if (value) result[date] = normalizeDayRecord(JSON.parse(value) as DayRecord);
    } catch {
      // Ignore an unreadable local guest cache entry.
    }
  }
  return result;
}

function readGuestDayCollection(): Record<string, DayRecord> | null {
  const serialized = localStorage.getItem(GUEST_DAY_COLLECTION_KEY);
  if (serialized === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('The saved guest day collection is invalid and could not be restored.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The saved guest day collection has an invalid structure.');
  }
  return value as Record<string, DayRecord>;
}

export function getAllUserCachedDays(uid: string): Record<string, DayRecord> {
  const result: Record<string, DayRecord> = {};
  const prefix = `daily_os_day_${uid}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const dateStr = key.replace(prefix, '');
      try {
        const val = localStorage.getItem(key);
        if (val) {
          result[dateStr] = normalizeDayRecord(JSON.parse(val) as DayRecord);
        }
      } catch {
        // ignore
      }
    }
  }
  return result;
}

export function clearUserLocalCache(uid: string): void {
  const prefix = `daily_os_day_${uid}_`;
  const settingsKey = `daily_os_settings_${uid}`;
  const pendingSettingsKey = `daily_os_settings_pending_${uid}`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(prefix) || key === settingsKey || key === pendingSettingsKey)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

export function removeUserCachedDay(uid: string, date: string): void {
  localStorage.removeItem(`daily_os_day_${uid}_${date}`);
}

/**
 * Loads all day records from local storage for initial fast hydration.
 * If a user id is specified, reads from that user's isolated cache prefix.
 */
export function loadAllDaysFromStorage(uid?: string | null): Record<string, DayRecord> {
  return uid ? getAllUserCachedDays(uid) : getAllGuestCachedDays();
}
