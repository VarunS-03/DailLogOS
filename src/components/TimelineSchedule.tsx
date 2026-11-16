import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ScheduleItem } from '../types';

interface TimelineScheduleProps {
  schedule: ScheduleItem[];
  onToggleStatus: (id: string, status: 'completed' | 'skipped' | 'pending') => void;
  onAddBlock?: (item: ScheduleItem) => void;
  onStartFocus?: (block: ScheduleItem) => void;
}

export const TimelineSchedule: React.FC<TimelineScheduleProps> = ({
  schedule,
  onToggleStatus,
  onAddBlock,
  onStartFocus,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = schedule.filter((s) => s.status === 'completed').length;
  const progressPercent = schedule.length > 0 ? Math.round((completedCount / schedule.length) * 100) : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (onAddBlock) {
      onAddBlock({
        id: `sched-custom-${Date.now()}`,
        time: newTime.trim() || 'Flexible',
        title: newTitle.trim(),
        category: 'other',
        status: 'pending',
      });
    }

    setNewTitle('');
    setNewTime('');
    setShowAdd(false);
  };

  return (
    <div className="rounded-2xl p-5 bg-[#131722] border border-[#20273a] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1f2638]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Today's Schedule & Timeline</h3>
            <span className="text-xs text-zinc-400 font-mono">
              {completedCount} of {schedule.length} blocks completed ({progressPercent}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Block</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAddSubmit} className="mt-3 p-3 rounded-xl bg-[#0b0e15] border border-[#252f44] flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            placeholder="Time (e.g. 14:00–15:00)"
            className="px-3 py-2 bg-[#121622] border border-[#2b354e] rounded-lg text-xs text-white placeholder-zinc-500 w-full sm:w-44 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Focus block title (e.g. System Design review)"
            className="flex-1 px-3 py-2 bg-[#121622] border border-[#2b354e] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Timeline items */}
      {isExpanded && (
        <div className="mt-4 space-y-2 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#1e2538]">
          {schedule.map((item) => {
            const isCompleted = item.status === 'completed';
            const isSkipped = item.status === 'skipped';

            return (
              <div
                key={item.id}
                className={`relative pl-8 pr-3 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-900/30'
                    : isSkipped
                    ? 'bg-zinc-900/30 border-zinc-800/40 opacity-50'
                    : 'bg-[#0f121a] border-[#1e2538] hover:border-zinc-700'
                }`}
              >
                {/* Visual marker dot */}
                <button
                  onClick={() => onToggleStatus(item.id, isCompleted ? 'pending' : 'completed')}
                  className={`absolute left-2.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : isSkipped
                      ? 'bg-zinc-700 border-zinc-600'
                      : 'border-zinc-500 hover:border-indigo-400 bg-[#0e1118]'
                  }`}
                >
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-[11px] font-mono text-zinc-400 w-24 shrink-0">
                    {item.time}
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${
                      isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-100'
                    }`}
                  >
                    {item.title}
                  </span>
                  {item.note && (
                    <span className="text-[11px] text-amber-300/80 font-mono truncate">
                      · {item.note}
                    </span>
                  )}
                </div>

                {/* Focus launch button */}
                <div className="flex items-center gap-1 shrink-0">
                  {onStartFocus && !isCompleted && (
                    <button
                      onClick={() => onStartFocus(item)}
                      className="px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
