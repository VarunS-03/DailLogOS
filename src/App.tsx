import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthErrorInfo, AuthUser, DayRecord, UserSettings, TabType, SyncStatus } from './types';
import { DEFAULT_SETTINGS, createDefaultDayRecord, calculateCompletionPercentage } from './constants/templates';
import {
  subscribeToAuth,
  signInWithGoogle,
  signOutUser,
  loadDayRecord,
  saveDayRecord,
  subscribeToDayRecord,
  loadAllDaysFromStorage,
  loadUserSettings,
  saveUserSettings,
  clearUserLocalCache,
  deleteUserData,
  isFirebaseConfigured,
  AppAuthError,
} from './firebase';
import { Navigation } from './components/Navigation';
import { TodayDashboard } from './components/TodayDashboard';
import { TrackView } from './components/TrackView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { AiChatBubble } from './components/AiChatBubble';
import { FluidBackground } from './components/FluidBackground';
import { SmoothScrollProvider } from './components/SmoothScrollProvider';
import { OnboardingModal } from './components/OnboardingModal';
import { GeneratedSystemArchetype } from './services/onboardingPipeline';
import { getLocalDateId, addDaysToDateId } from './utils/localDate';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase();
    if (['today', 'dsa', 'academics', 'workout', 'projects', 'review', 'calendar', 'history', 'settings'].includes(path)) {
      return path as TabType;
    }
    return 'today';
  });

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  // Active Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateId());

  // Current Day Record
  const [currentDay, setCurrentDay] = useState<DayRecord>(() => {
    return createDefaultDayRecord(getLocalDateId(), DEFAULT_SETTINGS);
  });

  // Yesterday's record for context & morning briefing momentum
  const [yesterdayRecord, setYesterdayRecord] = useState<DayRecord | null>(null);

  // All days cache
  const [allDays, setAllDays] = useState<Record<string, DayRecord>>({});

  // Settings with persistent wallpaper & styling
  const [settings, setSettings] = useState<UserSettings>(() => DEFAULT_SETTINGS);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Onboarding Modal Visibility
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem('daily_os_onboarded');
  });

  // Debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectTab = (newTab: TabType) => {
    setActiveTab(newTab);
    const newPath = newTab === 'today' ? '/' : `/${newTab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // Auth subscription
  useEffect(() => {
    const unsub = subscribeToAuth((authUser) => {
      setUser(authUser);
    });
    return () => unsub();
  }, []);

  // Load stored days
  useEffect(() => {
    const stored = user ? loadAllDaysFromStorage(user.uid) : {};
    setAllDays(stored);
  }, [user]);

  // Load user settings including custom wallpaper
  useEffect(() => {
    if (!user) {
      // Check local storage for guest settings
      const local = localStorage.getItem('daily_os_guest_settings');
      if (local) {
        try {
          setSettings(JSON.parse(local));
        } catch (_) {}
      }
      return;
    }
    loadUserSettings(user.uid).then((stored) => {
      if (stored) {
        setSettings(stored);
      }
    });
  }, [user]);

  // Load day record
  useEffect(() => {
    let isMounted = true;

    async function fetchDays() {
      setSyncStatus('syncing');
      try {
        const record = await loadDayRecord(user ? user.uid : null, selectedDate, settings);
        const yDate = addDaysToDateId(selectedDate, -1);
        const yRec = await loadDayRecord(user ? user.uid : null, yDate, settings);

        if (isMounted) {
          setCurrentDay(record);
          setYesterdayRecord(yRec);
          setAllDays((prev) => ({ ...prev, [selectedDate]: record }));
          setSyncStatus('synced');
        }
      } catch (err) {
        console.error('Failed to load day record:', err);
        if (isMounted) setSyncStatus('idle');
      }
    }

    fetchDays();

    let unsubSnapshot: (() => void) | null = null;
    if (user && isFirebaseConfigured) {
      unsubSnapshot = subscribeToDayRecord(user.uid, selectedDate, (updated) => {
        if (isMounted && updated) {
          setCurrentDay(updated);
          setAllDays((prev) => ({ ...prev, [selectedDate]: updated }));
        }
      });
    }

    return () => {
      isMounted = false;
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [selectedDate, user, settings]);

  // Save updates with debounce
  const handleUpdateDay = useCallback(
    (updatedDay: DayRecord): Promise<void> => {
      const dayWithScore = {
        ...updatedDay,
        completionPercentage: calculateCompletionPercentage(updatedDay),
        updatedAt: new Date().toISOString(),
      };

      setCurrentDay(dayWithScore);
      setAllDays((prev) => ({ ...prev, [dayWithScore.date]: dayWithScore }));
      setSyncStatus('syncing');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      return new Promise((resolve, reject) => {
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            await saveDayRecord(user ? user.uid : null, dayWithScore);
            setSyncStatus('synced');
            resolve();
          } catch (err) {
            console.error('Error auto-saving day:', err);
            setSyncStatus('error');
            reject(err);
          }
        }, 500);
      });
    },
    [user]
  );

  const persistSettings = async (newSettings: UserSettings) => {
    if (user) {
      await saveUserSettings(user.uid, newSettings);
    } else {
      localStorage.setItem('daily_os_guest_settings', JSON.stringify(newSettings));
    }
  };

  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    void persistSettings(newSettings).catch((err) => {
      console.error('Failed to save user settings:', err);
    });
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const authUser = await signInWithGoogle();
      setUser(authUser);
    } catch (err: unknown) {
      if (err instanceof AppAuthError) setAuthError(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser(user ? user.uid : null);
      setUser(null);
      setAllDays({});
      setSettings(DEFAULT_SETTINGS);
      setCurrentDay(createDefaultDayRecord(selectedDate, DEFAULT_SETTINGS));
    } catch (err) {
      console.warn('Sign-out error:', err);
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
            isSynced={syncStatus === 'synced'}
            completionRate={currentDay.completionPercentage}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
            {/* 1. Today Command Center */}
            {activeTab === 'today' && (
              <TodayDashboard
                day={currentDay}
                yesterday={yesterdayRecord}
                onUpdateDay={handleUpdateDay}
                onDateChange={(d) => setSelectedDate(d)}
                onNavigateTab={handleSelectTab}
              />
            )}

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
              />
            )}

            {/* 3. Unified Insights & Review */}
            {['review', 'calendar', 'history'].includes(activeTab) && (
              <InsightsView
                day={currentDay}
                allDays={allDays}
                onUpdateDay={handleUpdateDay}
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
                onSignOut={handleSignOut}
                onSignIn={handleSignIn}
                isSigningIn={isSigningIn}
                authError={authError}
                onClearAuthError={() => setAuthError(null)}
                onUpdateSettings={handleUpdateSettings}
                onImportBackup={(importedDays: Record<string, DayRecord>, importedSettings?: UserSettings) => {
                  setAllDays(importedDays);
                  Object.values(importedDays).forEach((day) => saveDayRecord(user ? user.uid : null, day));
                  if (importedDays[selectedDate]) setCurrentDay(importedDays[selectedDate]);
                  if (importedSettings) handleUpdateSettings(importedSettings);
                }}
                onDeleteAccount={async () => {
                  if (user) {
                    await deleteUserData(user.uid);
                    clearUserLocalCache(user.uid);
                  }
                  setAllDays({});
                  setCurrentDay(createDefaultDayRecord(selectedDate, DEFAULT_SETTINGS));
                  handleSelectTab('today');
                }}
              />
            )}
          </main>
        </div>

        {/* Floating AI Omni-logger */}
        <AiChatBubble day={currentDay} onUpdateDay={handleUpdateDay} />

        {/* Multi-Agent Onboarding Calibration Modal (With Google Sign-in Linked) */}
        {showOnboarding && (
          <OnboardingModal
            day={currentDay}
            user={user}
            onSignIn={handleSignIn}
            isSigningIn={isSigningIn}
            authError={authError}
            onComplete={async (calibratedDay, generatedSystem: GeneratedSystemArchetype) => {
              const nextSettings: UserSettings = {
                ...settings,
                defaultWorkoutMode: calibratedDay.workout.mode,
                dailySystem: {
                  workoutMode: calibratedDay.workout.mode,
                  schedule: generatedSystem.schedule,
                  habits: generatedSystem.habits,
                  nonNegotiables: generatedSystem.nonNegotiables,
                  workoutCycle: generatedSystem.workoutCycle,
                  workoutExercises: generatedSystem.workoutExercises,
                },
              };
              setSettings(nextSettings);
              await persistSettings(nextSettings);
              await handleUpdateDay(calibratedDay);
              setShowOnboarding(false);
            }}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </div>
    </SmoothScrollProvider>
  );
}
