import React, { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
  AuthErrorInfo,
  AuthUser,
  DayRecord,
  OnboardingAnswers,
  OnboardingRequirements,
  OnboardingStatus,
  UserSystemConfiguration,
  UserSettings,
  TabType,
  SyncStatus,
} from './types';
import { diffDayRecord, indexedDbDayOutbox, DayMutation, subscribeToDayOutbox } from './services/dayOutbox';
import { readOutboxSafely } from './services/outboxAccess';
import {
  processDayOutbox,
  reconcileDayRecordWithMutations,
  resolveDayMutationConflict,
  resolveDayMutationRecovery,
} from './services/daySync';
import { DEFAULT_SETTINGS, createDefaultDayRecord, calculateCompletionPercentage } from './constants/templates';
import {
  subscribeToAuth,
  signInWithGoogle,
  signOutUser,
  AccountDeletionError,
  AccountRestoreError,
  logRestoreFailure,
  loadDayRecord,
  loadAllDays,
  loadDayHistoryPage,
  queueDayRecordUpdate,
  queueDayRecordUpdates,
  replaceGuestDayRecords,
  syncDayMutation,
  subscribeToDayRecord,
  handleMissingCloudDay,
  loadCloudDayRecord,
  loadAllDaysFromStorage,
  initializeUserAccount,
  markOnboardingCompleted,
  markOnboardingInProgress,
  saveOnboardingProgress,
  retryPendingUserSettings,
  saveUserSettings,
  removeUserCachedDay,
  deleteUserData,
  reauthenticateForAccountDeletion,
  isFirebaseConfigured,
  AppAuthError,
} from './firebase';
import { Navigation } from './components/Navigation';
import { TodayDashboard } from './components/TodayDashboard';
const TrackView = lazy(async () => ({ default: (await import('./components/TrackView')).TrackView }));
const InsightsView = lazy(async () => ({ default: (await import('./components/InsightsView')).InsightsView }));
const SettingsView = lazy(async () => ({ default: (await import('./components/SettingsView')).SettingsView }));
const AiChatBubble = lazy(async () => ({ default: (await import('./components/AiChatBubble')).AiChatBubble }));
import { FluidBackground } from './components/FluidBackground';
import { SmoothScrollProvider } from './components/SmoothScrollProvider';
const OnboardingModal = lazy(async () => ({ default: (await import('./components/OnboardingModal')).OnboardingModal }));
import type { GeneratedSystemArchetype } from './services/onboardingPipeline';
import {
  createDefaultOnboardingAnswers,
  onboardingRequirementsMatchAnswers,
  shouldShowOnboarding,
  validateOnboardingAnswers,
  validateOnboardingRequirements,
} from './services/accountLifecycle';
import { getLocalDateId, addDaysToDateId } from './utils/localDate';
import {
  appendDayHistoryPage,
  DEFAULT_HISTORY_PAGE_SIZE,
  DayHistorySource,
  mergeDayRecords,
  paginateDayHistory,
} from './utils/dayHistory';
import {
  createSystemConfigurationFromRequirements,
  getSystemConfiguration,
  normalizeUserSettings,
  validateUserSystemConfiguration,
} from './services/systemConfiguration';

function getGuestOnboardingDraft(): {
  answers: OnboardingAnswers;
  currentStage: number;
  requirements: OnboardingRequirements | null;
  systemConfiguration: UserSystemConfiguration | null;
} {
  const defaultDraft = {
    answers: createDefaultOnboardingAnswers(),
    currentStage: 1,
    requirements: null,
    systemConfiguration: null,
  };
  try {
    const stored = localStorage.getItem('daily_os_guest_onboarding_answers');
    if (!stored) return defaultDraft;
    const data = JSON.parse(stored) as {
      answers?: unknown;
      currentStage?: unknown;
      requirements?: unknown;
      systemConfiguration?: unknown;
    };
    const answers = validateOnboardingAnswers(data.answers);
    const requirements = validateOnboardingRequirements(data.requirements);
    const systemConfiguration = validateUserSystemConfiguration(data.systemConfiguration);
    const currentStage = typeof data.currentStage === 'number' && Number.isInteger(data.currentStage)
      ? Math.min(6, Math.max(1, data.currentStage))
      : 1;
    return {
      answers: answers ?? defaultDraft.answers,
      currentStage,
      requirements: answers && requirements && onboardingRequirementsMatchAnswers(requirements, answers)
        ? requirements
        : null,
      systemConfiguration: answers && requirements?.userConfirmed && systemConfiguration
        && onboardingRequirementsMatchAnswers(requirements, answers)
        ? systemConfiguration
        : null,
    };
  } catch (err) {
    console.error('Guest onboarding progress could not be restored:', err);
    return defaultDraft;
  }
}

function getOutboxSyncStatus(operations: DayMutation[]): SyncStatus {
  if (operations.some((operation) => operation.status === 'conflict' || operation.status === 'recovery')) return 'conflict';
  if (operations.some((operation) => operation.status === 'failed')) return 'error';
  if (operations.some((operation) => operation.status === 'syncing')) return 'syncing';
  if (operations.some((operation) => operation.status === 'pending')) {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending';
  }
  return 'synced';
}

function getSyncStatusLabel(status: SyncStatus, isAuthenticated: boolean): string {
  if (!isAuthenticated && status !== 'error') return 'Saved on this device';
  const labels: Record<SyncStatus, string> = {
    idle: 'Sync status unknown',
    pending: 'Saved locally',
    syncing: 'Syncing',
    offline: 'Waiting for connection',
    conflict: 'Conflict needs review',
    synced: 'Cloud synced',
    error: 'Sync failed',
    unavailable: 'Local sync storage unavailable',
  };
  return labels[status];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase();
    if (['today', 'dsa', 'academics', 'workout', 'projects', 'review', 'calendar', 'history', 'settings'].includes(path)) {
      return path as TabType;
    }
    return 'today';
  });

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountDeletionPending, setAccountDeletionPending] = useState(false);
  const [authRestoreError, setAuthRestoreError] = useState<string | null>(null);
  const [accountRetryCount, setAccountRetryCount] = useState(0);
  const [authRetryCount, setAuthRetryCount] = useState(0);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>(() => createDefaultOnboardingAnswers());
  const [onboardingRequirements, setOnboardingRequirements] = useState<OnboardingRequirements | null>(null);
  const [onboardingStage, setOnboardingStage] = useState(3);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [aiAssistantMounted, setAiAssistantMounted] = useState(false);
  const [aiAssistantInitiallyOpen, setAiAssistantInitiallyOpen] = useState(false);

  // Active Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateId());

  // Current Day Record
  const [currentDay, setCurrentDay] = useState<DayRecord>(() => {
    return createDefaultDayRecord(getLocalDateId(), DEFAULT_SETTINGS);
  });
  const currentDayRef = useRef(currentDay);
  const updateCurrentDay = useCallback((day: DayRecord) => {
    currentDayRef.current = day;
    setCurrentDay(day);
  }, []);

  // Yesterday's record for context & morning briefing momentum
  const [yesterdayRecord, setYesterdayRecord] = useState<DayRecord | null>(null);

  // All days cache
  const [allDays, setAllDays] = useState<Record<string, DayRecord>>({});
  const [historyComplete, setHistoryComplete] = useState(false);
  const [historySource, setHistorySource] = useState<DayHistorySource>('cache');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLocalCursor, setHistoryLocalCursor] = useState<string | null>(null);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);

  // Settings with persistent wallpaper & styling
  const [settings, setSettings] = useState<UserSettings>(() => DEFAULT_SETTINGS);
  const systemConfiguration = useMemo(
    () => getSystemConfiguration(settings.systemConfiguration),
    [settings.systemConfiguration]
  );
  const aiEnabled = systemConfiguration.aiBehavior === 'enabled';

  useEffect(() => {
    const moduleByTab: Partial<Record<TabType, 'academics' | 'dsa' | 'workout' | 'projects' | 'insights'>> = {
      academics: 'academics',
      dsa: 'dsa',
      workout: 'workout',
      projects: 'projects',
      review: 'insights',
      calendar: 'insights',
      history: 'insights',
    };
    const requiredModule = moduleByTab[activeTab];
    if (requiredModule && !systemConfiguration.enabledModules.includes(requiredModule)) {
      const firstEnabled = (['dsa', 'academics', 'workout', 'projects'] as const)
        .find((module) => systemConfiguration.enabledModules.includes(module));
      const nextTab: TabType = requiredModule === 'insights' || !firstEnabled ? 'today' : firstEnabled;
      setActiveTab(nextTab);
      window.history.replaceState(null, '', nextTab === 'today' ? '/' : `/${nextTab}`);
    }
  }, [activeTab, systemConfiguration.enabledModules]);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [outboxUnavailableUid, setOutboxUnavailableUid] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncConflict, setSyncConflict] = useState<DayMutation | null>(null);
  const [syncRecovery, setSyncRecovery] = useState<DayMutation | null>(null);
  const syncWorkerRef = useRef<{ uid: string; run: () => Promise<void>; stop: () => Promise<void> } | null>(null);

  const showOnboarding = shouldShowOnboarding({
    authResolved,
    isAuthenticated: Boolean(user),
    accountReady: accountReady && (!user || accountUserId === user.uid),
    onboardingStatus,
    guestOnboardingComplete: Boolean(localStorage.getItem('daily_os_onboarded')),
    dismissed: onboardingDismissed,
  });

  const handleSelectTab = (newTab: TabType) => {
    setActiveTab(newTab);
    const newPath = newTab === 'today' ? '/' : `/${newTab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // Auth subscription
  useEffect(() => {
    let active = true;
    let authResolvedTimeout: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      if (active) {
        setAuthRestoreError('Sign-in state is taking too long to restore. Check your connection or browser storage, then retry.');
      }
    }, 15000);
    const clearAuthTimeout = () => {
      if (authResolvedTimeout) clearTimeout(authResolvedTimeout);
      authResolvedTimeout = undefined;
    };
    const unsub = subscribeToAuth((authUser) => {
      clearAuthTimeout();
      if (!active) return;
      setAuthRestoreError(null);
      setUser((previous) => previous?.uid === authUser?.uid ? previous : authUser);
      setAuthResolved(true);
      setOutboxUnavailableUid(null);
      setAccountReady(authUser === null);
      setAccountUserId(null);
      if (!authUser) {
        setAccountDeletionPending(false);
        const draft = getGuestOnboardingDraft();
        setOnboardingStatus(null);
        setOnboardingAnswers(draft.answers);
        setOnboardingRequirements(draft.requirements);
        setOnboardingStage(draft.currentStage);
        const guestHistory = paginateDayHistory(loadAllDaysFromStorage(), { pageSize: DEFAULT_HISTORY_PAGE_SIZE });
        setAllDays(guestHistory.records);
        setHistoryComplete(guestHistory.complete);
        setHistorySource('local');
        setHistoryCursor(guestHistory.nextCursor);
        setHistoryLocalCursor(null);
        setHistoryLoadError(null);
        setSyncConflict(null);
        setSyncRecovery(null);
        setSettings(DEFAULT_SETTINGS);
        updateCurrentDay(createDefaultDayRecord(getLocalDateId(), DEFAULT_SETTINGS));
        setYesterdayRecord(null);
      }
    }, (error) => {
      clearAuthTimeout();
      logRestoreFailure('auth_state', error);
      if (active) setAuthRestoreError('Sign-in state could not be restored. Retry or check your connection and browser storage.');
    });
    return () => {
      active = false;
      clearAuthTimeout();
      unsub();
    };
  }, [authRetryCount]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAccountReady(true);
      setAccountUserId(null);
      setAccountError(null);
      setAccountDeletionPending(false);
      setOnboardingStatus(null);
      const guestHistory = paginateDayHistory(loadAllDaysFromStorage(), { pageSize: DEFAULT_HISTORY_PAGE_SIZE });
      setAllDays(guestHistory.records);
      setHistoryComplete(guestHistory.complete);
      setHistorySource('local');
      setHistoryCursor(guestHistory.nextCursor);
      setHistoryLocalCursor(null);
      setHistoryLoadError(null);
      setSyncConflict(null);
      setSyncRecovery(null);
      setSettings(DEFAULT_SETTINGS);
      const draft = getGuestOnboardingDraft();
      setOnboardingAnswers(draft.answers);
      setOnboardingRequirements(draft.requirements);
      setOnboardingStage(draft.currentStage);
      const localSettings = localStorage.getItem('daily_os_guest_settings');
      if (localSettings) {
        try {
          setSettings(normalizeUserSettings(JSON.parse(localSettings) as UserSettings));
        } catch (err) {
          console.error('Guest settings could not be restored:', err);
        }
      }
      return () => { active = false; };
    }

    setAccountReady(false);
    setAccountUserId(null);
    setAccountError(null);
    setAccountDeletionPending(false);
    setOnboardingStatus(null);
    setAllDays({});
    setHistoryComplete(false);
    setHistorySource('cache');
    setHistoryCursor(null);
    setHistoryLocalCursor(null);
    setHistoryLoadError(null);
    setSyncConflict(null);
    setSyncRecovery(null);
    setOutboxUnavailableUid(null);
    setSyncError(null);
    setSettings(DEFAULT_SETTINGS);
    updateCurrentDay(createDefaultDayRecord(getLocalDateId(), DEFAULT_SETTINGS));
    setYesterdayRecord(null);
    initializeUserAccount(user)
      .then(async (account) => {
        if (!active) return;
        setOnboardingStatus(account.onboarding.status);
        const accountAnswers = account.onboarding.answers;
        const guestDraft = getGuestOnboardingDraft();
        const useGuestDraft = !accountAnswers && account.onboarding.status === 'not_started';
        const accountRequirements = account.onboarding.requirements;
        setOnboardingAnswers(accountAnswers ?? (useGuestDraft ? guestDraft.answers : createDefaultOnboardingAnswers()));
        setOnboardingRequirements(accountRequirements ?? (useGuestDraft ? guestDraft.requirements : null));
        setOnboardingStage(Math.max(3, Math.min(6, useGuestDraft ? guestDraft.currentStage : account.onboarding.currentStage)));
        if (account.settings) setSettings(account.settings);
        const history = await loadDayHistoryPage(user.uid, { pageSize: DEFAULT_HISTORY_PAGE_SIZE });
        const outboxResult = history.outboxAvailable === false
          ? { available: false as const, operations: null, error: new Error('Local sync storage is unavailable.') }
          : await readOutboxSafely(indexedDbDayOutbox, user.uid);
        const queuedOperations = outboxResult.available ? outboxResult.operations : [];
        if (!active) return;
        setAllDays(history.records);
        setHistoryComplete(history.complete);
        setHistorySource(history.source);
        setHistoryCursor(history.nextCursor);
        setHistoryLocalCursor(history.nextLocalCursor);
        setHistoryLoadError(null);
        setSyncConflict(queuedOperations.find((operation) => operation.status === 'conflict') ?? null);
        setSyncRecovery(queuedOperations.find((operation) => operation.status === 'recovery') ?? null);
        if (outboxResult.available) {
          setOutboxUnavailableUid(null);
          setSyncStatus(getOutboxSyncStatus(queuedOperations));
          setSyncError(null);
        } else {
          logRestoreFailure('outbox_read', 'error' in outboxResult ? outboxResult.error : null);
          setOutboxUnavailableUid(user.uid);
          setSyncStatus('unavailable');
          setSyncError('Local sync storage is unavailable. Cloud history loaded, but queued local edits cannot be checked. Restore browser storage and retry before editing day records.');
        }
        setAccountUserId(user.uid);
        setAccountReady(true);
      })
      .catch((err: unknown) => {
        const restorePhase = err instanceof AccountRestoreError
          ? err.phase
          : err instanceof AccountDeletionError ? 'account_integrity' : 'account_reads';
        logRestoreFailure(restorePhase, err);
        if (!active) return;
        if (err instanceof AccountDeletionError) {
          setAccountDeletionPending(true);
          setAccountReady(false);
        }
        setAccountError(err instanceof Error ? err.message : 'Account data could not be loaded.');
      });

    return () => { active = false; };
  }, [user, accountRetryCount]);

  useEffect(() => {
    setOnboardingDismissed(false);
  }, [user?.uid]);


  useEffect(() => {
    if (!user || !accountReady || accountUserId !== user.uid || onboardingStatus !== 'not_started') return;
    let active = true;
    markOnboardingInProgress(user.uid)
      .then((progress) => {
        if (active) setOnboardingStatus(progress.status);
      })
      .catch((err: unknown) => {
        console.error('Onboarding progress could not be saved:', err);
        if (active) setAccountError(err instanceof Error ? err.message : 'Onboarding progress could not be saved.');
      });
    return () => { active = false; };
  }, [user?.uid, accountReady, accountUserId, onboardingStatus]);

  // Load day record
  useEffect(() => {
    let isMounted = true;

    async function fetchDays() {
      if (!authResolved || (user && (!accountReady || accountUserId !== user.uid))) return;
      if (!user || outboxUnavailableUid !== user.uid) setSyncStatus('syncing');
      try {
        const loadedRecord = await loadDayRecord(user?.uid ?? null, selectedDate, settings);
        const outboxResult = user
          ? await readOutboxSafely(indexedDbDayOutbox, user.uid)
          : { available: true as const, operations: [] as DayMutation[] };
        const queuedOperations = outboxResult.available ? outboxResult.operations : [];
        const record = user
          ? reconcileDayRecordWithMutations(
            loadedRecord,
            queuedOperations.filter((operation) => operation.date === selectedDate)
          )
          : loadedRecord;
        const yDate = addDaysToDateId(selectedDate, -1);
        const yBase = await loadDayRecord(user ? user.uid : null, yDate, settings);
        const yRec = user
          ? reconcileDayRecordWithMutations(
            yBase,
            queuedOperations.filter((operation) => operation.date === yDate)
          )
          : yBase;

        if (isMounted) {
          updateCurrentDay(record);
          setYesterdayRecord(yRec);
          setAllDays((prev) => ({ ...prev, [selectedDate]: record }));
          if (outboxResult.available) {
            setOutboxUnavailableUid(null);
            setSyncConflict(queuedOperations.find((operation) => operation.status === 'conflict') ?? null);
            setSyncRecovery(queuedOperations.find((operation) => operation.status === 'recovery') ?? null);
            setSyncStatus(user ? getOutboxSyncStatus(queuedOperations) : 'synced');
            if (outboxUnavailableUid === user?.uid) setSyncError(null);
          } else {
            setOutboxUnavailableUid(user?.uid ?? null);
            setSyncStatus('unavailable');
            setSyncError('Local sync storage is unavailable. Day records are read-only until queued edits can be checked.');
          }
        }
      } catch (err) {
        console.error('Failed to load day record:', err);
        if (isMounted) {
          setSyncStatus(outboxUnavailableUid === user?.uid ? 'unavailable' : 'idle');
          if (outboxUnavailableUid !== user?.uid) setAccountError(err instanceof Error ? err.message : 'Day data could not be loaded.');
        }
      }
    }

    fetchDays();

    let unsubSnapshot: (() => void) | null = null;
    if (user && isFirebaseConfigured && outboxUnavailableUid !== user.uid) {
      unsubSnapshot = subscribeToDayRecord(user.uid, selectedDate, (updated) => {
        if (!isMounted) return;
        if (!updated) {
          void handleMissingCloudDay(user.uid, selectedDate).then(async (cachedRecord) => {
            const operations = await indexedDbDayOutbox.list(user.uid);
            if (!isMounted) return;
            const dateOperations = operations.filter((operation) => operation.date === selectedDate);
            setSyncConflict(operations.find((operation) => operation.status === 'conflict') ?? null);
            setSyncRecovery(operations.find((operation) => operation.status === 'recovery') ?? null);
            setSyncStatus(getOutboxSyncStatus(operations));
            if (!cachedRecord && dateOperations.length === 0) {
              removeUserCachedDay(user.uid, selectedDate);
              setAllDays((previous) => {
                const next = { ...previous };
                delete next[selectedDate];
                return next;
              });
              updateCurrentDay(createDefaultDayRecord(selectedDate, settings));
              return;
            }
            const base = cachedRecord ?? dateOperations[0]?.baseRecord ?? createDefaultDayRecord(selectedDate, settings);
            const recovered = reconcileDayRecordWithMutations(base, dateOperations);
            updateCurrentDay(recovered);
            setAllDays((previous) => ({ ...previous, [selectedDate]: recovered }));
          }).catch((error: unknown) => {
            console.error('Missing cloud day data could not be recovered:', error);
            if (isMounted) setSyncStatus('error');
          });
          return;
        }
        void indexedDbDayOutbox.list(user.uid).then((operations) => {
          if (!isMounted) return;
          const reconciled = reconcileDayRecordWithMutations(
            updated,
            operations.filter((operation) => operation.date === selectedDate)
          );
          updateCurrentDay(reconciled);
          setAllDays((prev) => ({ ...prev, [selectedDate]: reconciled }));
          setSyncConflict(operations.find((operation) => operation.status === 'conflict') ?? null);
          setSyncRecovery(operations.find((operation) => operation.status === 'recovery') ?? null);
          setSyncStatus(getOutboxSyncStatus(operations));
        }).catch((error: unknown) => {
          console.error('Pending day changes could not be restored:', error);
          if (isMounted) setSyncStatus('error');
        });
      });
    }

    return () => {
      isMounted = false;
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [selectedDate, user, settings, authResolved, accountReady, accountUserId, outboxUnavailableUid]);

  useEffect(() => {
    if (!user || !authResolved || !accountReady || accountUserId !== user.uid || outboxUnavailableUid === user.uid) return;
    const uid = user.uid;
    let active = true;
    let running = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let currentRun: Promise<void> | null = null;
    setSyncError(null);

    const run = async () => {
      if (!active || running || user?.uid !== uid || outboxUnavailableUid === uid) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      running = true;
      currentRun = (async () => {
        const before = await indexedDbDayOutbox.list(uid);
        if (!active) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSyncConflict(before.find((operation) => operation.status === 'conflict') ?? null);
          setSyncRecovery(before.find((operation) => operation.status === 'recovery') ?? null);
          setSyncStatus(getOutboxSyncStatus(before));
          return;
        }

        await processDayOutbox(uid, {
          store: indexedDbDayOutbox,
          apply: syncDayMutation,
          isActive: () => active && user?.uid === uid,
          onApplied: (operation, result) => {
            const displayRecord = reconcileDayRecordWithMutations(result.record, [operation]);
            setAllDays((previous) => ({ ...previous, [operation.date]: displayRecord }));
            if (currentDayRef.current.date === operation.date) updateCurrentDay(displayRecord);
          },
        });
        if (!active) return;

        const after = await indexedDbDayOutbox.list(uid);
        if (!active) return;
        setSyncConflict(after.find((operation) => operation.status === 'conflict') ?? null);
        setSyncRecovery(after.find((operation) => operation.status === 'recovery') ?? null);
        setSyncStatus(getOutboxSyncStatus(after));
        const failedOperation = after.find((operation) => operation.status === 'failed');
        setSyncError(failedOperation
          ? `A day change could not sync (${failedOperation.lastError ?? 'unknown error'}). It remains saved on this device.`
          : null);
        const pending = after.filter((operation) => (
          operation.status === 'pending' || operation.status === 'syncing'
        ));
        if (pending.length > 0) {
          const nextAttempt = Math.min(...pending.map((operation) => operation.nextAttemptAt));
          const delay = Math.max(250, nextAttempt - Date.now());
          retryTimer = setTimeout(() => { void run(); }, delay);
        }
      })();

      try {
        await currentRun;
      } catch (error) {
        console.error('Day synchronization could not run:', error);
        if (active) {
          setSyncStatus('error');
          setSyncError(error instanceof Error ? error.message : 'Day synchronization could not run.');
        }
      } finally {
        running = false;
        currentRun = null;
      }
    };

    const unsubscribe = subscribeToDayOutbox((changedUid) => {
      if (changedUid === uid) void run();
    });
    const handleOnline = () => { void run(); };
    window.addEventListener('online', handleOnline);

    const stop = async () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      if (currentRun) await currentRun;
    };
    syncWorkerRef.current = { uid, run, stop };
    void run();

    return () => {
      void stop();
      if (syncWorkerRef.current?.uid === uid) syncWorkerRef.current = null;
    };
  }, [user?.uid, authResolved, accountReady, accountUserId, outboxUnavailableUid]);

  const handleLoadOlderHistory = useCallback(async () => {
    if (historyLoadingMore) return;
    setHistoryLoadingMore(true);
    setHistoryLoadError(null);
    try {
      if (user) {
        const page = await loadDayHistoryPage(user.uid, {
          pageSize: DEFAULT_HISTORY_PAGE_SIZE,
          beforeDate: historyCursor,
          localBeforeDate: historyLocalCursor,
        });
        setAllDays((loaded) => appendDayHistoryPage(loaded, page.records));
        setHistorySource(page.source);
        setHistoryComplete(page.complete);
        if (page.source === 'cache') {
          setHistoryLocalCursor(page.nextLocalCursor);
        } else {
          setHistoryCursor(page.nextCursor);
          setHistoryLocalCursor(null);
        }
      } else {
        const page = paginateDayHistory(loadAllDaysFromStorage(), {
          pageSize: DEFAULT_HISTORY_PAGE_SIZE,
          beforeDate: historyCursor,
        });
        setAllDays((loaded) => appendDayHistoryPage(loaded, page.records));
        setHistoryCursor(page.nextCursor);
        setHistoryLocalCursor(null);
        setHistorySource('local');
        setHistoryComplete(page.complete);
      }
    } catch (error) {
      setHistoryLoadError(error instanceof Error ? error.message : 'Older history could not be loaded.');
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [historyCursor, historyLocalCursor, historyLoadingMore, user]);

  const handleLoadCompleteBackupHistory = useCallback(async () => {
    if (user) return loadAllDays(user.uid);
    return loadAllDaysFromStorage();
  }, [user]);

  const handleUpdateDay = useCallback(
    async (updatedDay: DayRecord, baseDay?: DayRecord): Promise<void> => {
      if (user && outboxUnavailableUid === user.uid) {
        const message = 'Day editing is paused because local sync storage is unavailable. Restore browser storage and retry so pending edits and conflicts can be checked safely.';
        setSyncStatus('unavailable');
        setSyncError(message);
        throw new Error(message);
      }
      const base = baseDay ?? currentDayRef.current;
      if (base.date !== updatedDay.date) {
        throw new Error('A day change cannot move data between dates.');
      }
      const patch = diffDayRecord(base, updatedDay);
      if (Object.keys(patch).length === 0) return;
      const current = currentDayRef.current;
      const mergedDay = { ...current, ...patch };
      const optimisticDay = {
        ...mergedDay,
        date: current.date,
        createdAt: current.createdAt,
        completionPercentage: calculateCompletionPercentage(mergedDay),
        updatedAt: new Date().toISOString(),
      };

      updateCurrentDay(optimisticDay);
      setAllDays((prev) => ({ ...prev, [optimisticDay.date]: optimisticDay }));
      setSyncStatus(user ? 'pending' : 'synced');
      setAccountError(null);

      try {
        await queueDayRecordUpdate(
          user?.uid ?? null,
          base,
          user ? updatedDay : optimisticDay
        );
      } catch (error) {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'The day change could not be stored locally.');
        throw error;
      }
    },
    [user, outboxUnavailableUid, updateCurrentDay]
  );

  const persistSettings = async (newSettings: UserSettings) => {
    const validatedSettings = normalizeUserSettings(newSettings);
    if (user) {
      await saveUserSettings(user.uid, validatedSettings);
    } else {
      localStorage.setItem('daily_os_guest_settings', JSON.stringify(validatedSettings));
    }
  };

  const handleUpdateSettingsAndWait = async (newSettings: UserSettings) => {
    const validatedSettings = normalizeUserSettings(newSettings);
    setSettings(validatedSettings);
    try {
      await persistSettings(validatedSettings);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Settings could not be saved.');
      throw err;
    }
  };

  const handleUpdateSettings = (newSettings: UserSettings) => {
    void handleUpdateSettingsAndWait(newSettings).catch((err) => {
      console.error('Failed to save user settings:', err);
    });
  };

  const handleOnboardingAnswersChange = useCallback((answers: OnboardingAnswers) => {
    setOnboardingAnswers(answers);
    setOnboardingRequirements(null);
  }, []);

  const handleOnboardingRequirementsChange = useCallback((requirements: OnboardingRequirements | null) => {
    setOnboardingRequirements(requirements);
  }, []);

  const handleOnboardingStageChange = useCallback((currentStage: number) => {
    setOnboardingStage(currentStage);
  }, []);

  const handleSaveOnboardingProgress = useCallback(async (
    answers: OnboardingAnswers,
    currentStage: number,
    requirements: OnboardingRequirements | null,
    systemConfiguration?: UserSystemConfiguration
  ) => {
    const validatedAnswers = validateOnboardingAnswers(answers);
    if (!validatedAnswers) throw new Error('Review the questionnaire answers; one or more fields are invalid.');
    const validatedRequirements = requirements ? validateOnboardingRequirements(requirements) : null;
    const validatedConfiguration = systemConfiguration
      ? validateUserSystemConfiguration(systemConfiguration)
      : null;
    const confirmedConfiguration = validatedRequirements?.userConfirmed
      ? createSystemConfigurationFromRequirements(validatedRequirements)
      : null;
    if (
      (requirements && !validatedRequirements)
      || (validatedRequirements && !onboardingRequirementsMatchAnswers(validatedRequirements, validatedAnswers))
      || (systemConfiguration && !validatedConfiguration)
      || (validatedConfiguration && !validatedRequirements?.userConfirmed)
      || (validatedConfiguration && confirmedConfiguration
        && JSON.stringify(validatedConfiguration) !== JSON.stringify(confirmedConfiguration))
    ) {
      throw new Error('Review the requirements; the specification does not match the questionnaire answers.');
    }
    const configurationToPersist = validatedConfiguration ?? confirmedConfiguration;
    if (user) {
      const progress = await saveOnboardingProgress(
        user.uid,
        validatedAnswers,
        currentStage,
        validatedRequirements,
        configurationToPersist
      );
      setOnboardingStatus(progress.status);
    } else {
      const existingDraft = getGuestOnboardingDraft();
      const savedConfiguration = configurationToPersist
        ?? (validatedRequirements?.userConfirmed ? existingDraft.systemConfiguration : null);
      localStorage.setItem(
        'daily_os_guest_onboarding_answers',
        JSON.stringify({
          answers: validatedAnswers,
          currentStage,
          requirements: validatedRequirements,
          ...(savedConfiguration ? { systemConfiguration: savedConfiguration } : {}),
        })
      );
    }
  }, [user]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const authUser = await signInWithGoogle();
      setUser((previous) => previous?.uid === authUser.uid ? previous : authUser);
    } catch (err: unknown) {
      if (err instanceof AppAuthError) setAuthError(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleResolveDayConflict = useCallback(async (choice: 'local' | 'remote') => {
    const operation = syncConflict;
    if (!operation || user?.uid !== operation.uid) return;
    try {
      const latestCloudRecord = await loadCloudDayRecord(operation.uid, operation.date);
      if (!latestCloudRecord) {
        const cachedRecord = await handleMissingCloudDay(operation.uid, operation.date);
        const recoveries = await indexedDbDayOutbox.list(operation.uid);
        const dateOperations = recoveries.filter((candidate) => candidate.date === operation.date);
        const localBase = cachedRecord ?? dateOperations[0]?.baseRecord ?? operation.baseRecord;
        const restored = reconcileDayRecordWithMutations(localBase, dateOperations);
        setAllDays((previous) => ({ ...previous, [operation.date]: restored }));
        if (operation.date === selectedDate) updateCurrentDay(restored);
        setSyncConflict(recoveries.find((candidate) => candidate.status === 'conflict') ?? null);
        setSyncRecovery(recoveries.find((candidate) => candidate.status === 'recovery') ?? null);
        setSyncStatus(getOutboxSyncStatus(recoveries));
        return;
      }
      await resolveDayMutationConflict(indexedDbDayOutbox, operation, choice, latestCloudRecord);
      const operations = await indexedDbDayOutbox.list(operation.uid);
      const resolved = reconcileDayRecordWithMutations(
        latestCloudRecord,
        operations.filter((candidate) => candidate.date === operation.date)
      );
      setAllDays((previous) => ({ ...previous, [operation.date]: resolved }));
      if (operation.date === selectedDate) updateCurrentDay(resolved);
      setSyncConflict(operations.find((candidate) => candidate.status === 'conflict') ?? null);
      setSyncRecovery(operations.find((candidate) => candidate.status === 'recovery') ?? null);
      setSyncStatus(getOutboxSyncStatus(operations));
      if (choice === 'local') void syncWorkerRef.current?.run();
    } catch (error) {
      console.error('The day conflict could not be resolved:', error);
      setAccountError(error instanceof Error ? error.message : 'The day conflict could not be resolved.');
    }
  }, [syncConflict, user?.uid, selectedDate, updateCurrentDay]);

  const handleResolveDayRecovery = useCallback(async (choice: 'local' | 'remote') => {
    const recovery = syncRecovery;
    if (!recovery || user?.uid !== recovery.uid) return;
    try {
      const operations = await indexedDbDayOutbox.list(recovery.uid);
      const dateRecoveries = operations.filter((operation) => (
        operation.date === recovery.date && operation.status === 'recovery'
      ));
      if (choice === 'remote') {
        await Promise.all(dateRecoveries.map((operation) => indexedDbDayOutbox.remove(operation.id)));
        removeUserCachedDay(recovery.uid, recovery.date);
      } else {
        await Promise.all(dateRecoveries.map((operation) => (
          resolveDayMutationRecovery(indexedDbDayOutbox, operation, 'local')
        )));
      }

      const remaining = await indexedDbDayOutbox.list(recovery.uid);
      const dateOperations = remaining.filter((operation) => operation.date === recovery.date);
      const base = choice === 'remote'
        ? dateOperations[0]?.baseRecord ?? createDefaultDayRecord(recovery.date, settings)
        : recovery.baseRecord;
      const resolved = reconcileDayRecordWithMutations(base, dateOperations);
      if (choice === 'remote' && dateOperations.length === 0) {
        setAllDays((previous) => {
          const next = { ...previous };
          delete next[recovery.date];
          return next;
        });
        if (recovery.date === selectedDate) updateCurrentDay(createDefaultDayRecord(recovery.date, settings));
      } else {
        setAllDays((previous) => ({ ...previous, [recovery.date]: resolved }));
        if (recovery.date === selectedDate) updateCurrentDay(resolved);
      }
      setSyncConflict(remaining.find((operation) => operation.status === 'conflict') ?? null);
      setSyncRecovery(remaining.find((operation) => operation.status === 'recovery') ?? null);
      setSyncStatus(getOutboxSyncStatus(remaining));
      if (choice === 'local') void syncWorkerRef.current?.run();
    } catch (error) {
      console.error('The day recovery decision could not be saved:', error);
      setAccountError(error instanceof Error ? error.message : 'The day recovery decision could not be saved.');
    }
  }, [syncRecovery, user?.uid, selectedDate, settings, updateCurrentDay]);

  const handleRetryDaySync = async () => {
    if (!user) return;
    if (outboxUnavailableUid === user.uid) {
      setOutboxUnavailableUid(null);
      setAccountRetryCount((count) => count + 1);
      return;
    }
    try {
      const operations = await indexedDbDayOutbox.list(user.uid);
      await Promise.all(operations.filter((operation) => operation.status === 'failed').map((operation) => (
        indexedDbDayOutbox.update(operation.id, {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: Date.now(),
          lastError: undefined,
        })
      )));
      setSyncError(null);
      await syncWorkerRef.current?.run();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Day synchronization could not be retried.');
    }
  };

  const handleSignOut = async () => {
    try {
      if (user) await retryPendingUserSettings(user.uid);
      await signOutUser(user ? user.uid : null);
      setUser(null);
      setAllDays({});
      setSettings(DEFAULT_SETTINGS);
      updateCurrentDay(createDefaultDayRecord(selectedDate, DEFAULT_SETTINGS));
      setSyncConflict(null);
      setSyncStatus('idle');
      setSyncError(null);
    } catch (err) {
      console.warn('Sign-out error:', err);
      setAccountError(err instanceof Error ? err.message : 'Sign-out could not complete because settings could not be saved.');
    }
  };

  return (
    <SmoothScrollProvider>
      <div className="relative min-h-screen bg-[#0a0b0e] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-white/20 selection:text-white overflow-hidden">
        {/* Custom Wallpaper or WebGL Fluid Shader */}
        <FluidBackground
          customWallpaper={settings.customWallpaper}
          blur={settings.wallpaperBlur}
          dim={settings.wallpaperDim}
        />

        {(authRestoreError || accountError) && (
          <div className="fixed top-3 left-1/2 z-50 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl border border-red-400/30 bg-zinc-950/95 px-4 py-3 text-sm text-red-100 shadow-xl" role="alert">
            <span>{authRestoreError || accountError}</span>
            {(user || !authResolved) && (
              <button
                type="button"
                className="shrink-0 rounded-lg bg-white/10 px-3 py-1 text-white hover:bg-white/20"
                onClick={async () => {
                  if (accountDeletionPending && user) {
                    try {
                      await reauthenticateForAccountDeletion(user.uid);
                      const worker = syncWorkerRef.current;
                      if (worker?.uid === user.uid) await worker.stop();
                      await deleteUserData(user.uid);
                    } catch (error) {
                      setAccountError(error instanceof Error ? error.message : 'Account deletion is incomplete. Resume deletion to continue.');
                    }
                    return;
                  }
                  if (!authResolved || authRestoreError) {
                    setAuthRestoreError(null);
                    setAuthRetryCount((count) => count + 1);
                    return;
                  }
                  if (user && (!accountReady || accountUserId !== user.uid)) {
                    setAccountError(null);
                    setAccountRetryCount((count) => count + 1);
                    return;
                  }
                  try {
                    if (user) await retryPendingUserSettings(user.uid);
                    await syncWorkerRef.current?.run();
                    setAccountRetryCount((count) => count + 1);
                  } catch (err) {
                    setAccountError(err instanceof Error ? err.message : 'Pending data could not be saved.');
                  }
                }}
              >
                {accountDeletionPending ? 'Resume deletion' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {/* Streamlined Navigation */}
        <div className="relative z-30">
          <Navigation
            currentTab={activeTab}
            onSelectTab={handleSelectTab}
            user={user}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            isSigningIn={isSigningIn}
            authError={authError}
            onClearAuthError={() => setAuthError(null)}
            syncStatus={syncStatus}
            completionRate={currentDay.completionPercentage}
            enabledModules={systemConfiguration.enabledModules}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
            <div className="border-b border-white/5 px-4 py-1 text-[10px] font-mono text-zinc-500 md:hidden" aria-live="polite">
              {getSyncStatusLabel(syncStatus, Boolean(user))}
            </div>
            {syncError && (
            <div className={`mx-auto mt-3 flex max-w-4xl items-center justify-between gap-3 rounded-xl border px-4 py-2 text-xs ${syncStatus === 'unavailable' ? 'border-red-400/30 bg-red-950/30 text-red-100' : 'border-amber-400/30 bg-amber-950/30 text-amber-100'}`} role="alert">
                <span>{syncError}</span>
                {user && (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20"
                    onClick={() => { void handleRetryDaySync(); }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            {syncConflict && user?.uid === syncConflict.uid && (
              <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-xs text-red-100" role="alert">
                <span>
                  Conflicting edits for {syncConflict.date} ({syncConflict.conflicts?.map((conflict) => conflict.field).join(', ')}).
                  Both versions are preserved; choose which value to keep.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
                    onClick={() => { void handleResolveDayConflict('local'); }}
                  >
                    Keep my edits
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
                    onClick={() => { void handleResolveDayConflict('remote'); }}
                  >
                    Use cloud version
                  </button>
                </div>
              </div>
            )}
            {syncRecovery && user?.uid === syncRecovery.uid && (
              <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-xs text-amber-100" role="alert">
                <span>
                  {syncRecovery.remoteDeleted
                    ? `The cloud copy of ${syncRecovery.date} was deleted. Your local version is preserved.`
                    : `The saved local copy of ${syncRecovery.date} could not be matched to a cloud record.`}
                  {' '}Choose whether to restore it or discard this local copy.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
                    onClick={() => { void handleResolveDayRecovery('local'); }}
                  >
                    Restore local copy
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
                    onClick={() => { void handleResolveDayRecovery('remote'); }}
                  >
                    Discard local copy
                  </button>
                </div>
              </div>
            )}
            {!authResolved || (user && (!accountReady || accountUserId !== user.uid)) ? (
              <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-zinc-300">
              {accountError || authRestoreError || 'Checking your account…'}
              </div>
            ) : (
              <>
            {/* 1. Today Command Center */}
            {activeTab === 'today' && (
              <TodayDashboard
                day={currentDay}
                yesterday={yesterdayRecord}
                onUpdateDay={handleUpdateDay}
                onDateChange={(d) => setSelectedDate(d)}
                onNavigateTab={handleSelectTab}
                configuration={systemConfiguration}
                aiEnabled={aiEnabled}
              />
            )}

            <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-400">Loading workspace…</div>}>
            {/* 2. Unified Track Workspace */}
            {['dsa', 'academics', 'workout', 'projects'].includes(activeTab) && (
              <TrackView
                day={currentDay}
                onUpdateDay={handleUpdateDay}
                initialSection={
                  activeTab === 'academics'
                    ? 'academics'
                    : activeTab === 'workout'
                    ? 'workout'
                    : activeTab === 'projects'
                    ? 'projects'
                    : 'dsa'
                }
                enabledModules={systemConfiguration.enabledModules}
                aiEnabled={aiEnabled}
              />
            )}

            {/* 3. Unified Insights & Review */}
            {['review', 'calendar', 'history'].includes(activeTab) && systemConfiguration.enabledModules.includes('insights') && (
              <InsightsView
                day={currentDay}
                allDays={allDays}
                historyComplete={historyComplete}
                historySource={historySource}
                historyLoading={historyLoadingMore}
                historyError={historyLoadError}
                onLoadOlderHistory={handleLoadOlderHistory}
                onUpdateDay={handleUpdateDay}
                aiEnabled={aiEnabled}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  handleSelectTab('today');
                }}
              />
            )}

            {/* 4. Settings */}
            {activeTab === 'settings' && (
              <SettingsView
                user={user}
                settings={settings}
                allDays={allDays}
                loadCompleteHistory={handleLoadCompleteBackupHistory}
                onSignOut={handleSignOut}
                onSignIn={handleSignIn}
                isSigningIn={isSigningIn}
                authError={authError}
                onClearAuthError={() => setAuthError(null)}
                onUpdateSettings={handleUpdateSettings}
                onImportBackup={async (
                  importedDays: Record<string, DayRecord>,
                  importedSettings?: Partial<UserSettings>,
                  mode: 'merge' | 'replace' = 'merge'
                ) => {
                  if (user && mode === 'replace') {
                    throw new Error('Replacing authenticated cloud history is unavailable because pending edits on other devices cannot be safely coordinated.');
                  }
                  const existingDays = mode === 'replace' ? {} : await handleLoadCompleteBackupHistory();
                  const finalDays = mode === 'replace'
                    ? { ...importedDays }
                    : mergeDayRecords(existingDays, importedDays);
                  let daysApplied = false;
                  if (user) {
                    const updates = Object.entries(importedDays)
                      .filter(([date, importedDay]) => finalDays[date] === importedDay)
                      .map(([date, updatedRecord]) => ({
                        baseRecord: existingDays[date] ?? createDefaultDayRecord(date, settings),
                        updatedRecord,
                      }));
                    await queueDayRecordUpdates(user.uid, updates);
                    if (updates.length) setSyncStatus('pending');
                  } else {
                    replaceGuestDayRecords(finalDays);
                  }
                  setAllDays((loaded) => mode === 'replace'
                    ? finalDays
                    : mergeDayRecords(loaded, importedDays));
                  if (finalDays[selectedDate]) updateCurrentDay(finalDays[selectedDate]);
                  daysApplied = true;
                  if (importedSettings) {
                    try {
                      await handleUpdateSettingsAndWait({ ...settings, ...importedSettings });
                    } catch (error) {
                      if (daysApplied) {
                        throw new Error(
                          `Daily records were imported and are saved${user ? ' for synchronization' : ' locally'}, but settings could not be saved: ${error instanceof Error ? error.message : 'unknown error'}`
                        );
                      }
                      throw error;
                    }
                  }
                }}
                onDeleteAccount={async () => {
                  if (user) {
                    try {
                      await reauthenticateForAccountDeletion(user.uid);
                      const worker = syncWorkerRef.current;
                      if (worker?.uid === user.uid) await worker.stop();
                      await deleteUserData(user.uid);
                    } catch (error) {
                      if (error instanceof AccountDeletionError) {
                        setAccountDeletionPending(true);
                        setAccountReady(false);
                      } else {
                        setAccountRetryCount((count) => count + 1);
                      }
                      throw error;
                    }
                  }
                  setAllDays({});
                  updateCurrentDay(createDefaultDayRecord(selectedDate, DEFAULT_SETTINGS));
                  handleSelectTab('today');
                }}
              />
            )}
            </Suspense>
              </>
            )}
          </main>
        </div>

        {/* Floating AI Omni-logger */}
        {aiEnabled && (aiAssistantMounted ? (
          <Suspense fallback={null}>
            <AiChatBubble
              initiallyOpen={aiAssistantInitiallyOpen}
              onInitialOpenConsumed={() => setAiAssistantInitiallyOpen(false)}
              day={currentDay}
              user={user}
              onUpdateDay={handleUpdateDay}
              settings={settings}
              onUpdateSettings={handleUpdateSettingsAndWait}
            />
          </Suspense>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAiAssistantInitiallyOpen(true);
              setAiAssistantMounted(true);
            }}
            aria-label="Open AI Command assistant"
            className="fixed bottom-20 md:bottom-8 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer font-medium text-xs tracking-wide"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>AI Command</span>
          </button>
        ))}

        {/* Multi-Agent Onboarding Calibration Modal (With Google Sign-in Linked) */}
        {showOnboarding && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-sm text-zinc-300">Loading onboarding…</div>}>
            <OnboardingModal
              day={currentDay}
              user={user}
              answers={onboardingAnswers}
              requirements={onboardingRequirements}
              initialStage={onboardingStage}
              onSignIn={handleSignIn}
              onAnswersChange={handleOnboardingAnswersChange}
              onRequirementsChange={handleOnboardingRequirementsChange}
              onStageChange={handleOnboardingStageChange}
              onSaveProgress={handleSaveOnboardingProgress}
              isSigningIn={isSigningIn}
              authError={authError}
              onComplete={async (
              calibratedDay,
              generatedSystem: GeneratedSystemArchetype,
              confirmedRequirements,
              onboardingConfiguration
            ) => {
              const validatedRequirements = validateOnboardingRequirements(confirmedRequirements);
              const validatedConfiguration = validateUserSystemConfiguration(onboardingConfiguration);
              if (!validatedRequirements?.userConfirmed || !validatedConfiguration) {
                throw new Error('Onboarding completion requires confirmed requirements and a valid system configuration.');
              }
              const expectedConfiguration = createSystemConfigurationFromRequirements(validatedRequirements);
              if (JSON.stringify(validatedConfiguration) !== JSON.stringify(expectedConfiguration)) {
                throw new Error('The system configuration does not match the confirmed onboarding requirements.');
              }
              const nextSettings: UserSettings = {
                ...settings,
                defaultWorkoutMode: calibratedDay.workout.mode,
                systemConfiguration: validatedConfiguration,
                dailySystem: {
                  workoutMode: calibratedDay.workout.mode,
                  schedule: generatedSystem.schedule,
                  habits: generatedSystem.habits,
                  nonNegotiables: generatedSystem.nonNegotiables,
                  workoutCycle: generatedSystem.workoutCycle,
                  workoutExercises: generatedSystem.workoutExercises,
                },
              };
              await handleUpdateSettingsAndWait(nextSettings);
              await handleUpdateDay(calibratedDay);
              if (user) {
                const progress = await markOnboardingCompleted(
                  user.uid,
                  calibratedDay.date,
                  validatedConfiguration
                );
                setOnboardingStatus(progress.status);
              } else {
                localStorage.setItem('daily_os_onboarded', 'true');
              }
              setOnboardingDismissed(true);
              }}
              onClose={() => setOnboardingDismissed(true)}
            />
          </Suspense>
        )}
      </div>
    </SmoothScrollProvider>
  );
}
