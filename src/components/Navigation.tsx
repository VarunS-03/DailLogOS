import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Code2,
  Terminal,
  Dumbbell,
  Clock,
  Calendar,
  Moon,
  History,
  Settings,
  MoreHorizontal,
  X,
  LogOut,
  User,
  ChevronRight,
  Briefcase,
  CalendarRange,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { AuthErrorInfo, AuthUser, TabType } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  user: AuthUser | null;
  onSignOut: () => void;
  onSignIn: () => void;
  isSynced: boolean;
  completionRate: number;
  isSigningIn?: boolean;
  authError?: AuthErrorInfo | string | null;
  onClearAuthError?: () => void;
}

interface NavGroup {
  label: string;
  items: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  user,
  onSignOut,
  onSignIn,
  isSynced,
  completionRate,
  isSigningIn = false,
  authError = null,
  onClearAuthError,
}) => {
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [copiedHostname, setCopiedHostname] = useState(false);

  const handleCopyHostname = (hostname: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hostname);
      setCopiedHostname(true);
      setTimeout(() => setCopiedHostname(false), 2000);
    }
  };

  // Grouped navigation structure for desktop sidebar
  const navGroups: NavGroup[] = [
    {
      label: 'OVERVIEW',
      items: [{ id: 'today', label: 'Today', icon: LayoutDashboard }],
    },
    {
      label: 'WORK',
      items: [
        { id: 'academics', label: 'Academics', icon: BookOpen },
        { id: 'dsa', label: 'DSA & LeetCode', icon: Code2 },
        { id: 'projects', label: 'Projects', icon: Terminal },
      ],
    },
    {
      label: 'FITNESS',
      items: [{ id: 'workout', label: 'Workout', icon: Dumbbell }],
    },
    {
      label: 'PLANNER',
      items: [
        { id: 'schedule', label: 'Schedule', icon: Clock },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
      ],
    },
    {
      label: 'LOGBOOK',
      items: [
        { id: 'review', label: 'Daily Review', icon: Moon },
        { id: 'history', label: 'History', icon: History },
      ],
    },
    {
      label: 'SYSTEM',
      items: [{ id: 'settings', label: 'Settings', icon: Settings }],
    },
  ];

  // Quick navigation handler that closes mobile sheet
  const handleMobileNavClick = (tab: TabType) => {
    onSelectTab(tab);
    setShowMoreModal(false);
  };

  const isWorkActive =
    currentTab === 'academics' || currentTab === 'dsa' || currentTab === 'projects';
  const isPlannerActive = currentTab === 'schedule' || currentTab === 'calendar';
  const isMoreActive =
    currentTab === 'review' || currentTab === 'history' || currentTab === 'settings';

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-sidebar"
        className="hidden md:flex flex-col w-64 bg-[#0e1117] border-r border-[#1f2430] h-screen sticky top-0 shrink-0 select-none z-30"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#1f2430] flex items-center justify-between">
          <div
            onClick={() => onSelectTab('today')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs tracking-wider text-zinc-100 group-hover:border-zinc-500 transition-colors">
              OS
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-wider text-zinc-100 uppercase">
                DAILY OS
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono">Personal System</p>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center" title={isSynced ? 'Cloud Synced' : 'Syncing...'}>
            {isSynced ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                SYNC
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                SAVING
              </span>
            )}
          </div>
        </div>

        {/* Today's Focus % Progress Bar */}
        <div className="px-3.5 py-2.5 mx-3 mt-3 rounded-lg bg-[#141822] border border-[#202534]">
          <div className="flex items-center justify-between text-xs mb-1 font-mono">
            <span className="text-zinc-400 text-[11px]">Today's Focus</span>
            <span className="text-zinc-200 font-semibold text-xs">{completionRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#0a0c10] rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-300 transition-all duration-300 rounded-full"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <span className="px-2 text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase block mb-1">
                {group.label}
              </span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141822]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Account / Sign In / Out */}
        <div className="p-3 border-t border-[#1f2430] bg-[#0a0c10] shrink-0">
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#141822] border border-[#202636]">
              <div className="flex items-center space-x-2 overflow-hidden">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover border border-zinc-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-300 font-semibold shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden text-left">
                  <p className="text-xs font-medium text-zinc-200 truncate leading-tight">
                    {user.displayName || 'Personal'}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate leading-tight">
                    {user.email || 'Connected'}
                  </p>
                </div>
              </div>
              <button
                id="btn-sidebar-signout"
                onClick={onSignOut}
                title="Sign out"
                className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {authError && (
                <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-800/60 text-red-200 text-[11px] space-y-1.5 animate-in fade-in">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div className="leading-tight break-words">
                        {typeof authError === 'object' && authError.category && (
                          <span className="font-semibold text-red-300 block mb-0.5">
                            {authError.category} {authError.code ? `(${authError.code})` : ''}
                          </span>
                        )}
                        <span>{typeof authError === 'string' ? authError : authError.message}</span>
                      </div>
                    </div>
                    {onClearAuthError && (
                      <button
                        onClick={onClearAuthError}
                        className="text-red-400 hover:text-red-200 p-0.5 shrink-0 cursor-pointer"
                        title="Dismiss error"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {typeof authError === 'object' && authError.hostname && (
                    <div className="pt-1 border-t border-red-900/40 flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] text-red-300/80 truncate">
                        {authError.hostname}
                      </span>
                      <button
                        onClick={() => handleCopyHostname(authError.hostname!)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-mono flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Copy domain to clipboard"
                      >
                        {copiedHostname ? (
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
                  )}
                </div>
              )}
              <button
                id="btn-sidebar-signin"
                onClick={onSignIn}
                disabled={isSigningIn}
                className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  isSigningIn
                    ? 'bg-zinc-800/70 text-zinc-400 border-zinc-700 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 active:scale-[0.98]'
                }`}
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span>Connect Google</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0e1117]/95 backdrop-blur-md border-t border-[#1f2430] px-3 py-1.5 flex items-center justify-between"
      >
        {/* 1. Today */}
        <button
          id="mobile-nav-today"
          onClick={() => handleMobileNavClick('today')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            currentTab === 'today'
              ? 'text-zinc-100 bg-[#191e2b] font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 mb-0.5 ${currentTab === 'today' ? 'text-zinc-100' : 'text-zinc-400'}`} />
          <span>Today</span>
        </button>

        {/* 2. Work (Toggles between Academics, DSA, Projects) */}
        <button
          id="mobile-nav-work"
          onClick={() => {
            if (currentTab === 'academics') onSelectTab('dsa');
            else if (currentTab === 'dsa') onSelectTab('projects');
            else onSelectTab('academics');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            isWorkActive
              ? 'text-zinc-100 bg-[#191e2b] font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Briefcase className={`w-4 h-4 mb-0.5 ${isWorkActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
          <span>
            {currentTab === 'academics'
              ? 'Academics'
              : currentTab === 'dsa'
              ? 'DSA'
              : currentTab === 'projects'
              ? 'Projects'
              : 'Work'}
          </span>
        </button>

        {/* 3. Fitness */}
        <button
          id="mobile-nav-fitness"
          onClick={() => handleMobileNavClick('workout')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            currentTab === 'workout'
              ? 'text-zinc-100 bg-[#191e2b] font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Dumbbell className={`w-4 h-4 mb-0.5 ${currentTab === 'workout' ? 'text-zinc-100' : 'text-zinc-400'}`} />
          <span>Fitness</span>
        </button>

        {/* 4. Planner (Schedule / Calendar) */}
        <button
          id="mobile-nav-planner"
          onClick={() => {
            if (currentTab === 'schedule') onSelectTab('calendar');
            else onSelectTab('schedule');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            isPlannerActive
              ? 'text-zinc-100 bg-[#191e2b] font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CalendarRange className={`w-4 h-4 mb-0.5 ${isPlannerActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
          <span>{currentTab === 'calendar' ? 'Calendar' : 'Planner'}</span>
        </button>

        {/* 5. More (Opens Clean Sheet) */}
        <button
          id="mobile-nav-more"
          onClick={() => setShowMoreModal(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            isMoreActive
              ? 'text-zinc-100 bg-[#191e2b] font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MoreHorizontal className={`w-4 h-4 mb-0.5 ${isMoreActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Sheet Overlay */}
      {showMoreModal && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
          onClick={() => setShowMoreModal(false)}
        >
          <div
            className="bg-[#12151e] border-t border-[#232938] rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2430]">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                  APPLICATION DIRECTORY
                </span>
              </div>
              <button
                onClick={() => setShowMoreModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#1c2230]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Links Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleMobileNavClick('projects')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors text-left ${
                  currentTab === 'projects'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'bg-[#0e1118] border-[#202534] text-zinc-300'
                }`}
              >
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>Projects</span>
              </button>

              <button
                onClick={() => handleMobileNavClick('review')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors text-left ${
                  currentTab === 'review'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'bg-[#0e1118] border-[#202534] text-zinc-300'
                }`}
              >
                <Moon className="w-4 h-4 text-purple-400" />
                <span>Daily Review</span>
              </button>

              <button
                onClick={() => handleMobileNavClick('history')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors text-left ${
                  currentTab === 'history'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'bg-[#0e1118] border-[#202534] text-zinc-300'
                }`}
              >
                <History className="w-4 h-4 text-zinc-400" />
                <span>History Logs</span>
              </button>

              <button
                onClick={() => handleMobileNavClick('calendar')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors text-left ${
                  currentTab === 'calendar'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'bg-[#0e1118] border-[#202534] text-zinc-300'
                }`}
              >
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Calendar</span>
              </button>

              <button
                onClick={() => handleMobileNavClick('settings')}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors text-left col-span-2 ${
                  currentTab === 'settings'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'bg-[#0e1118] border-[#202534] text-zinc-300'
                }`}
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Preferences & System Settings</span>
              </button>
            </div>

            {/* Profile & Auth */}
            <div className="pt-3 border-t border-[#1f2430]">
              {user ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1118] border border-[#202534]">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="truncate text-left">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{user.displayName || 'Personal'}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSignOut();
                      setShowMoreModal(false);
                    }}
                    className="flex items-center gap-1 text-xs text-red-400 px-2.5 py-1 rounded bg-[#1c181f] border border-red-900/40"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {authError && (
                    <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-800/60 text-red-200 text-xs space-y-1.5 animate-in fade-in">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="leading-tight break-words">
                            {typeof authError === 'object' && authError.category && (
                              <span className="font-semibold text-red-300 block mb-0.5">
                                {authError.category} {authError.code ? `(${authError.code})` : ''}
                              </span>
                            )}
                            <span>{typeof authError === 'string' ? authError : authError.message}</span>
                          </div>
                        </div>
                        {onClearAuthError && (
                          <button
                            onClick={onClearAuthError}
                            className="text-red-400 hover:text-red-200 p-0.5 shrink-0 cursor-pointer"
                            title="Dismiss error"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {typeof authError === 'object' && authError.hostname && (
                        <div className="pt-1 border-t border-red-900/40 flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-red-300/80 truncate">
                            {authError.hostname}
                          </span>
                          <button
                            onClick={() => handleCopyHostname(authError.hostname!)}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-mono flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Copy domain to clipboard"
                          >
                            {copiedHostname ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Domain</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={onSignIn}
                    disabled={isSigningIn}
                    className={`w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border cursor-pointer ${
                      isSigningIn
                        ? 'bg-zinc-800/70 text-zinc-400 border-zinc-700 cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                    }`}
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4" />
                        <span>Connect Google Account</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
