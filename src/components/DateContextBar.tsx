import React from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Calendar, Clock } from 'lucide-react';
import { TabType, SyncStatus } from '../types';
import { addDaysToDateId, getLocalDateId } from '../utils/localDate';

interface DateContextBarProps {
  selectedDate: string;
  dayOfWeek: string;
  activeTab: TabType;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  onDateChange: (newDateStr: string) => void;
  onNavigateTab: (tab: TabType) => void;
}

export const DateContextBar: React.FC<DateContextBarProps> = ({
  selectedDate,
  dayOfWeek,
  activeTab,
  syncStatus,
  lastSyncedAt,
  onDateChange,
  onNavigateTab,
}) => {
  const todayStr = getLocalDateId();
  const isActualToday = selectedDate === todayStr;

  const changeDayBy = (offset: number) => {
    onDateChange(addDaysToDateId(selectedDate, offset));
  };

  const [y, m, d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Only render on non-overview/settings pages to give strong spatial awareness
  if (activeTab === 'today' || activeTab === 'calendar' || activeTab === 'history' || activeTab === 'settings') {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 bg-[#0c0e14]/90 backdrop-blur-md border-b border-[#1b202c] px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Quick jump back to Today Command Center */}
        <button
          onClick={() => onNavigateTab('today')}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">← Command Center</span>
          <span className="sm:hidden">← Today</span>
        </button>

        {/* Center: Selected Date Controller */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => changeDayBy(-1)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#161a24] transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 bg-[#12151e] border border-[#202534] px-2.5 py-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-mono font-semibold text-zinc-200">
              {formattedDate}
            </span>
            {!isActualToday && (
              <button
                onClick={() => onDateChange(todayStr)}
                className="text-[10px] font-mono font-medium text-cyan-400 hover:underline ml-1"
              >
                (Today)
              </button>
            )}
          </div>

          <button
            onClick={() => changeDayBy(1)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#161a24] transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Cloud Sync Status indicator */}
        <div className="flex items-center text-[10px] font-mono text-zinc-500">
          {syncStatus === 'syncing' ? (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              Saving...
            </span>
          ) : (
            <span className="text-emerald-400/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Synced
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
