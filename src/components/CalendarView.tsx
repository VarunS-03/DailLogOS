import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { DayRecord } from '../types';
import { getLocalDateId } from '../utils/localDate';

interface CalendarViewProps {
  allDays: Record<string, DayRecord>;
  onSelectDate: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ allDays, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = getLocalDateId();

  // Calendar cells
  const daysCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysCells.push(d);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarIcon className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
              CALENDAR DISPATCH
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            {monthNames[month]} {year}
          </h1>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg bg-[#131620] hover:bg-[#1a1e2b] border border-[#222838] text-zinc-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-medium bg-[#131620] hover:bg-[#1a1e2b] border border-[#222838] text-zinc-200 rounded-lg transition-colors"
          >
            Current Month
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg bg-[#131620] hover:bg-[#1a1e2b] border border-[#222838] text-zinc-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Completed (&gt;75%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Partial (&gt;0%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#202534] border border-zinc-700"></span>
          <span>No Log</span>
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#12151e] border border-[#202534] rounded-xl overflow-hidden p-3 sm:p-5">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-mono text-zinc-400 font-medium">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {daysCells.map((dayNum, idx) => {
            if (dayNum === null) {
              return <div key={`empty-${idx}`} className="h-16 sm:h-20 opacity-0" />;
            }

            const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const record = allDays[formattedDate];
            const isToday = formattedDate === todayStr;
            const completion = record ? record.completionPercentage : null;

            return (
              <button
                key={formattedDate}
                onClick={() => onSelectDate(formattedDate)}
                className={`h-16 sm:h-20 p-1.5 sm:p-2 rounded-lg border text-left flex flex-col justify-between transition-all group ${
                  isToday
                    ? 'border-zinc-400 bg-[#161a25]'
                    : 'border-[#1e2330] bg-[#0e1118] hover:border-zinc-600 hover:bg-[#131722]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-medium ${
                      isToday
                        ? 'text-zinc-100 font-bold bg-zinc-700 px-1.5 py-0.5 rounded'
                        : 'text-zinc-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {completion !== null && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        completion >= 75
                          ? 'bg-emerald-400'
                          : completion > 0
                          ? 'bg-amber-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                  )}
                </div>

                {record ? (
                  <div className="overflow-hidden">
                    <div className="text-[10px] text-zinc-400 truncate">
                      {record.academics?.subject || 'Logged'}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500">
                      {record.completionPercentage}% done
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] text-zinc-600 group-hover:text-zinc-400 font-mono">
                    Open
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
