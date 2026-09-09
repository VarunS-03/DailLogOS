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
  deleteUserData,
  isFirebaseConfigured,
  AppAuthError,
} from './firebase';
import { Navigation } from './components/Navigation';
import { DateContextBar } from './components/DateContextBar';
import { TodayDashboard } from './components/TodayDashboard';
import { AcademicsView } from './components/AcademicsView';
import { DsaView } from './components/DsaView';
import { WorkoutView } from './components/WorkoutView';
import { ProjectsView } from './components/ProjectsView';
import { ScheduleView } from './components/ScheduleView';
import { DailyReviewView } from './components/DailyReviewView';
import { CalendarView } from './components/CalendarView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

// Valid routes
const VALID_TABS: TabType[] = [
  'today',
  'academics',
  'dsa',
  'projects',
  'workout',
  'schedule',
  'calendar',
  'review',
  'history',
  'settings',
];

export default function App() {
  // Initialize active tab from pathname
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase();
    if (VALID_TABS.includes(path as TabType)) {
      return path as TabType;
    }
    return 'today';
  });

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const authUser = await signInWithGoogle();
      setUser(authUser);
    } catch (err: unknown) {
      if (err instanceof AppAuthError) {
        setAuthError(err);
      } else {
        const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
        setAuthError({
          code: 'auth/unknown',
          category: 'Authentication Error',
          message,
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser(user ? user.uid : null);
      setUser(null);
    } catch (err) {
      console.warn('Sign-out error:', err);
    }
  };

  const handleClearAuthError = () => {
    setAuthError(null);
  };

  // Active Date State (Preserved across all navigation!)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Current Day Record (Single source of truth)
  const [currentDay, setCurrentDay] = useState<DayRecord>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return createDefaultDayRecord(todayStr, DEFAULT_SETTINGS);
  });

  // All days cache for Cross-Day References, Calendar & History
  const [allDays, setAllDays] = useState<Record<string, DayRecord>>({});

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem('daily_os_settings');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Debounce ref for auto-saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Listen to browser popstate (back / forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/+/, '').toLowerCase();
      if (VALID_TABS.includes(path as TabType)) {
        setActiveTab(path as TabType);
      } else {
        setActiveTab('today');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update browser URL on tab switch
  const handleSelectTab = (newTab: TabType) => {
    setActiveTab(newTab);
    const newPath = newTab === 'today' ? '/' : `/${newTab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // 1. Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((authUser) => {
      setUser(authUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load all stored days on mount
  useEffect(() => {
    const stored = loadAllDaysFromStorage();
    setAllDays(stored);
  }, []);

  // 3. Load or subscribe to day record when selectedDate or user changes
  useEffect(() => {
    let isMounted = true;
    isInitialLoadRef.current = true;

    async function fetchDay() {
      setSyncStatus('syncing');
      try {
        const record = await loadDayRecord(user ? user.uid : null, selectedDate, settings);
        if (isMounted) {
          setCurrentDay(record);
          setAllDays((prev) => ({ ...prev, [selectedDate]: record }));
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to load day record:', err);
        if (isMounted) {
          setSyncStatus('idle');
        }
      } finally {
        if (isMounted) {
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 300);
        }
      }
    }

    fetchDay();

    // Setup real-time listener if user is authenticated and Firestore is active
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
  }, [selectedDate, user]);

  // 4. Save updates to Day Record with debounce (Single Source of Truth)
  const handleUpdateDay = useCallback(
    (updatedDay: DayRecord) => {
      const dayWithScore = {
        ...updatedDay,
        completionPercentage: calculateCompletionPercentage(updatedDay),
        updatedAt: new Date().toISOString(),
      };

      setCurrentDay(dayWithScore);
      setAllDays((prev) => ({ ...prev, [dayWithScore.date]: dayWithScore }));

      // Update local sync status immediately
      setSyncStatus('syncing');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveDayRecord(user ? user.uid : null, dayWithScore);
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toLocaleTimeString());
        } catch (err) {
          console.error('Error auto-saving day:', err);
          setSyncStatus('error');
        }
      }, 600);
    },
    [user]
  );

  // 5. Switch Date (Preserves active tab or routes as directed)
  const handleDateChange = (newDateStr: string, targetTab?: TabType) => {
    setSelectedDate(newDateStr);
    if (targetTab) {
      handleSelectTab(targetTab);
    }
  };

  // 6. Settings updates
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem('daily_os_settings', JSON.stringify(newSettings));
  };

  // 7. Backup Import
  const handleImportBackup = (importedDays: Record<string, DayRecord>, importedSettings?: UserSettings) => {
    setAllDays(importedDays);
    Object.values(importedDays).forEach((day) => {
      saveDayRecord(user ? user.uid : null, day);
    });
    if (importedSettings) {
      handleUpdateSettings(importedSettings);
    }
    if (importedDays[selectedDate]) {
      setCurrentDay(importedDays[selectedDate]);
    }
  };

  // 8. Delete Account
  const handleDeleteAccount = async () => {
    if (user) {
      await deleteUserData(user.uid);
    }
    localStorage.clear();
    setAllDays({});
    const todayStr = new Date().toISOString().split('T')[0];
    const freshDay = createDefaultDayRecord(todayStr, DEFAULT_SETTINGS);
    setCurrentDay(freshDay);
    setSettings(DEFAULT_SETTINGS);
    handleSelectTab('today');
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-zinc-700 selection:text-white">
      {/* Navigation Sidebar (Desktop) / Mobile Bottom Bar */}
      <Navigation
        currentTab={activeTab}
        onSelectTab={handleSelectTab}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isSigningIn={isSigningIn}
        authError={authError}
        onClearAuthError={handleClearAuthError}
        isSynced={syncStatus === 'synced'}
        completionRate={currentDay.completionPercentage}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky Date Context Bar on dedicated views */}
        <DateContextBar
          selectedDate={selectedDate}
          dayOfWeek={currentDay.dayOfWeek}
          activeTab={activeTab}
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onDateChange={(d) => handleDateChange(d)}
          onNavigateTab={handleSelectTab}
        />

        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {/* 1. Today Command Center */}
          {activeTab === 'today' && (
            <TodayDashboard
              day={currentDay}
              onUpdateDay={handleUpdateDay}
              onDateChange={(d) => handleDateChange(d)}
              onNavigateTab={handleSelectTab}
            />
          )}

          {/* 2. Academics Workspace */}
          {activeTab === 'academics' && (
            <AcademicsView
              day={currentDay}
              allDays={allDays}
              onUpdateAcademics={(academics) =>
                handleUpdateDay({ ...currentDay, academics })
              }
              onSelectDate={(d) => handleDateChange(d)}
            />
          )}

          {/* 3. DSA Workspace */}
          {activeTab === 'dsa' && (
            <DsaView
              day={currentDay}
              allDays={allDays}
              onUpdateProblems={(dsa) => handleUpdateDay({ ...currentDay, dsa })}
              onSelectDate={(d) => handleDateChange(d)}
            />
          )}

          {/* 4. Workout Workspace */}
          {activeTab === 'workout' && (
            <WorkoutView
              day={currentDay}
              onUpdateWorkout={(workout) =>
                handleUpdateDay({ ...currentDay, workout })
              }
            />
          )}

          {/* 5. Projects Workspace */}
          {activeTab === 'projects' && (
            <ProjectsView
              day={currentDay}
              onUpdateProject={(project) =>
                handleUpdateDay({ ...currentDay, project })
              }
              onUpdateSkills={(skills) =>
                handleUpdateDay({ ...currentDay, skills })
              }
            />
          )}

          {/* 6. Schedule Workspace */}
          {activeTab === 'schedule' && (
            <ScheduleView
              day={currentDay}
              onUpdateSchedule={(schedule) =>
                handleUpdateDay({ ...currentDay, schedule })
              }
            />
          )}

          {/* 7. Daily Review Workspace */}
          {activeTab === 'review' && (
            <DailyReviewView
              day={currentDay}
              onUpdateReflection={(dailyReflection) =>
                handleUpdateDay({ ...currentDay, dailyReflection })
              }
              onUpdateStats={(updates) =>
                handleUpdateDay({ ...currentDay, ...updates })
              }
            />
          )}

          {/* 8. Calendar Dispatch */}
          {activeTab === 'calendar' && (
            <CalendarView
              allDays={allDays}
              onSelectDate={(d) => handleDateChange(d, 'today')}
            />
          )}

          {/* 9. History Logs */}
          {activeTab === 'history' && (
            <HistoryView
              allDays={allDays}
              onSelectDate={(d) => handleDateChange(d, 'today')}
            />
          )}

          {/* 10. Settings & Preferences */}
          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              settings={settings}
              allDays={allDays}
              onSignOut={handleSignOut}
              onSignIn={handleSignIn}
              isSigningIn={isSigningIn}
              authError={authError}
              onClearAuthError={handleClearAuthError}
              onUpdateSettings={handleUpdateSettings}
              onImportBackup={handleImportBackup}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </main>
      </div>
    </div>
  );
}
