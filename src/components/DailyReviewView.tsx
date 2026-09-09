import React from 'react';
import {
  Moon,
  Sparkles,
  Sun,
  BatteryCharging,
  BedDouble,
  Compass,
  ArrowRight,
  BookOpen,
  Code2,
  Terminal,
  CheckCircle2,
} from 'lucide-react';
import { DailyReflection, DayRecord } from '../types';

interface DailyReviewViewProps {
  day: DayRecord;
  onUpdateReflection: (reflection: DailyReflection) => void;
  onUpdateStats: (updates: {
    mood?: number;
    energy?: number;
    sleep?: number;
    tomorrowFirstAction?: string;
    notes?: string;
  }) => void;
}

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  day,
  onUpdateReflection,
  onUpdateStats,
}) => {
  const reflection = day.dailyReflection;
  const mood = day.mood || 3;
  const energy = day.energy || 3;
  const sleep = day.sleep || 3;
  const tomorrowFirstAction = day.tomorrowFirstAction || '';
  const notes = day.notes || '';

  const handleReflectionChange = (field: keyof DailyReflection, value: string) => {
    onUpdateReflection({
      ...reflection,
      [field]: value,
    });
  };

  const renderRatingButtons = (
    value: number,
    onChange: (val: number) => void,
    label: string,
    icon: React.ReactNode
  ) => {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </span>
        <div className="flex items-center space-x-1.5">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`w-9 h-8 rounded-lg text-xs font-mono font-medium border transition-colors ${
                value === num
                  ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-xs'
                  : 'bg-[#0f1218] text-zinc-400 border-[#232938] hover:text-zinc-200 hover:bg-[#161a23]'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Moon className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-purple-400 uppercase">
              LOGBOOK / DAILY REVIEW
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">Evening Calibration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            End-of-Day Review & System Calibration
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Reflect on what was encoded, synthesize lessons learned, and prime tomorrow's lead action.
          </p>
        </div>

        <div className="text-xs font-mono text-zinc-400 bg-[#12151e] border border-[#202534] px-3 py-1.5 rounded-lg">
          Date: <span className="text-zinc-200 font-semibold">{day.date}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Physiological Calibration Ratings: Mood, Energy, Sleep */}
        <div className="p-5 rounded-xl bg-[#12151e] border border-[#202534]">
          <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-300 mb-4 flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-purple-400" />
            <span>Physiological State (1 to 5 Scale)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {renderRatingButtons(
              mood,
              (val) => onUpdateStats({ mood: val }),
              'Mood / Focus',
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}

            {renderRatingButtons(
              energy,
              (val) => onUpdateStats({ energy: val }),
              'Physical Energy',
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            )}

            {renderRatingButtons(
              sleep,
              (val) => onUpdateStats({ sleep: val }),
              'Prior Sleep Quality',
              <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </div>
        </div>

        {/* The Lead Morning Domino */}
        <div className="p-5 rounded-xl bg-[#151221] border border-purple-900/40">
          <label className="block text-xs font-semibold uppercase font-mono tracking-wide text-purple-300 mb-2 flex items-center gap-2">
            <Compass className="w-4 h-4 text-purple-400" />
            <span>Tomorrow's First Concrete Action (06:00 AM Prompt)</span>
          </label>
          <input
            type="text"
            id="review-tomorrow-action"
            value={tomorrowFirstAction}
            maxLength={1000}
            onChange={(e) => onUpdateStats({ tomorrowFirstAction: e.target.value })}
            placeholder="e.g. Open Simplex tableau notebook, page 42, solve problem 3"
            className="w-full px-3.5 py-2.5 bg-[#0e1018] border border-purple-800/60 rounded-lg text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-purple-400 font-medium"
          />
          <p className="text-[11px] text-zinc-400 mt-2">
            Set this now so there is zero friction or decision fatigue when your alarm sounds tomorrow morning.
          </p>
        </div>

        {/* Academic Reflection */}
        <div className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#1d222e]">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
              Academic Retention Reflection
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                What Did I Learn?
              </label>
              <textarea
                rows={3}
                value={reflection.academicLearned}
                maxLength={5000}
                onChange={(e) => handleReflectionChange('academicLearned', e.target.value)}
                placeholder="High-level synthesis..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-indigo-500 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-indigo-300 mb-1">
                What Can I Retrieve?
              </label>
              <textarea
                rows={3}
                value={reflection.academicRetrieve}
                maxLength={5000}
                onChange={(e) => handleReflectionChange('academicRetrieve', e.target.value)}
                placeholder="Facts or proofs recallable without reference..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-indigo-500 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">
                What Remains Weak?
              </label>
              <textarea
                rows={3}
                value={reflection.academicWeak}
                maxLength={5000}
                onChange={(e) => handleReflectionChange('academicWeak', e.target.value)}
                placeholder="Specific doubts to resolve during next slot..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500 resize-y leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* DSA Review */}
        <div className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#1d222e]">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
              DSA & Algorithmic Retrospective
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Problem & Pattern Examined
              </label>
              <input
                type="text"
                value={reflection.dsaProblem}
                maxLength={500}
                onChange={(e) => handleReflectionChange('dsaProblem', e.target.value)}
                placeholder="e.g. 3Sum (Two Pointers after Sorting)"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Spaced Review Date
              </label>
              <input
                type="date"
                value={reflection.dsaReviewDate}
                onChange={(e) => handleReflectionChange('dsaReviewDate', e.target.value)}
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-emerald-300 mb-1">
                Core Insight Internalized
              </label>
              <textarea
                rows={2}
                value={reflection.dsaInsight}
                maxLength={10000}
                onChange={(e) => handleReflectionChange('dsaInsight', e.target.value)}
                placeholder="The fundamental invariant or shortcut..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#1e2f24] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">
                Mistake Made & Root Cause
              </label>
              <textarea
                rows={2}
                value={reflection.dsaMistake}
                maxLength={5000}
                onChange={(e) => handleReflectionChange('dsaMistake', e.target.value)}
                placeholder="Why did I stall? Edge cases forgotten?"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#2e261d] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500 resize-y"
              />
            </div>
          </div>
        </div>

        {/* Project Artifact & General Daily Notes */}
        <div className="p-5 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#1d222e]">
            <Terminal className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
              Engineering & Daily Journal Synthesis
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Project Artifact Produced / Shipped Today
            </label>
            <input
              type="text"
              value={reflection.projectArtifact}
              maxLength={5000}
              onChange={(e) => handleReflectionChange('projectArtifact', e.target.value)}
              placeholder="e.g. Navigation refactor finished, 4 API tests passing"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Overall Day Reflection & Qualitative Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              maxLength={10000}
              onChange={(e) => onUpdateStats({ notes: e.target.value })}
              placeholder="How was today's discipline? Any disruptions to protect against tomorrow?"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-400 resize-y leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
