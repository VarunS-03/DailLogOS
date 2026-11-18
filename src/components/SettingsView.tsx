import React, { useState } from 'react';
import {
  Settings,
  User,
  LogOut,
  Download,
  Upload,
  Trash2,
  ShieldAlert,
  Check,
  AlertTriangle,
  FileCheck,
  Lock,
  Loader2,
  Copy,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  AuthErrorInfo,
  AuthUser,
  CustomTrackerDefinition,
  DashboardWidgetId,
  DayRecord,
  SystemModuleId,
  UserSettings,
} from '../types';
import { DAYS_OF_WEEK } from '../constants/templates';
import { isFirebaseConfigured, getFirebaseAuthDiagnostics } from '../firebase';
import { validateAndSanitizeBackup, ValidationResult } from '../utils/backupValidation';
import { getLocalDateId } from '../utils/localDate';
import {
  DASHBOARD_WIDGET_REGISTRY,
  getSystemConfiguration,
  SYSTEM_MODULE_REGISTRY,
} from '../services/systemConfiguration';

interface SettingsViewProps {
  user: AuthUser | null;
  settings: UserSettings;
  allDays: Record<string, DayRecord>;
  loadCompleteHistory: () => Promise<Record<string, DayRecord>>;
  onSignOut: () => void;
  onSignIn: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onImportBackup: (
    days: Record<string, DayRecord>,
    settings: Partial<UserSettings> | undefined,
    mode: 'merge' | 'replace'
  ) => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onClearAuthError?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  settings,
  allDays,
  loadCompleteHistory,
  onSignOut,
  onSignIn,
  onUpdateSettings,
  onImportBackup,
  onDeleteAccount,
  isSigningIn = false,
  authError = null,
  onClearAuthError,
}) => {
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ValidationResult | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [trackerName, setTrackerName] = useState('');
  const [trackerUnit, setTrackerUnit] = useState('');
  const [trackerTarget, setTrackerTarget] = useState('');
  const diagnostics = getFirebaseAuthDiagnostics();
  const systemConfiguration = getSystemConfiguration(settings.systemConfiguration);

  const updateSystemConfiguration = (
    update: Partial<typeof systemConfiguration>
  ) => {
    onUpdateSettings({
      ...settings,
      systemConfiguration: { ...systemConfiguration, ...update },
    });
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      setShowDeleteConfirm(false);
      setDeleteConfirmationText('');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account deletion could not be completed. Retry to continue.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export a plaintext backup; this is intentionally not described as encrypted.
  const handleExportData = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const completeDays = await loadCompleteHistory();
      const backupData = {
        schemaVersion: 1,
        manifest: 'Daily OS plaintext personal backup',
        exportDate: new Date().toISOString(),
        recordCount: Object.keys(completeDays).length,
        settings,
        days: completeDays,
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('This backup exceeds the 5MB import limit. Remove large wallpaper images or export less history before trying again.');
      }

      const objectUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = objectUrl;
      downloadAnchor.download = `daily-os-backup-${getLocalDateId()}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setShowExportWarning(true);
      setTimeout(() => setShowExportWarning(false), 8000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The backup could not be exported.');
    } finally {
      setIsExporting(false);
    }
  };

  // Safe file reader & schema validator
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files larger than 5MB
    if (file.size > 5 * 1024 * 1024) {
      setImportError('File size exceeds safe threshold (max 5MB). Operation rejected.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const validation = validateAndSanitizeBackup(content);
        if (!validation.valid || !validation.sanitizedDays) {
          setImportError(validation.error || 'Invalid backup structure.');
          return;
        }

        // Stage the sanitized payload for user confirmation
        setPendingImport(validation);
      } catch {
        setImportError('Failed to parse backup file: Invalid or corrupted JSON structure.');
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file from local storage.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Confirm and apply import
  const executeImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport || !pendingImport.sanitizedDays) return;

    try {
      await onImportBackup(pendingImport.sanitizedDays, pendingImport.sanitizedSettings, mode);
      setImportStatus(
        `Successfully ${mode === 'replace' ? 'replaced' : 'merged'} ${
          Object.keys(pendingImport.sanitizedDays).length
        } imported daily records.`
      );
      setPendingImport(null);
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err) {
      console.error('Backup import failed:', err);
      setImportError(err instanceof Error ? err.message : 'Backup data could not be saved.');
    }
  };

  // Update academic schedule item
  const updateRotationDay = (day: string, field: 'primary' | 'secondary', value: string) => {
    const currentRot = settings.academicSchedule || {};
    const dayRot = currentRot[day] || { primary: '', secondary: '' };
    onUpdateSettings({
      ...settings,
      academicSchedule: {
        ...currentRot,
        [day]: {
          ...dayRot,
          [field]: value.slice(0, 100),
        },
      },
    });
  };

  const toggleModule = (moduleId: SystemModuleId, enabled: boolean) => {
    const enabledModules = enabled
      ? [...systemConfiguration.enabledModules, moduleId]
      : systemConfiguration.enabledModules.filter((id) => id !== moduleId);
    updateSystemConfiguration({ enabledModules });
  };

  const toggleWidget = (widgetId: DashboardWidgetId, enabled: boolean) => {
    const dashboardLayout = enabled
      ? [...systemConfiguration.dashboardLayout, widgetId]
      : systemConfiguration.dashboardLayout.filter((id) => id !== widgetId);
    updateSystemConfiguration({ dashboardLayout });
  };

  const moveWidget = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= systemConfiguration.dashboardLayout.length) return;
    const dashboardLayout = [...systemConfiguration.dashboardLayout];
    [dashboardLayout[index], dashboardLayout[nextIndex]] = [dashboardLayout[nextIndex], dashboardLayout[index]];
    updateSystemConfiguration({ dashboardLayout });
  };

  const addCustomTracker = () => {
    const name = trackerName.trim();
    if (!name || systemConfiguration.customTrackers.length >= 10) return;
    const target = trackerTarget.trim() ? Number(trackerTarget) : undefined;
    if (target !== undefined && (!Number.isFinite(target) || target < 0 || target > 100000)) return;
    const id = `tracker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    updateSystemConfiguration({
      customTrackers: [
        ...systemConfiguration.customTrackers,
        {
          id,
          name: name.slice(0, 50),
          unit: trackerUnit.trim().slice(0, 20),
          ...(target !== undefined ? { dailyTarget: target } : {}),
        },
      ],
    });
    setTrackerName('');
    setTrackerUnit('');
    setTrackerTarget('');
  };

  const updateCustomTracker = (tracker: CustomTrackerDefinition) => {
    const updatedTracker = { ...tracker };
    if (updatedTracker.dailyTarget === undefined) delete updatedTracker.dailyTarget;
    updateSystemConfiguration({
      customTrackers: systemConfiguration.customTrackers.map((item) =>
        item.id === tracker.id ? updatedTracker : item
      ),
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1f2430]">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
            SYSTEM CONFIGURATION
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Preferences & Data</h1>
      </div>

      {/* Account Section */}
      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534]">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-zinc-400" />
          <span>Account & Cloud Authentication</span>
        </h2>

        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 bg-[#0e1118] border border-[#1f2433] rounded-lg">
            <div className="flex items-center space-x-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  className="w-10 h-10 rounded-full border border-zinc-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-200">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-zinc-100">
                  {user.displayName || 'Personal Account'}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  {user.email || 'Authorized User'}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  Authenticated User Space: Active
                </div>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Clear Session</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {authError && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-800/70 text-red-200 text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      {typeof authError === 'object' && authError.category && (
                        <div className="font-semibold text-red-300">
                          {authError.category} {authError.code ? `(${authError.code})` : ''}
                        </div>
                      )}
                      <div className="text-red-200 mt-0.5">
                        {typeof authError === 'string' ? authError : authError.message}
                      </div>
                    </div>
                  </div>
                  {onClearAuthError && (
                    <button
                      onClick={onClearAuthError}
                      className="text-red-400 hover:text-red-200 text-xs font-mono shrink-0 cursor-pointer p-1"
                      title="Dismiss error"
                    >
                      Dismiss
                    </button>
                  )}
                </div>

                {typeof authError === 'object' && authError.hostname && (
                  <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-lg space-y-2 text-[11px]">
                    <div className="font-semibold text-zinc-100 flex items-center justify-between">
                      <span>Exact Domain to Authorize in Firebase Console:</span>
                      <button
                        onClick={() => handleCopy(authError.hostname!)}
                        className="px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-mono text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedDomain ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Hostname</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono bg-black/40 px-2.5 py-1.5 rounded border border-red-950 text-red-200 select-all break-all">
                      {authError.hostname}
                    </div>
                    <div className="text-zinc-300 text-[10px] space-y-0.5">
                      <p className="font-semibold text-zinc-200">How to fix:</p>
                      <p>1. Open <a href={`https://console.firebase.google.com/project/${diagnostics.projectId || '_'}/authentication/settings`} target="_blank" rel="noreferrer" className="underline text-red-300 hover:text-white inline-flex items-center gap-0.5">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains <ExternalLink className="w-2.5 h-2.5" /></a></p>
                      <p>2. Click <span className="font-semibold text-zinc-200">Add domain</span> and paste the copied hostname above.</p>
                      <p>3. Return here and click <span className="font-semibold text-zinc-200">Sign In with Google</span>.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="p-4 bg-[#0e1118] border border-[#1f2433] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Sign-in Required</div>
                <div className="text-[11px] text-zinc-400">
                  Sign in with your authorized Google Account to access your personal records and sync
                  across devices.
                </div>
                {!isFirebaseConfigured && (
                  <div className="text-[10px] text-amber-400/90 font-mono mt-1">
                    Note: VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID required for cloud sync.
                  </div>
                )}
              </div>
              <button
                onClick={onSignIn}
                disabled={isSigningIn}
                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2 cursor-pointer ${
                  isSigningIn
                    ? 'bg-zinc-300 text-zinc-700 cursor-not-allowed'
                    : 'bg-zinc-100 hover:bg-white text-zinc-900 active:scale-[0.98]'
                }`}
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-700" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Sign In with Google</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cloud Persistence & Diagnostics Section */}
        <div className="mt-3 pt-3 border-t border-[#1e2330] space-y-2">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isFirebaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span>
                Cloud Firestore:{' '}
                {isFirebaseConfigured ? 'Connected & Enforced via Security Rules' : 'Ready for Cloud Deployment'}
              </span>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Globe className="w-3 h-3 text-zinc-400" />
                <span>{showDiagnostics ? 'Hide OAuth Info' : 'OAuth Domain Info'}</span>
              </button>
              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-zinc-400" />
                <span>Private User Isolation</span>
              </span>
            </div>
          </div>

          {/* Collapsible OAuth Diagnostics */}
          {showDiagnostics && (
            <div className="p-3 bg-[#0a0d14] border border-[#1b202c] rounded-lg text-[11px] space-y-2 font-mono text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">Active Preview Hostname</span>
                <button
                  onClick={() => handleCopy(diagnostics.currentHostname)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedDomain ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800 text-zinc-200 break-all select-all text-[11px]">
                {diagnostics.currentHostname || 'Not available'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-zinc-400 pt-1">
                <div>
                  <span className="text-zinc-500">Firebase Project ID: </span>
                  <span className="text-zinc-300">{diagnostics.projectId || 'Not detected'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Auth Handler Domain: </span>
                  <span className="text-zinc-300">{diagnostics.authDomain || 'Default'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Custom Wallpaper Section */}
      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200 flex items-center gap-2">
          <span>Custom Wallpaper & Atmosphere</span>
        </h2>
        <p className="text-xs text-zinc-400">
          Personalize your daily dashboard with your own aesthetic wallpaper. The image remains securely stored in your local browser profile.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Wallpaper Image (Upload File or Enter Image URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="https://images.unsplash.com/... or paste image URL"
                value={settings.customWallpaper || ''}
                onChange={(e) => onUpdateSettings({ ...settings, customWallpaper: e.target.value })}
                className="flex-1 px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const dataUrl = event.target?.result as string;
                        if (dataUrl) {
                          onUpdateSettings({ ...settings, customWallpaper: dataUrl });
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
              {settings.customWallpaper && (
                <button
                  onClick={() => onUpdateSettings({ ...settings, customWallpaper: '' })}
                  className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs rounded-lg border border-red-800/40 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {settings.customWallpaper && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <div className="flex justify-between text-xs text-zinc-300 mb-1">
                  <span>Glass Blur Effect</span>
                  <span className="font-mono text-zinc-400">{settings.wallpaperBlur ?? 6}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={settings.wallpaperBlur ?? 6}
                  onChange={(e) => onUpdateSettings({ ...settings, wallpaperBlur: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-zinc-300 mb-1">
                  <span>Background Dimming</span>
                  <span className="font-mono text-zinc-400">{settings.wallpaperDim ?? 40}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="85"
                  value={settings.wallpaperDim ?? 40}
                  onChange={(e) => onUpdateSettings({ ...settings, wallpaperDim: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Preferences Section */}
      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
          Preferences & Routines
        </h2>

        {/* Default Workout Mode */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Default Workout Discipline
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdateSettings({ ...settings, defaultWorkoutMode: 'gym' })}
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                settings.defaultWorkoutMode === 'gym'
                  ? 'bg-[#181e2b] border-zinc-500 text-zinc-100 font-semibold'
                  : 'bg-[#0e1118] border-[#1e2330] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="font-semibold">Gym Weights (3-Day Cycle)</div>
              <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                Incline DB Press, Overhead Press, Rows, Squats, Romanian Deadlifts
              </div>
            </button>

            <button
              onClick={() => onUpdateSettings({ ...settings, defaultWorkoutMode: 'home' })}
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                settings.defaultWorkoutMode === 'home'
                  ? 'bg-[#181e2b] border-zinc-500 text-zinc-100 font-semibold'
                  : 'bg-[#0e1118] border-[#1e2330] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="font-semibold">Home Calisthenics (3-Day Cycle)</div>
              <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                Push-ups, Pike push-ups, Dead hang, Planche lean, Pistols, L-sits
              </div>
            </button>
          </div>
        </div>

        {/* Academic Weekly Rotation */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-2">
            Weekly Academic Subject Rotation (06:00–07:30 Block)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const rot = settings.academicSchedule?.[day] || { primary: '', secondary: '' };
              return (
                <div
                  key={day}
                  className="p-2.5 rounded-lg bg-[#0e1118] border border-[#1f2433] flex items-center justify-between text-xs gap-2"
                >
                  <span className="font-mono text-zinc-400 w-24 shrink-0 font-medium">{day}</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      placeholder="Primary"
                      maxLength={100}
                      value={rot.primary}
                      onChange={(e) => updateRotationDay(day, 'primary', e.target.value)}
                      className="w-full px-2 py-0.5 bg-[#131620] border border-[#232938] rounded text-[11px] text-zinc-200"
                    />
                    <input
                      type="text"
                      placeholder="Secondary"
                      maxLength={100}
                      value={rot.secondary}
                      onChange={(e) => updateRotationDay(day, 'secondary', e.target.value)}
                      className="w-full px-2 py-0.5 bg-[#131620] border border-[#232938] rounded text-[11px] text-zinc-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">System Configuration</h2>
          <p className="text-xs text-zinc-500 mt-1">Choose enabled workspaces, dashboard widgets, goals, and AI behavior.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-300">Modules</h3>
          {SYSTEM_MODULE_REGISTRY.map((module) => (
            <label key={module.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#0e1118] border border-[#1f2433] cursor-pointer">
              <input
                type="checkbox"
                checked={systemConfiguration.enabledModules.includes(module.id)}
                onChange={(event) => toggleModule(module.id, event.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <span>
                <span className="block text-xs text-zinc-200">{module.label}</span>
                <span className="block text-[11px] text-zinc-500">{module.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-300">Dashboard widgets</h3>
          {DASHBOARD_WIDGET_REGISTRY.map((widget) => (
            <label key={widget.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0e1118] border border-[#1f2433] cursor-pointer">
              <input
                type="checkbox"
                checked={systemConfiguration.dashboardLayout.includes(widget.id)}
                onChange={(event) => toggleWidget(widget.id, event.target.checked)}
                className="accent-indigo-500"
              />
              <span className="flex-1">
                <span className="block text-xs text-zinc-200">{widget.label}</span>
                <span className="block text-[11px] text-zinc-500">{widget.description}</span>
              </span>
            </label>
          ))}
          <ol className="space-y-1">
            {systemConfiguration.dashboardLayout.map((widgetId, index) => (
              <li key={widgetId} className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="flex-1">{index + 1}. {DASHBOARD_WIDGET_REGISTRY.find((item) => item.id === widgetId)?.label}</span>
                <button type="button" disabled={index === 0} onClick={() => moveWidget(index, -1)} className="px-2 py-1 rounded bg-[#202534] disabled:opacity-40">Up</button>
                <button type="button" disabled={index === systemConfiguration.dashboardLayout.length - 1} onClick={() => moveWidget(index, 1)} className="px-2 py-1 rounded bg-[#202534] disabled:opacity-40">Down</button>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-300">Goals</h3>
          <input
            type="text"
            maxLength={500}
            value={systemConfiguration.goals.primary}
            onChange={(event) => updateSystemConfiguration({
              goals: { ...systemConfiguration.goals, primary: event.target.value },
            })}
            placeholder="Primary goal"
            className="w-full px-3 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200"
          />
          <textarea
            rows={3}
            maxLength={1000}
            value={systemConfiguration.goals.secondary.join('\n')}
            onChange={(event) => updateSystemConfiguration({
              goals: {
                ...systemConfiguration.goals,
                secondary: event.target.value.split('\n').map((goal) => goal.trim().slice(0, 200)).filter(Boolean).slice(0, 5),
              },
            })}
            placeholder="Supporting goals, one per line (up to 5)"
            className="w-full px-3 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-300">Custom daily trackers</h3>
          {systemConfiguration.customTrackers.map((tracker) => (
            <div key={tracker.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-xs text-zinc-200">{tracker.name}</span>
              <input
                aria-label="Tracker unit"
                maxLength={20}
                value={tracker.unit}
                onChange={(event) => updateCustomTracker({ ...tracker, unit: event.target.value })}
                placeholder="Unit"
                className="w-24 px-2 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200"
              />
              <input
                aria-label="Daily target"
                type="number"
                min="0"
                max="100000"
                step="any"
                value={tracker.dailyTarget ?? ''}
                onChange={(event) => {
                  if (event.target.value === '') {
                    updateCustomTracker({ ...tracker, dailyTarget: undefined });
                  } else {
                    const target = Number(event.target.value);
                    if (Number.isFinite(target) && target >= 0 && target <= 100000) {
                      updateCustomTracker({ ...tracker, dailyTarget: target });
                    }
                  }
                }}
                placeholder="Target"
                className="w-24 px-2 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200"
              />
              <button
                type="button"
                onClick={() => updateSystemConfiguration({
                  customTrackers: systemConfiguration.customTrackers.filter((item) => item.id !== tracker.id),
                })}
                className="px-2 py-2 rounded-lg bg-red-950/40 text-red-300 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={trackerName} maxLength={50} onChange={(event) => setTrackerName(event.target.value)} placeholder="Tracker name" className="min-w-0 flex-1 px-2 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200" />
            <input value={trackerUnit} maxLength={20} onChange={(event) => setTrackerUnit(event.target.value)} placeholder="Unit" className="w-24 px-2 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200" />
            <input value={trackerTarget} type="number" min="0" max="100000" step="any" onChange={(event) => setTrackerTarget(event.target.value)} placeholder="Target" className="w-24 px-2 py-2 rounded-lg bg-[#0e1118] border border-[#1f2433] text-xs text-zinc-200" />
            <button type="button" onClick={addCustomTracker} disabled={!trackerName.trim() || systemConfiguration.customTrackers.length >= 10 || (trackerTarget !== '' && (!Number.isFinite(Number(trackerTarget)) || Number(trackerTarget) < 0 || Number(trackerTarget) > 100000))} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs disabled:opacity-40">Add</button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={systemConfiguration.aiBehavior === 'enabled'}
            onChange={(event) => updateSystemConfiguration({ aiBehavior: event.target.checked ? 'enabled' : 'disabled' })}
            className="accent-indigo-500"
          />
          Enable AI-powered features
        </label>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          When a Gemini feature runs, it sends that feature's prompt and relevant day or onboarding details to Google. A key entered in the app stays in this browser; requests are processed by Google.
        </p>
      </section>

      {/* Data Management Section */}
      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
          Data Portability & Backup
        </h2>

        {/* Export Privacy Warning Banner */}
        {showExportWarning && (
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-200 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Privacy Notice</span>
              This JSON backup is not encrypted. It contains day history and settings, including any
              custom wallpaper image data. Raw onboarding questionnaire answers and credentials are
              not included. Store the file securely.
            </div>
          </div>
        )}
        {exportError && (
          <div className="p-2.5 bg-red-950/30 border border-red-900/50 text-red-300 text-xs rounded-lg">
            {exportError}
          </div>
        )}

        {importStatus && (
          <div className="p-2.5 bg-[#121b15] border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{importStatus}</span>
          </div>
        )}

        {importError && (
          <div className="p-2.5 bg-red-950/30 border border-red-900/50 text-red-300 text-xs rounded-lg flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>{importError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Export JSON */}
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-[#141822] hover:bg-[#1a202e] border border-[#23293a] text-zinc-200 text-xs font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>{isExporting ? 'Preparing complete backup…' : 'Export Plaintext JSON Backup'}</span>
          </button>

          {/* Import JSON Backup */}
          <label className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-[#141822] hover:bg-[#1a202e] border border-[#23293a] text-zinc-200 text-xs font-medium cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-zinc-400" />
            <span>Validate & Import Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </label>
        </div>

        {/* Import Confirmation Modal */}
        {pendingImport && pendingImport.stats && (
          <div className="p-4 bg-[#0e1118] border border-zinc-700 rounded-lg space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
              <FileCheck className="w-4 h-4 text-sky-400" />
              <span>Backup Payload Validated Successfully</span>
            </div>
            <div className="text-xs text-zinc-300 space-y-1 bg-[#141822] p-3 rounded-md border border-[#1f2430]">
              <div>
                Records detected:{' '}
                <span className="font-mono font-semibold text-white">
                  {pendingImport.stats.recordCount} days
                </span>
              </div>
              <div>
                Date span:{' '}
                <span className="font-mono text-zinc-400">
                  {pendingImport.stats.startDate && pendingImport.stats.endDate
                    ? `${pendingImport.stats.startDate} → ${pendingImport.stats.endDate}`
                    : 'No daily records'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 pt-1">
                Backups are imported into the current account or local guest history. Settings in
                the backup update matching fields and preserve unspecified current settings.
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => executeImport('merge')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded text-xs font-medium border border-zinc-600 transition-colors"
              >
                Merge (newer timestamps win; imported wins ties)
              </button>
              {user ? (
                <p className="basis-full text-[11px] text-amber-300">
                  Replace is unavailable while signed in: safely deleting omitted cloud days requires
                  coordinating pending edits across devices. Use Merge or sign out to replace local guest history.
                </p>
              ) : (
                <button
                  onClick={() => executeImport('replace')}
                  className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 rounded text-xs font-medium border border-amber-800/60 transition-colors"
                >
                  Replace Guest History
                </button>
              )}
              <button
                onClick={() => setPendingImport(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete All Data */}
        <div className="pt-4 border-t border-[#1e2330]">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center space-x-2 text-xs text-red-400 hover:text-red-300 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete my account & all personal tracker data</span>
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
                <ShieldAlert className="w-4 h-4" />
                <span>Confirm Account and Data Deletion</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                This will permanently delete all daily logs, reflections, workout records, DSA
                history, settings, and your sign-in account. Deletion is blocked from syncing before cleanup begins. Type{' '}
                <strong className="text-zinc-200 font-mono">DELETE</strong> to confirm:
              </p>
              {deleteError && <p className="text-xs text-red-300" role="alert">{deleteError} The account is locked from syncing; retry deletion to continue.</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  disabled={isDeleting}
                  className="px-3 py-1 text-xs bg-[#0e1118] border border-red-900/60 rounded text-zinc-100 focus:outline-hidden font-mono"
                />
                <button
                  disabled={deleteConfirmationText !== 'DELETE' || isDeleting}
                  onClick={() => { void handleDeleteAccount(); }}
                  className="px-3 py-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  {isDeleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmationText('');
                    setDeleteError(null);
                  }}
                  className="px-2 text-xs text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
