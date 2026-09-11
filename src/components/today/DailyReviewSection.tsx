import React from 'react';
import { Moon, Sparkles, Sun, BatteryCharging, BedDouble, Compass } from 'lucide-react';
import { DailyReflection } from '../../types';

interface DailyReviewSectionProps {
  reflection: DailyReflection;
  mood: number;
  energy: number;
  sleep: number;
  tomorrowFirstAction: string;
  notes: string;
  onUpdateReflection: (reflection: DailyReflection) => void;
  onUpdateStats: (updates: { mood?: number; energy?: number; sleep?: number; tomorrowFirstAction?: string; notes?: string }) => void;
}

export const DailyReviewSection: React.FC<DailyReviewSectionProps> = ({
  reflection,
  mood,
  energy,
  sleep,
  tomorrowFirstAction,
  notes,
  onUpdateReflection,
  onUpdateStats,
}) => {
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
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </span>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`w-8 h-7 rounded-md text-xs font-mono font-medium border transition-colors ${
                value === num
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-500 font-bold'
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
    <section id="section-daily-review" className="mb-12 p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1d222e]">
        <div className="flex items-center space-x-2">
          <Moon className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Daily Review & Sleep Calibration
          </h2>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono">(End of Day · Optional)</span>
      </div>

      {/* Vital Metrics: Mood, Energy, Sleep */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 p-3 rounded-lg bg-[#0e1118] border border-[#202638]">
        {renderRatingButtons(
          mood,
          (val) => onUpdateStats({ mood: val }),
          'Daily Mood (1-5)',
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        )}
        {renderRatingButtons(
          energy,
          (val) => onUpdateStats({ energy: val }),
          'Energy Level (1-5)',
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
        )}
        {renderRatingButtons(
          sleep,
          (val) => onUpdateStats({ sleep: val }),
          'Sleep Quality (1-5)',
          <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
        )}
      </div>

      {/* Tomorrow's First Action - Highlighted */}
      <div className="mb-5 p-3 rounded-lg bg-[#141824] border border-[#273044]">
        <label className="block text-xs font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-zinc-400" />
          <span>Tomorrow: What is the first concrete action tomorrow morning?</span>
        </label>
        <p className="text-[11px] text-zinc-400 mb-2">
          Eliminate morning decision fatigue. Exactly what file, problem, or text opens at 06:00?
        </p>
        <input
          type="text"
          value={tomorrowFirstAction}
          onChange={(e) => onUpdateStats({ tomorrowFirstAction: e.target.value })}
          placeholder="e.g. Open LeetCode 33, implement binary search rotated array template directly without looking up hints."
          className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-400 font-medium"
        />
      </div>

      {/* Structured Review Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Academic Synthesis */}
        <div className="p-3 rounded-lg bg-[#0e1118] border border-[#1e2433]">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Academic Synthesis
          </h4>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">What did I learn?</span>
              <input
                type="text"
                value={reflection.academicLearned}
                onChange={(e) => handleReflectionChange('academicLearned', e.target.value)}
                placeholder="Core takeaways..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">What can I retrieve?</span>
              <input
                type="text"
                value={reflection.academicRetrieve}
                onChange={(e) => handleReflectionChange('academicRetrieve', e.target.value)}
                placeholder="Without checking notes..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">What remains weak?</span>
              <input
                type="text"
                value={reflection.academicWeak}
                onChange={(e) => handleReflectionChange('academicWeak', e.target.value)}
                placeholder="Needs repair next slot..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* DSA Review */}
        <div className="p-3 rounded-lg bg-[#0e1118] border border-[#1e2433]">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            DSA Problem Review
          </h4>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">Problem & Pattern</span>
              <input
                type="text"
                value={reflection.dsaProblem}
                onChange={(e) => handleReflectionChange('dsaProblem', e.target.value)}
                placeholder="Problem name / pattern..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">Core Insight</span>
              <input
                type="text"
                value={reflection.dsaInsight}
                onChange={(e) => handleReflectionChange('dsaInsight', e.target.value)}
                placeholder="The pivotal realization..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">Mistake / Review Date</span>
              <input
                type="text"
                value={reflection.dsaMistake}
                onChange={(e) => handleReflectionChange('dsaMistake', e.target.value)}
                placeholder="Key mistake to avoid next time..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Project & Notes */}
        <div className="p-3 rounded-lg bg-[#0e1118] border border-[#1e2433]">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Artifact & General Notes
          </h4>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">
                What artifact or feature moved forward?
              </span>
              <input
                type="text"
                value={reflection.projectArtifact}
                onChange={(e) => handleReflectionChange('projectArtifact', e.target.value)}
                placeholder="Concrete tangible artifact..."
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-mono">
                Short Evening Reflection / Note
              </span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => {
                  onUpdateStats({ notes: e.target.value });
                  handleReflectionChange('notes', e.target.value);
                }}
                placeholder="General observations, mindset, physical feelings..."
                className="w-full p-2 bg-[#131620] border border-[#232938] rounded text-xs text-zinc-200 focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
