import React, { useState } from 'react';
import { History, Search, ArrowRight, CheckCircle2, Dumbbell, BookOpen, Code2 } from 'lucide-react';
import { DayRecord } from '../types';

interface HistoryViewProps {
  allDays: Record<string, DayRecord>;
  onSelectDate: (dateStr: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ allDays, onSelectDate }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const sortedDays = (Object.values(allDays) as DayRecord[]).sort((a, b) => {
    return b.date.localeCompare(a.date);
  });

  const filteredDays = sortedDays.filter((d) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.date.includes(term) ||
      d.dayOfWeek.toLowerCase().includes(term) ||
      d.academics?.subject?.toLowerCase().includes(term) ||
      d.academics?.objective?.toLowerCase().includes(term) ||
      d.tomorrowFirstAction?.toLowerCase().includes(term) ||
      d.notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
              JOURNAL ARCHIVE
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Day History & Logs
          </h1>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by date, subject, action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#12151e] border border-[#202534] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
          />
        </div>
      </div>

      {/* List of Days */}
      {filteredDays.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[#1f2534] rounded-xl bg-[#0f1218] text-zinc-500 text-xs">
          No history entries found matching your query.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDays.map((d) => (
            <div
              key={d.date}
              className="p-4 rounded-xl bg-[#12151e] border border-[#202534] hover:border-[#2a3244] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold font-mono text-zinc-100">
                    {d.date}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono bg-[#161a23] px-2 py-0.5 rounded border border-[#222838]">
                    {d.dayOfWeek}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      d.completionPercentage >= 75
                        ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                        : d.completionPercentage > 0
                        ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                        : 'text-zinc-500 bg-zinc-900 border-zinc-700'
                    }`}
                  >
                    {d.completionPercentage}% Done
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                  {d.academics?.subject && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-zinc-400" />
                      <span>{d.academics.subject}</span>
                    </span>
                  )}
                  {d.workout?.cycleDay && (
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-3 h-3 text-zinc-400" />
                      <span className="truncate max-w-[180px]">{d.workout.cycleDay}</span>
                    </span>
                  )}
                  {d.dsa && d.dsa.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Code2 className="w-3 h-3 text-zinc-400" />
                      <span>{d.dsa.length} DSA problem{d.dsa.length > 1 ? 's' : ''}</span>
                    </span>
                  )}
                </div>

                {d.tomorrowFirstAction && (
                  <p className="text-[11px] text-zinc-400 italic line-clamp-1">
                    Morning target: "{d.tomorrowFirstAction}"
                  </p>
                )}
              </div>

              <button
                onClick={() => onSelectDate(d.date)}
                className="self-end sm:self-center flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium border border-zinc-700 transition-colors shrink-0"
              >
                <span>Open & Edit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
