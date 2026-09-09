import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  Firestore,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import { AuthErrorInfo, AuthUser, DayRecord, UserSettings } from './types';
import { createDefaultDayRecord } from './constants/templates';

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
let isConfigured = false;

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
        try {
          appCheckInstance = initializeAppCheck(firebaseApp, {
            provider: new ReCaptchaV3Provider(config.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
        } catch {
          // App Check failure gracefully falls back without breaking the app
        }
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
  if (uid) {
    clearUserLocalCache(uid);
  }
  if (authInstance) {
    await signOut(authInstance);
  }
}

/**
 * Subscribes to Firebase Authentication state changes.
 * Purely server-authoritative; rejects unauthorized client mutations.
 */
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
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
  });
}

/**
 * Loads a single DayRecord from Firestore with fallback to user-scoped local cache.
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
        const data = snapshot.data() as DayRecord;
        // Save to user-scoped local cache
        cacheUserDay(uid, data);
        return data;
      }
    } catch (err) {
      handleFirestoreError('loadDayRecord', err);
    }
  }

  // Check user-scoped local cache
  if (uid) {
    const cached = getUserCachedDay(uid, dateStr);
    if (cached) return cached;
  }

  // Generate a clean default DayRecord if no previous entry exists
  return createDefaultDayRecord(dateStr, settings);
}

/**
 * Persists a DayRecord into Cloud Firestore and updates user-scoped local cache.
 */
export async function saveDayRecord(uid: string | null, day: DayRecord): Promise<void> {
  if (!uid) {
    throw new Error('Authentication required: Cannot save tracker data without signing in.');
  }

  const updatedDay: DayRecord = {
    ...day,
    updatedAt: new Date().toISOString(),
  };

  // Update user-scoped local cache
  cacheUserDay(uid, updatedDay);

  if (firestoreInstance) {
    try {
      const dayDocRef = doc(firestoreInstance, 'users', uid, 'days', day.date);
      await setDoc(
        dayDocRef,
        {
          ...updatedDay,
          lastSyncedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      throw handleFirestoreError('saveDayRecord', err);
    }
  }
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
        if (docSnap.exists()) {
          const record = docSnap.data() as DayRecord;
          cacheUserDay(uid, record);
          callback(record);
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

/**
 * Loads recent daily records for the authenticated user, bounded to prevent denial-of-service.
 */
export async function loadAllDays(uid: string, dayLimit = 180): Promise<Record<string, DayRecord>> {
  const result: Record<string, DayRecord> = {};

  if (firestoreInstance && uid) {
    try {
      const daysColRef = collection(firestoreInstance, 'users', uid, 'days');
      const q = query(daysColRef, orderBy('date', 'desc'), limit(dayLimit));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const record = docSnap.data() as DayRecord;
        result[docSnap.id] = record;
        cacheUserDay(uid, record);
      });
      return result;
    } catch (err) {
      handleFirestoreError('loadAllDays', err);
    }
  }

  // Fallback: Read from user-scoped local cache
  return getAllUserCachedDays(uid);
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
        return snap.data() as UserSettings;
      }
    } catch (err) {
      handleFirestoreError('loadUserSettings', err);
    }
  }

  const local = localStorage.getItem(`daily_os_settings_${uid}`);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      return null;
    }
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

  localStorage.setItem(`daily_os_settings_${uid}`, JSON.stringify(settings));

  if (firestoreInstance) {
    try {
      const settingsDocRef = doc(firestoreInstance, 'users', uid, 'settings', 'main');
      await setDoc(settingsDocRef, settings, { merge: true });
    } catch (err) {
      throw handleFirestoreError('saveUserSettings', err);
    }
  }
}

/**
 * Permanently deletes all personal tracker documents and clears all cached data.
 */
export async function deleteUserAccountAndData(uid: string): Promise<void> {
  if (!uid) return;

  // 1. Purge local cache immediately
  clearUserLocalCache(uid);

  // 2. Delete Firestore documents in authenticated user space
  if (firestoreInstance) {
    try {
      const daysColRef = collection(firestoreInstance, 'users', uid, 'days');
      const snapshot = await getDocs(daysColRef);
      const deletions = snapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletions);

      const settingsDocRef = doc(firestoreInstance, 'users', uid, 'settings', 'main');
      await deleteDoc(settingsDocRef);

      const userDocRef = doc(firestoreInstance, 'users', uid);
      await deleteDoc(userDocRef);
    } catch (err) {
      throw handleFirestoreError('deleteUserAccountAndData', err);
    }
  }

  // 3. Sign out of Firebase Auth
  if (authInstance?.currentUser) {
    await signOut(authInstance);
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
          result[dateStr] = JSON.parse(val);
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
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(prefix) || key.includes(uid))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(`daily_os_settings_${uid}`);
}

/**
 * Loads all day records from local storage for initial fast hydration.
 * If a user id is specified, reads from that user's isolated cache prefix.
 */
export function loadAllDaysFromStorage(uid?: string | null): Record<string, DayRecord> {
  if (uid) {
    return getAllUserCachedDays(uid);
  }
  const result: Record<string, DayRecord> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('daily_os_day_')) {
      try {
        const val = localStorage.getItem(key);
        if (val) {
          const record = JSON.parse(val) as DayRecord;
          if (record && record.date) {
            result[record.date] = record;
          }
        }
      } catch {
        // ignore malformed entries
      }
    }
  }
  return result;
}
