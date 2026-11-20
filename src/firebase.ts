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
  writeBatch,
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
  recaptchaEnterpriseSiteKey?: string;
}

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;
let appCheckInitialization: Promise<void> = Promise.resolve();
let isConfigured = false;
const GUEST_DAY_COLLECTION_KEY = 'daily_os_guest_days_v1';
interface RuntimeViteEnv {
  DEV?: boolean;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
}
const viteEnv: RuntimeViteEnv = (import.meta as unknown as { env?: RuntimeViteEnv }).env ?? {};

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

export type RestorePhase = 'auth_state' | 'account_reads' | 'onboarding_transaction' | 'profile_write' | 'history_cloud' | 'outbox_open' | 'outbox_read' | 'account_integrity';
export type RestoreErrorCategory = 'permission-denied' | 'unauthenticated' | 'unavailable' | 'failed-precondition' | 'storage-unavailable' | 'data-invalid' | 'deletion-pending' | 'unknown';

export class AccountRestoreError extends Error {
  readonly phase: RestorePhase;
  readonly category: RestoreErrorCategory;
  readonly cause: unknown;

  constructor(phase: RestorePhase, category: RestoreErrorCategory, message: string, cause?: unknown) {
    super(message);
    this.name = 'AccountRestoreError';
    this.phase = phase;
    this.category = category;
    this.cause = cause;
  }
}

function safeErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code.split('/').pop()?.toLowerCase() ?? '' : '';
}

export function classifyRestoreError(error: unknown): RestoreErrorCategory {
  if (error instanceof AccountRestoreError) return error.category;
  if (error instanceof AccountDeletionError) return 'deletion-pending';
  const code = safeErrorCode(error);
  if (code === 'permission-denied') return 'permission-denied';
  if (code === 'unauthenticated') return 'unauthenticated';
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') return 'unavailable';
  if (code === 'failed-precondition') return 'failed-precondition';
  if (code === 'invalid-argument' || code === 'data-loss') return 'data-invalid';
  if (error instanceof Error && /saved .* invalid|invalid .* (configuration|settings|profile|onboarding)/i.test(error.message)) return 'data-invalid';
  if (error instanceof Error && /indexeddb|outbox|storage/i.test(error.message)) return 'storage-unavailable';
  return 'unknown';
}

export function logRestoreFailure(phase: RestorePhase, error: unknown): void {
  try {
    const category = classifyRestoreError(error);
    const code = safeErrorCode(error);
    console.warn('[DAILY OS] Account restore step failed.', {
      phase,
      category,
      ...(code ? { code } : {}),
    });
  } catch {
    // Diagnostics must never prevent restoration or error handling.
  }
}

/**
 * Sanitized, privacy-preserving error handler.
 * Prevents disclosure of user reflection data, internal document paths, or tokens in logs.
 */
export function handleFirestoreError(operation: string, error: unknown): Error {
  const category = classifyRestoreError(error);
  const phase: RestorePhase = operation.includes('initializeUserAccount')
    ? 'account_reads'
    : operation.includes('loadDayHistory') ? 'history_cloud' : 'account_reads';
  logRestoreFailure(phase, error);
  const message = category === 'permission-denied'
    ? 'Cloud access was denied. Check the account permissions and try again.'
    : category === 'unauthenticated'
      ? 'Your sign-in expired. Sign in again to restore account data.'
      : category === 'unavailable'
        ? 'Cloud data is temporarily unavailable. Check your connection and retry.'
        : 'Cloud data could not be loaded. Retry to continue.';
  return new AccountRestoreError(phase, category, message, error);
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

  if (viteEnv.DEV) {
    console.warn('[DAILY OS Auth Debug]', { code: errCode, hostname: currentHostname });
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
    viteEnv.VITE_FIREBASE_API_KEY ||
    (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_API_KEY);

  const projectId =
    viteEnv.VITE_FIREBASE_PROJECT_ID ||
    (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_PROJECT_ID);

  if (apiKey && projectId) {
    const rawAuthDomain =
      viteEnv.VITE_FIREBASE_AUTH_DOMAIN ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_AUTH_DOMAIN);

    const authDomain = sanitizeAuthDomain(rawAuthDomain, projectId);

    const storageBucket =
      viteEnv.VITE_FIREBASE_STORAGE_BUCKET ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_STORAGE_BUCKET);

    const messagingSenderId =
      viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_MESSAGING_SENDER_ID);

    const appId =
      viteEnv.VITE_FIREBASE_APP_ID ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_APP_ID);

    const recaptchaEnterpriseSiteKey =
      viteEnv.VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY ||
      (typeof window !== 'undefined' && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY);

    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      recaptchaEnterpriseSiteKey,
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
      if (viteEnv.DEV && typeof self !== 'undefined') {
        // Support debug token in local development
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      if (config.recaptchaEnterpriseSiteKey || viteEnv.DEV) {
        appCheckInitialization = import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
          appCheckInstance = initializeAppCheck(firebaseApp!, {
            // Debug mode intercepts provider requests in development, so a site key
            // is only required for production attestation.
            provider: new ReCaptchaEnterpriseProvider(config.recaptchaEnterpriseSiteKey || 'debug-only-site-key'),
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

/** Returns the configured Firebase app only after App Check initialization settles. */
export async function getFirebaseAiApp(): Promise<FirebaseApp> {
  if (!firebaseApp || !isConfigured) {
    throw new Error('Firebase is not configured for Firebase AI Logic.');
  }
  await appCheckInitialization;
  if (!appCheckInstance) {
    throw new Error('Firebase AI Logic requires App Check. Configure the reCAPTCHA Enterprise site key and App Check in Firebase.');
  }
  return firebaseApp;
}
export const isFirebaseConfigured = isConfigured;

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

function coachChatMessagesCollection(uid: string) {
  if (!firestoreInstance || !authInstance?.currentUser || authInstance.currentUser.uid !== uid) {
    throw new Error('Sign in to your own account to access Coach Chat history.');
  }
  return collection(firestoreInstance, 'users', uid, 'coachChats', 'main', 'messages');
}

export async function loadCoachChatHistory(uid: string): Promise<CoachChatMessage[]> {
  const messages = coachChatMessagesCollection(uid);
  const snapshot = await getDocs(query(messages, orderBy('sequence', 'desc'), limit(40)));
  return snapshot.docs.map((message) => {
    const data = message.data();
    return {
      id: message.id,
      role: data.role as CoachChatMessage['role'],
      text: data.text as string,
      createdAt: data.sequence as number,
    };
  }).reverse();
}

export async function saveCoachChatMessages(uid: string, messages: CoachChatMessage[]): Promise<void> {
  if (messages.length < 1 || messages.length > 2) throw new Error('Coach Chat saves one user and one assistant message at a time.');
  const collectionRef = coachChatMessagesCollection(uid);
  const batch = writeBatch(firestoreInstance!);
  for (const message of messages) {
    if (!['user', 'assistant'].includes(message.role) || !message.text.trim() || message.text.length > 4_000) {
      throw new Error('Coach Chat message is invalid or too long.');
    }
    batch.set(doc(collectionRef, message.id), {
      role: message.role,
      text: message.text,
      sequence: message.createdAt,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function clearCoachChatHistory(uid: string): Promise<void> {
  const messages = coachChatMessagesCollection(uid);
  let page = await getDocs(query(messages, limit(200)));
  while (!page.empty) {
    const batch = writeBatch(firestoreInstance!);
    page.docs.forEach((message) => batch.delete(message.ref));
    await batch.commit();
    page = await getDocs(query(messages, limit(200)));
  }
}

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
    if (viteEnv.DEV) {
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

function isValidStoredProfile(value: unknown, uid: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const allowedKeys = ['uid', 'email', 'displayName', 'photoURL', 'createdAt', 'updatedAt'];
  return Object.keys(profile).every((key) => allowedKeys.includes(key))
    && (profile.uid === undefined || profile.uid === uid)
    && (profile.email === undefined || (typeof profile.email === 'string' && profile.email.length <= 256))
    && (profile.displayName === undefined || (typeof profile.displayName === 'string' && profile.displayName.length <= 128))
    && (profile.photoURL === undefined || (typeof profile.photoURL === 'string' && profile.photoURL.length <= 1024))
    && (profile.createdAt === undefined || (typeof profile.createdAt === 'string' && profile.createdAt.length <= 64))
    && (profile.updatedAt === undefined || (typeof profile.updatedAt === 'string' && profile.updatedAt.length <= 64));
}

function parseRestoredSettings(value: unknown): UserSettings {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as UserSettings : value as UserSettings;
    return normalizeUserSettings(parsed);
  } catch (error) {
    throw new AccountRestoreError(
      'account_integrity',
      'data-invalid',
      'Saved account settings are invalid and need attention before this account can be restored.',
      error
    );
  }
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
  return initializeUserAccountForDatabase(user, firestoreInstance);
}

/** Production initialization workflow with an explicit Firestore instance for emulator coverage. */
export async function initializeUserAccountForDatabase(
  user: AuthUser,
  database: Firestore
): Promise<InitializedUserAccount> {
  const profileRef = doc(database, 'users', user.uid);
  const deletionTombstoneRef = doc(database, 'accountDeletionTombstones', user.uid);
  const settingsRef = doc(database, 'users', user.uid, 'settings', 'main');
  const onboardingRef = doc(database, 'users', user.uid, 'onboarding', 'main');
  const daysQuery = query(collection(database, 'users', user.uid, 'days'), limit(1));

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
    const category = classifyRestoreError(err);
    logRestoreFailure('account_reads', err);
    throw new AccountRestoreError('account_reads', category, category === 'permission-denied'
      ? 'Cloud access was denied while checking this account.'
      : category === 'unavailable'
        ? 'Cloud account data is temporarily unavailable. Check your connection and retry.'
        : 'Account data could not be checked. Retry to continue.', err);
  }

  if (deletionTombstoneSnapshot.exists() || (profileSnapshot.exists() && profileSnapshot.data().deletionInProgress === true)) {
    throw new AccountDeletionError('Account deletion is incomplete. Resume deletion to continue.');
  }
  if (profileSnapshot.exists() && !isValidStoredProfile(profileSnapshot.data(), user.uid)) {
    const error = new AccountRestoreError(
      'account_integrity',
      'data-invalid',
      'Saved account profile data is invalid and needs attention before this account can be restored.'
    );
    logRestoreFailure('account_integrity', error);
    throw error;
  }

  let cachedSettingsRaw: string | null = null;
  let pendingSettings = false;
  try {
    if (typeof localStorage !== 'undefined') {
      cachedSettingsRaw = localStorage.getItem(`daily_os_settings_${user.uid}`);
      pendingSettings = localStorage.getItem(`daily_os_settings_pending_${user.uid}`) === 'true';
    }
  } catch (error) {
    logRestoreFailure('account_integrity', error);
  }
  const cachedSettings = cachedSettingsRaw ? parseRestoredSettings(cachedSettingsRaw) : null;
  const cloudSettings = settingsSnapshot.exists() ? parseRestoredSettings(settingsSnapshot.data()) : null;

  const hasLegacyAccountData =
    profileSnapshot.exists() || settingsSnapshot.exists() || !existingDays.empty;
  const now = new Date().toISOString();
  let onboarding: OnboardingProgress;
  try {
    onboarding = await runTransaction(database, async (transaction) => {
      const current = await transaction.get(onboardingRef);
      if (current.exists()) return parseOnboardingProgress(current.data());

      const initial = createInitialOnboardingProgress(hasLegacyAccountData, now);
      transaction.set(onboardingRef, initial);
      return initial;
    });

  } catch (err) {
    const invalidData = err instanceof Error && err.message.includes('onboarding status is invalid');
    const category = invalidData ? 'data-invalid' : classifyRestoreError(err);
    logRestoreFailure(invalidData ? 'account_integrity' : 'onboarding_transaction', err);
    throw new AccountRestoreError(
      invalidData ? 'account_integrity' : 'onboarding_transaction',
      category,
      invalidData
        ? 'Saved onboarding data is invalid and needs attention before this account can be restored.'
        : category === 'permission-denied'
          ? 'Cloud access was denied while initializing onboarding.'
          : 'Onboarding could not be initialized. Retry to continue.',
      err
    );
  }

  try {
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

    if (cachedSettings && pendingSettings) {
      await saveUserSettings(user.uid, cachedSettings);
      return { onboarding, settings: cachedSettings };
    }

    if (cloudSettings) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(`daily_os_settings_${user.uid}`, JSON.stringify(cloudSettings));
      return { onboarding, settings: cloudSettings };
    }

    return {
      onboarding,
      settings: cachedSettings,
    };
  } catch (err) {
    if (err instanceof AccountRestoreError) throw err;
    const category = classifyRestoreError(err);
    logRestoreFailure('profile_write', err);
    throw new AccountRestoreError('profile_write', category, category === 'permission-denied'
      ? 'Cloud access was denied while saving the account profile.'
      : 'The account profile could not be saved. Retry to continue.', err);
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
    let cloudRecord: DayRecord | null = null;
    try {
      const dayDocRef = doc(firestoreInstance, 'users', uid, 'days', dateStr);
      const snapshot = await getDoc(dayDocRef);
      if (snapshot.exists()) {
        cloudRecord = normalizeCloudDayRecord(snapshot.data() as DayRecord);
      }
    } catch (err) {
      throw handleFirestoreError('loadDayRecord', err);
    }
    if (cloudRecord) {
      try {
        const operations = await indexedDbDayOutbox.list(uid);
        const record = reconcileDayRecordWithMutations(
          cloudRecord,
          operations.filter((operation) => operation.date === dateStr)
        );
        cacheUserDay(uid, record);
        return record;
      } catch (error) {
        logRestoreFailure('outbox_read', error);
        // Do not overwrite local cache when pending edits cannot be inspected.
        return cloudRecord;
      }
    }
  }

  const record = loadDayRecordFromStorage(uid, dateStr, settings);
  if (uid) {
    try {
      const operations = await indexedDbDayOutbox.list(uid);
      return reconcileDayRecordWithMutations(
        record,
        operations.filter((operation) => operation.date === dateStr)
      );
    } catch (error) {
      logRestoreFailure('outbox_read', error);
      return record;
    }
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
  let pendingOperations: DayMutation[] | null = null;
  try {
    pendingOperations = await indexedDbDayOutbox.list(uid);
  } catch (error) {
    logRestoreFailure('outbox_read', error);
  }
  const readCachePage = (): DayHistoryPage => {
    const localRecords = pendingOperations
      ? overlayDayOperations(cachedDays, pendingOperations)
      : cachedDays;
    return {
      ...createCachedDayHistoryPage(localRecords, {
        pageSize,
        beforeDate: options.beforeDate,
        localCursor: options.localBeforeDate,
        cloudCursor: options.beforeDate,
        fromDate: options.fromDate,
        throughDate: options.throughDate,
      }),
      outboxAvailable: pendingOperations !== null,
    };
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

    if (!pendingOperations) {
      // Without the outbox, queued edits and recovery decisions are unknown.
      // Show cloud history but do not enqueue recovery writes or replace cache.
      const records = mergeDayRecords(cachedDays, cloudRecords);
      const complete = snapshot.size < pageSize;
      return {
        records,
        nextCursor: complete ? null : snapshot.docs[snapshot.docs.length - 1]?.id ?? null,
        nextLocalCursor: null,
        hasMore: !complete,
        complete,
        source: 'firestore',
        outboxAvailable: false,
      };
    }

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
      deleteCoachChat: async () => {
        const chatMessages = collection(database, 'users', uid, 'coachChats', 'main', 'messages');
        let remainingMessages = await getDocsFromServer(query(chatMessages, limit(200)));
        while (!remainingMessages.empty) {
          await Promise.all(remainingMessages.docs.map((message) => deleteDoc(message.ref)));
          remainingMessages = await getDocsFromServer(query(chatMessages, limit(200)));
        }
      },
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
