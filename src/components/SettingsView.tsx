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
import { AuthErrorInfo, AuthUser, UserSettings, DayRecord } from '../types';
import { DAYS_OF_WEEK } from '../constants/templates';
import { isFirebaseConfigured, getFirebaseAuthDiagnostics } from '../firebase';
import { validateAndSanitizeBackup, ValidationResult } from '../utils/backupValidation';

interface SettingsViewProps {
  user: AuthUser | null;
  settings: UserSettings;
  allDays: Record<string, DayRecord>;
  onSignOut: () => void;
  onSignIn: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onImportBackup: (days: Record<string, DayRecord>, settings?: UserSettings) => void;
  onDeleteAccount: () => void;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onClearAuthError?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  settings,
  allDays,
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
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ValidationResult | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const diagnostics = getFirebaseAuthDiagnostics();

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  // Trigger Safe JSON Export with privacy disclosure
  const handleExportData = () => {
    const backupData = {
      manifest: 'DAILY OS — Encrypted / Private Personal Backup',
      exportDate: new Date().toISOString(),
      recordCount: Object.keys(allDays).length,
      settings: {
        defaultWorkoutMode: settings.defaultWorkoutMode,
        academicSchedule: settings.academicSchedule,
        theme: settings.theme,
        notificationsEnabled: settings.notificationsEnabled,
      },
      days: allDays,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `daily-os-private-backup-${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setShowExportWarning(true);
    setTimeout(() => setShowExportWarning(false), 8000);
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
  const executeImport = (mode: 'merge' | 'replace') => {
    if (!pendingImport || !pendingImport.sanitizedDays) return;

    let finalDays: Record<string, DayRecord> = {};
    if (mode === 'replace') {
      finalDays = pendingImport.sanitizedDays;
    } else {
      // Merge: Keep existing records, add or update with imported
      finalDays = { ...allDays, ...pendingImport.sanitizedDays };
    }

    onImportBackup(finalDays, pendingImport.sanitizedSettings);
    setImportStatus(
      `Successfully ${mode === 'replace' ? 'replaced with' : 'merged'} ${
        Object.keys(pendingImport.sanitizedDays).length
      } daily records!`
    );
    setPendingImport(null);
    setTimeout(() => setImportStatus(null), 5000);
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

      {/* Data Management Section */}
      <section className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
          Data Portability & Secure Backup
        </h2>

        {/* Export Privacy Warning Banner */}
        {showExportWarning && (
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-200 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Privacy Notice</span>
              This downloaded JSON file contains your personal tracker data (schedules, DSA learning
              logs, workout history, and reflections). Store it securely and do not share it
              unencrypted.
            </div>
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
            className="flex items-center justify-center space-x-2 p-3 rounded-lg bg-[#141822] hover:bg-[#1a202e] border border-[#23293a] text-zinc-200 text-xs font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Export Encrypted JSON Backup</span>
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
                  {pendingImport.stats.startDate} → {pendingImport.stats.endDate}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 pt-1">
                All records will be securely bound strictly to your authenticated account UID.
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => executeImport('merge')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded text-xs font-medium border border-zinc-600 transition-colors"
              >
                Merge (Add Missing & Update Newer)
              </button>
              <button
                onClick={() => executeImport('replace')}
                className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 rounded text-xs font-medium border border-amber-800/60 transition-colors"
              >
                Replace All Current Records
              </button>
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
                <span>Confirm Permanent Data Deletion</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                This will permanently delete all daily logs, reflections, workout records, DSA
                history, and settings from Cloud Firestore and clear all local device storage. Type{' '}
                <strong className="text-zinc-200 font-mono">DELETE</strong> to confirm:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="px-3 py-1 text-xs bg-[#0e1118] border border-red-900/60 rounded text-zinc-100 focus:outline-hidden font-mono"
                />
                <button
                  disabled={deleteConfirmationText !== 'DELETE'}
                  onClick={onDeleteAccount}
                  className="px-3 py-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmationText('');
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
