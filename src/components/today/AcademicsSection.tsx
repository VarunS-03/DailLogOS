import React from 'react';
import { BookOpen, Sparkles, Layers, CheckCircle } from 'lucide-react';
import { AcademicsSession } from '../../types';
import { ACADEMIC_SUBJECTS } from '../../constants/templates';

interface AcademicsSectionProps {
  academics: AcademicsSession;
  dayOfWeek: string;
  onUpdateAcademics: (academics: AcademicsSession) => void;
}

export const AcademicsSection: React.FC<AcademicsSectionProps> = ({
  academics,
  dayOfWeek,
  onUpdateAcademics,
}) => {
  const handleChange = (field: keyof AcademicsSession, value: string) => {
    onUpdateAcademics({
      ...academics,
      [field]: value,
    });
  };

  return (
    <section id="section-academics" className="mb-8 p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#1d222e]">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Academic Deep Work
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">(06:00–07:30 Block)</span>
        </div>

        {/* Weekly Rotation Badge */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-[#161a24] px-2.5 py-1 rounded-md border border-[#222838]">
          <span className="text-zinc-500 font-mono text-[10px] uppercase">{dayOfWeek} Rotation:</span>
          <span className="font-semibold text-zinc-200">{academics.subject || 'Core'}</span>
          {academics.secondarySubject && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">{academics.secondarySubject}</span>
            </>
          )}
        </div>
      </div>

      {/* Philosophy flow banner */}
      <div className="mb-4 px-3 py-2 rounded-lg bg-[#0e1117] border border-[#1b202c] flex items-center overflow-x-auto text-[10px] text-zinc-400 font-mono whitespace-nowrap scrollbar-none">
        <span className="text-zinc-400 font-semibold mr-1">PHILOSOPHY:</span>
        <span className="text-zinc-300">Target</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Learn</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Close</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Retrieve</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Apply</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Diagnose</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Repair</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Encode</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Schedule</span>
      </div>

      {/* Main Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* Subject select */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Subject
          </label>
          <select
            id="academics-subject"
            value={academics.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-zinc-500"
          >
            {ACADEMIC_SUBJECTS.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Time spent */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Time Spent
          </label>
          <input
            type="text"
            id="academics-time-spent"
            value={academics.timeSpent}
            onChange={(e) => handleChange('timeSpent', e.target.value)}
            placeholder="e.g. 90 min"
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
          />
        </div>

        {/* Output produced */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Output Produced (Notes / Code / Problems)
          </label>
          <input
            type="text"
            id="academics-output"
            value={academics.output}
            onChange={(e) => handleChange('output', e.target.value)}
            placeholder="e.g. Solved 4 Simplex proofs, 2 flashcards"
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
          />
        </div>
      </div>

      {/* Objective */}
      <div className="mb-3">
        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
          Objective (Clear Target for the Block)
        </label>
        <input
          type="text"
          id="academics-objective"
          value={academics.objective}
          onChange={(e) => handleChange('objective', e.target.value)}
          placeholder="e.g. Master dual Simplex formulation and solve 2 standard canonical problems"
          className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
        />
      </div>

      {/* 3-Column Retrieval / Reflection Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            What I Learned
          </label>
          <textarea
            rows={3}
            id="academics-learned"
            value={academics.learned}
            onChange={(e) => handleChange('learned', e.target.value)}
            placeholder="Key mechanisms, formulas, or theorems acquired..."
            className="w-full p-2.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            What I Can Retrieve (Without Notes)
          </label>
          <textarea
            rows={3}
            id="academics-retrieve"
            value={academics.retrieve}
            onChange={(e) => handleChange('retrieve', e.target.value)}
            placeholder="Active recall test: mental summary or diagram from memory..."
            className="w-full p-2.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            What Remains Weak (Target for Repair)
          </label>
          <textarea
            rows={3}
            id="academics-weak"
            value={academics.weak}
            onChange={(e) => handleChange('weak', e.target.value)}
            placeholder="Friction points, ambiguity, edge cases to re-encode..."
            className="w-full p-2.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500 resize-none"
          />
        </div>
      </div>
    </section>
  );
};
