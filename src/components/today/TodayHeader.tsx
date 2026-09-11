import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';
import { DayRecord } from '../../types';
import { addDaysToDateId, getLocalDateId } from '../../utils/localDate';

interface TodayHeaderProps {
  day: DayRecord;
  onDateChange: (dateStr: string) => void;
}

export const TodayHeader: React.FC<TodayHeaderProps> = ({ day, onDateChange }) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const changeDayBy = (offset: number) => {
    onDateChange(addDaysToDateId(day.date, offset));
  };

  const isToday = () => {
    const todayStr = getLocalDateId();
    return day.date === todayStr;
  };

  // Format date display (e.g. Wednesday, Sep 3, 2026)
  const formatNiceDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <header className="mb-6 pb-6 border-b border-[#1f2430]">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
              DAILY OS
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">/</span>
            <span className="text-[11px] text-zinc-400 font-mono bg-[#161a24] px-2 py-0.5 rounded border border-[#232938]">
              {day.dayOfWeek}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>{getGreeting()}</span>
            <span className="text-zinc-500 font-normal">·</span>
            <span className="text-zinc-300 font-medium text-base sm:text-xl">
              {formatNiceDate(day.date)}
            </span>
          </h1>
        </div>

        {/* Date Navigation and Live Clock */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-[#131620] border border-[#222838] rounded-lg p-1">
            <button
              id="btn-prev-day"
              onClick={() => changeDayBy(-1)}
              title="Previous Day"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#1c2230] rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {!isToday() && (
              <button
                id="btn-jump-today"
                onClick={() => onDateChange(getLocalDateId())}
                className="px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-[#1c2230] rounded transition-colors"
              >
                Today
              </button>
            )}

            <button
              id="btn-next-day"
              onClick={() => changeDayBy(1)}
              title="Next Day"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#1c2230] rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Live time ticker */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131620] border border-[#222838] rounded-lg text-xs font-mono text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{currentTime || '--:--:--'}</span>
          </div>
        </div>
      </div>

      {/* Completion Progress Bar */}
      <div className="mt-5 p-3.5 rounded-xl bg-[#12151e] border border-[#202534] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 transform -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-[#1e2330]"
                fill="transparent"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-zinc-200 transition-all duration-500 ease-out"
                fill="transparent"
                strokeDasharray="100.5"
                strokeDashoffset={100.5 - (100.5 * day.completionPercentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-bold font-mono text-zinc-100">
              {day.completionPercentage}%
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">Daily Execution Progress</div>
            <p className="text-[11px] text-zinc-400">
              {day.completionPercentage >= 100
                ? 'All objectives, habits & schedule blocks complete.'
                : day.completionPercentage > 50
                ? 'Strong momentum. Finish strong before sleep.'
                : 'Focus on primary academic deep work and daily non-negotiables.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-full sm:w-36 h-2 bg-[#1b202c] rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-300 transition-all duration-300 rounded-full"
              style={{ width: `${day.completionPercentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-zinc-400 shrink-0">
            {day.completionPercentage}%
          </span>
        </div>
      </div>
    </header>
  );
};
