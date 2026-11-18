import React, { useState } from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Layers,
  Moon,
  Settings,
  LogOut,
  User,
  Check,
  Copy,
  AlertTriangle,
  Loader2,
  Calendar,
  Dumbbell,
  BookOpen,
  Code2,
} from 'lucide-react';
import { AuthErrorInfo, AuthUser, SystemModuleId, SyncStatus, TabType } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  user: AuthUser | null;
  onSignOut: () => void;
  onSignIn: () => void;
  syncStatus: SyncStatus;
  completionRate: number;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onClearAuthError?: () => void;
  enabledModules: SystemModuleId[];
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  user,
  onSignOut,
  onSignIn,
  syncStatus,
  completionRate,
  isSigningIn = false,
  authError = null,
  onClearAuthError,
  enabledModules,
}) => {
  const [copiedHostname, setCopiedHostname] = useState(false);
  const syncStatusLabel: Record<SyncStatus, string> = {
    idle: user ? 'Sync status unknown' : 'Saved on device',
    pending: 'Saved locally',
    syncing: 'Syncing',
    offline: 'Waiting for connection',
    conflict: 'Conflict needs review',
    synced: user ? 'Cloud synced' : 'Saved on device',
    error: 'Sync failed',
  };
  const syncStatusColor: Record<SyncStatus, string> = {
    idle: 'bg-zinc-500',
    pending: 'bg-amber-400',
    syncing: 'bg-amber-400',
    offline: 'bg-amber-400',
    conflict: 'bg-red-400',
    synced: 'bg-emerald-400',
    error: 'bg-red-400',
  };
  const trackModules: Array<SystemModuleId> = ['dsa', 'academics', 'workout', 'projects'];
  const firstEnabledTrackModule = trackModules.find((module) => enabledModules.includes(module));

  const mainTabs = [
    { id: 'today' as TabType, label: 'Today', icon: LayoutDashboard },
    ...(firstEnabledTrackModule ? [{
      id: firstEnabledTrackModule as TabType,
      label: 'Track Work',
      icon: Layers,
      activeMatch: trackModules as TabType[],
    }] : []),
    ...(enabledModules.includes('insights') ? [{
      id: 'review' as TabType,
      label: 'Insights & Review',
      icon: Moon,
      activeMatch: ['review', 'calendar', 'history'],
    }] : []),
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  const handleCopyHostname = (hostname: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hostname).then(() => {
        setCopiedHostname(true);
        setTimeout(() => setCopiedHostname(false), 2000);
      });
    }
  };

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0d0f17] border-r border-[#1e2538] p-4 shrink-0 select-none justify-between h-screen sticky top-0">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wider font-mono">DAILY OS</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatusColor[syncStatus]}`} />
                <span className="text-[10px] text-zinc-400 font-mono">
                  {syncStatusLabel[syncStatus]}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {mainTabs.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.id === currentTab || (item.activeMatch && item.activeMatch.includes(currentTab));

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-[#141824]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile / Auth footer */}
        <div className="pt-4 border-t border-[#1e2538]">
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#131722] border border-[#20283c]">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-indigo-500/30" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-bold font-mono">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate">
                    {user.displayName || 'Signed In'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono block truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              disabled={isSigningIn}
              className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              {isSigningIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
              <span>{isSigningIn ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f17]/95 border-t border-[#1e2538] backdrop-blur-lg px-4 py-2 flex items-center justify-around">
        {mainTabs.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.id === currentTab || (item.activeMatch && item.activeMatch.includes(currentTab));

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
