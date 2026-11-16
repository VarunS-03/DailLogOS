import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Play,
  ArrowRight,
  Flame,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { DayRecord, ScheduleItem, TabType } from '../types';
import { AiInsightCard } from './AiInsightCard';
import { ProgressRing } from './ProgressRing';
import { TimelineSchedule } from './TimelineSchedule';
import { generateDailyBriefing, AiBriefing } from '../services/ai';
import { addDaysToDateId, getLocalDateId } from '../utils/localDate';
import confetti from 'canvas-confetti';

interface TodayDashboardProps {
  day: DayRecord;
  yesterday?: DayRecord | null;
  onUpdateDay: (updatedDay: DayRecord) => Promise<void>;
  onDateChange: (dateStr: string) => void;
  onNavigateTab: (tab: TabType) => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  day,
  yesterday,
  onUpdateDay,
  onDateChange,
  onNavigateTab,
}) => {
  const [briefing, setBriefing] = useState<AiBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number | null>(null);
  const [timerBlockTitle, setTimerBlockTitle] = useState<string>('');

  // Live clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch AI briefing
  const loadBriefing = async () => {
    setBriefingLoading(true);
    try {
      const b = await generateDailyBriefing(day, yesterday);
      setBriefing(b);
    } catch (e) {
      console.warn('Briefing error:', e);
    } finally {
      setBriefingLoading(false);
    }
  };

  useEffect(() => {
    loadBriefing();
  }, [day.date]);

  // Pomodoro timer effect
  useEffect(() => {
    if (activeTimerSeconds === null || activeTimerSeconds <= 0) return;
    const interval = setInterval(() => {
      setActiveTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          confetti({ particleCount: 50, spread: 70 });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimerSeconds]);

  // Non-negotiables toggle
  const toggleNonNegotiable = async (id: string) => {
    const nns = day.workout?.dailyNonNegotiables || [];
    const updatedNns = nns.map((nn) => (nn.id === id ? { ...nn, completed: !nn.completed } : nn));
    await onUpdateDay({
      ...day,
      workout: {
        ...day.workout,
        dailyNonNegotiables: updatedNns,
      },
    });
  };

  // Habit toggle
  const toggleHabit = async (id: string) => {
    const habits = day.habits || [];
    const updated = habits.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h));
    await onUpdateDay({ ...day, habits: updated });
  };

  // Schedule toggle
  const toggleSchedule = async (id: string, status: 'completed' | 'skipped' | 'pending') => {
    const sched = day.schedule || [];
    const updated = sched.map((s) => (s.id === id ? { ...s, status } : s));
    await onUpdateDay({ ...day, schedule: updated });
  };

  const handleStartFocus = (block: ScheduleItem) => {
    setTimerBlockTitle(block.title);
    setActiveTimerSeconds(25 * 60); // 25m Pomodoro
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayStr = getLocalDateId();
  const isActualToday = day.date === todayStr;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 1. Header with Spatial Date Context & Live Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#131722] border border-[#20283c]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => onDateChange(addDaysToDateId(day.date, -1))}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {day.dayOfWeek}, {day.date}
            </h1>
            <button
              onClick={() => onDateChange(addDaysToDateId(day.date, 1))}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isActualToday && (
              <button
                onClick={() => onDateChange(todayStr)}
                className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium hover:underline cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400 font-mono">Current Time: {currentTime}</p>
        </div>

        {/* Progress summary */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-zinc-400 block font-medium">Daily Completion</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {day.completionPercentage >= 80 ? '🔥 High Momentum' : '⚡ Steady Progress'}
            </span>
          </div>
          <ProgressRing percentage={day.completionPercentage} size={58} strokeWidth={5} />
        </div>
      </div>

      {/* Focus Timer banner if active */}
      {activeTimerSeconds !== null && (
        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
            <div>
              <span className="text-xs font-semibold text-indigo-200 uppercase font-mono">
                Focus Session Active
              </span>
              <h4 className="text-sm font-bold text-white">{timerBlockTitle}</h4>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-mono font-bold text-indigo-300">
              {formatTimer(activeTimerSeconds)}
            </span>
            <button
              onClick={() => setActiveTimerSeconds(null)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. AI Morning Briefing Card */}
      <AiInsightCard
        briefing={briefing}
        loading={briefingLoading}
        onRefresh={loadBriefing}
      />

      {/* 3. Non-Negotiables & Micro-Habits (1-Tap Psychological Ease) */}
      <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#20283c]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">Daily Non-Negotiables</h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">1-Tap Completion</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(day.workout?.dailyNonNegotiables || []).map((nn) => (
            <button
              key={nn.id}
              onClick={() => toggleNonNegotiable(nn.id)}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                nn.completed
                  ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                  : 'bg-[#0f121a] border-[#20283c] text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                  nn.completed ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-zinc-500'
                }`}
              >
                {nn.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold block truncate">{nn.name}</span>
                <span className="text-[11px] text-zinc-400 font-mono">{nn.target}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Habits */}
        <div className="pt-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono block mb-2">
            Routines & Habits
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(day.habits || []).map((h) => (
              <button
                key={h.id}
                onClick={() => toggleHabit(h.id)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  h.completed
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
                    : 'bg-[#0f121a] border-[#20283c] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    h.completed ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-zinc-600'
                  }`}
                >
                  {h.completed && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <span className="text-xs font-medium truncate">{h.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Schedule & Timeline with Visual Progression */}
      <TimelineSchedule
        schedule={day.schedule || []}
        onToggleStatus={toggleSchedule}
        onStartFocus={handleStartFocus}
      />

      {/* 5. Direct Quick Workspace Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Academics */}
        <div
          onClick={() => onNavigateTab('academics')}
          className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] hover:border-indigo-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase text-indigo-400 tracking-wider">
              Work & Academics
            </span>
            <h4 className="text-sm font-semibold text-white mt-1 group-hover:text-indigo-300 transition-colors">
              {day.academics?.subject || 'Academics Session'}
            </h4>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
              {day.academics?.objective || 'Active retrieval, formulas, and deep study notes.'}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-indigo-400 font-medium mt-4">
            <span>Open Study Workspace</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* DSA */}
        <div
          onClick={() => onNavigateTab('dsa')}
          className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase text-emerald-400 tracking-wider">
              Algorithms
            </span>
            <h4 className="text-sm font-semibold text-white mt-1 group-hover:text-emerald-300 transition-colors">
              DSA Practice ({day.dsa?.length || 0} Solved)
            </h4>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
              {day.dsa?.[0]?.problem ? `Latest: ${day.dsa[0].problem} (${day.dsa[0].pattern})` : 'Record patterns with AI assistance.'}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium mt-4">
            <span>Open DSA Workspace</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};
