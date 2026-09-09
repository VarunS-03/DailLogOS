import React, { useState } from 'react';
import { BookOpen, Sparkles, Clock, CheckCircle2, History, ChevronRight } from 'lucide-react';
import { DayRecord, AcademicsSession } from '../types';
import { ACADEMIC_SUBJECTS } from '../constants/templates';

interface AcademicsViewProps {
  day: DayRecord;
  allDays?: Record<string, DayRecord>;
  onUpdateAcademics: (academics: AcademicsSession) => void;
  onSelectDate?: (dateStr: string) => void;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  day,
  allDays = {},
  onUpdateAcademics,
  onSelectDate,
}) => {
  const academics = day.academics;
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleChange = (field: keyof AcademicsSession, value: string) => {
    onUpdateAcademics({
      ...academics,
      [field]: value,
    });
  };

  // Find previous academic sessions from allDays
  const pastSessions = (Object.values(allDays) as DayRecord[])
    .filter((d) => d.date !== day.date && d.academics?.subject && (d.academics.learned || d.academics.objective))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-indigo-400 uppercase">
              WORK / ACADEMICS
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">06:00–07:30 Block</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Academic Deep Work
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Focus: First-principles comprehension, active retrieval, and deliberate repair.
          </p>
        </div>

        {/* Weekly Rotation Badge */}
        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-[#141824] px-3 py-1.5 rounded-lg border border-[#22293d]">
          <span className="text-zinc-400 font-mono text-[11px] uppercase">{day.dayOfWeek} Rotation:</span>
          <span className="font-semibold text-indigo-300">{academics.subject || 'Core'}</span>
          {academics.secondarySubject && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">{academics.secondarySubject}</span>
            </>
          )}
        </div>
      </div>

      {/* Philosophy Banner */}
      <div className="mb-6 p-3 rounded-xl bg-[#0f121a] border border-[#1d2232] flex items-center overflow-x-auto text-[11px] text-zinc-400 font-mono whitespace-nowrap scrollbar-none">
        <span className="text-indigo-400 font-semibold mr-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          RETRIEVAL PIPELINE:
        </span>
        <span className="text-zinc-200">Target</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Learn</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Close Book</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Retrieve</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Diagnose</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Repair</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Encode Output</span>
      </div>

      {/* Main Form Box */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#12151e] border border-[#202534] space-y-5">
        {/* Row 1: Subject, Secondary Subject, Time Spent */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Subject Focus
            </label>
            <select
              id="academics-subject"
              value={academics.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-indigo-500 transition-colors"
            >
              {ACADEMIC_SUBJECTS.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Secondary Subject (Optional)
            </label>
            <input
              type="text"
              id="academics-secondary-subject"
              value={academics.secondarySubject || ''}
              maxLength={100}
              onChange={(e) => handleChange('secondarySubject', e.target.value)}
              placeholder="e.g. C / Problem solving"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Time Spent
            </label>
            <input
              type="text"
              id="academics-time-spent"
              value={academics.timeSpent}
              maxLength={50}
              onChange={(e) => handleChange('timeSpent', e.target.value)}
              placeholder="e.g. 90m (06:00–07:30)"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Row 2: Objective */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
            <span>Session Objective</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">What specific concept or chapter?</span>
          </label>
          <input
            type="text"
            id="academics-objective"
            value={academics.objective}
            maxLength={2000}
            onChange={(e) => handleChange('objective', e.target.value)}
            placeholder="e.g. Simplex Method tableau formulation & pivot rule proofs"
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Row 3: What I Learned */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
            <span>What I Learned (Core Concepts & Synthesized Truths)</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">Detailed notes</span>
          </label>
          <textarea
            id="academics-learned"
            rows={3}
            value={academics.learned}
            maxLength={5000}
            onChange={(e) => handleChange('learned', e.target.value)}
            placeholder="Document key theorems, formulas, intuition, or architectural flows..."
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors resize-y leading-relaxed"
          />
        </div>

        {/* Row 4: Active Retrieval */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
            <span>Active Retrieval Check (Closed Book Prompt)</span>
            <span className="text-[10px] text-indigo-400 font-mono font-normal">Write from memory without looking</span>
          </label>
          <textarea
            id="academics-retrieve"
            rows={3}
            value={academics.retrieve}
            maxLength={5000}
            onChange={(e) => handleChange('retrieve', e.target.value)}
            placeholder="Explain the concept in your own words, derive the proof, or list the algorithm steps completely from memory..."
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors resize-y leading-relaxed font-mono text-[11px]"
          />
        </div>

        {/* Row 5: 2 Columns: Weak Areas + Output Produced */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-amber-300 mb-1.5">
              Weak Areas to Repair
            </label>
            <textarea
              id="academics-weak"
              rows={2}
              value={academics.weak}
              maxLength={5000}
              onChange={(e) => handleChange('weak', e.target.value)}
              placeholder="Where did retrieval stall? What edge cases need re-reading?"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#28251e] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500 transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-emerald-300 mb-1.5">
              Output Produced (Proof of Work)
            </label>
            <textarea
              id="academics-output"
              rows={2}
              value={academics.output}
              maxLength={5000}
              onChange={(e) => handleChange('output', e.target.value)}
              placeholder="e.g. 5 handwritten derivations, Anki deck with 12 cards, problem sheet 4 solved"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#1b2b22] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 transition-colors resize-y"
            />
          </div>
        </div>
      </div>

      {/* Previous Sessions / History in Academics */}
      {pastSessions.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Recent Academic Logs ({pastSessions.length})</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {pastSessions.map((past) => (
              <div
                key={past.date}
                className="p-3.5 rounded-xl bg-[#10131b] border border-[#1c2230] flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-medium text-zinc-200">{past.date}</span>
                    <span className="font-mono text-[10px] text-zinc-400 bg-[#161a25] px-1.5 py-0.5 rounded border border-[#222838]">
                      {past.dayOfWeek}
                    </span>
                    <span className="font-semibold text-indigo-300">{past.academics.subject}</span>
                  </div>
                  {past.academics.objective && (
                    <p className="text-zinc-300 truncate font-medium">{past.academics.objective}</p>
                  )}
                  {past.academics.learned && (
                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{past.academics.learned}</p>
                  )}
                </div>

                {onSelectDate && (
                  <button
                    onClick={() => onSelectDate(past.date)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-[#161b27] hover:bg-[#1d2333] border border-[#232a3e] rounded-md transition-colors shrink-0"
                  >
                    <span>View Day</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
