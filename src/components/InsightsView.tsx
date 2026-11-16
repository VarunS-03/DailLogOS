import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  History,
  TrendingUp,
  Moon,
  BatteryCharging,
  Sun,
  Flame,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRight,
} from 'lucide-react';
import { DayRecord, DailyReflection } from '../types';
import { generateAutoReflection, analyzeWeeklyPatterns, WeeklyInsight } from '../services/ai';
import confetti from 'canvas-confetti';

interface InsightsViewProps {
  day: DayRecord;
  allDays: Record<string, DayRecord>;
  onUpdateDay: (updatedDay: DayRecord) => Promise<void>;
  onSelectDate: (dateStr: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  day,
  allDays,
  onUpdateDay,
  onSelectDate,
}) => {
  const [activeTab, setActiveTab] = useState<'reflection' | 'trends' | 'history'>('reflection');
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const reflection = day.dailyReflection || ({} as DailyReflection);
  const allDaysList = Object.values(allDays) as DayRecord[];
  const insights: WeeklyInsight[] = analyzeWeeklyPatterns(allDaysList);

  // Trigger celebration on completing review
  const handleTriggerReflectionAi = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateAutoReflection(day);
      await onUpdateDay({
        ...day,
        dailyReflection: {
          ...reflection,
          ...generated,
        },
        tomorrowFirstAction: generated.tomorrowFirstAction || day.tomorrowFirstAction,
        notes: generated.notes || day.notes,
      });

      // Micro-celebration
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (e) {
      console.warn('Auto reflection error:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const sortedDays = [...allDaysList].sort((a, b) => b.date.localeCompare(a.date));
  const filteredDays = sortedDays.filter((d) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.date.includes(term) ||
      d.dayOfWeek.toLowerCase().includes(term) ||
      d.academics?.subject?.toLowerCase().includes(term) ||
      d.notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#11141c] border border-[#1f2638] mb-6">
        <button
          onClick={() => setActiveTab('reflection')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'reflection'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Daily Reflection & AI</span>
        </button>

        <button
          onClick={() => setActiveTab('trends')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'trends'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Behavioral Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Log History ({allDaysList.length})</span>
        </button>
      </div>

      {/* 1. REFLECTION TAB */}
      {activeTab === 'reflection' && (
        <div className="space-y-5">
          {/* AI Synthesis Callout */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#141724] to-[#121520] border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs mb-1 font-mono uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>AI Auto-Synthesizer</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Synthesize Day Without Typing Overhead</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Analyzes your completed blocks, DSA problems, and academic notes to write a cohesive reflection.
              </p>
            </div>

            <button
              onClick={handleTriggerReflectionAi}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-lg shadow-purple-950/30 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generating...' : 'Auto-Fill Reflection'}</span>
            </button>
          </div>

          {/* Biological State */}
          <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c]">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
              Physiological State & Energy
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Mood */}
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Mood Today (1-5)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => onUpdateDay({ ...day, mood: val })}
                      className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        day.mood === val
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-[#0e1118] text-zinc-400 hover:text-white border border-[#20283c]'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Energy Level (1-5)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => onUpdateDay({ ...day, energy: val })}
                      className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        day.energy === val
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-[#0e1118] text-zinc-400 hover:text-white border border-[#20283c]'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep */}
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Sleep Quality (1-5)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => onUpdateDay({ ...day, sleep: val })}
                      className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        day.sleep === val
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-[#0e1118] text-zinc-400 hover:text-white border border-[#20283c]'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tomorrow's First Action */}
          <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider font-mono">
                Tomorrow's First Concrete Action
              </label>
              <span className="text-[11px] text-zinc-400">Removes morning decision friction</span>
            </div>
            <input
              type="text"
              value={day.tomorrowFirstAction || ''}
              onChange={(e) => onUpdateDay({ ...day, tomorrowFirstAction: e.target.value })}
              placeholder="e.g. 06:00 AM — Solve Simplex tableau problem 3"
              className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Qualitative Reflection */}
          <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Day Debrief & Journal
            </label>
            <textarea
              rows={4}
              value={day.notes || ''}
              onChange={(e) => onUpdateDay({ ...day, notes: e.target.value })}
              placeholder="Overall qualitative synthesis of focus, discipline, and takeaways..."
              className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* 2. TRENDS TAB */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Weekly Behavioral Analytics</h2>
            <p className="text-xs text-zinc-400">Psychological patterns detected across recent days</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-semibold">
                      {item.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search history by date, subject, or reflection notes..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#131722] border border-[#20283c] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredDays.map((d) => (
              <div
                key={d.date}
                className="p-4 rounded-2xl bg-[#131722] border border-[#20283c] hover:border-zinc-700 transition-all flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-white">{d.date}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {d.dayOfWeek}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      {d.completionPercentage}% Done
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate max-w-md">
                    {d.academics?.subject ? `Study: ${d.academics.subject}` : 'Day logged'}
                    {d.workout?.cycleDay ? ` · ${d.workout.cycleDay}` : ''}
                  </p>
                </div>

                <button
                  onClick={() => onSelectDate(d.date)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
                >
                  <span>Open Day</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
