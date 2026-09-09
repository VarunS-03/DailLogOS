import React from 'react';
import { Terminal, Hammer, ArrowRight, AlertCircle, Sparkles, Layers } from 'lucide-react';
import { DayRecord, ProjectSession, SkillSession } from '../types';

interface ProjectsViewProps {
  day: DayRecord;
  onUpdateProject: (project: ProjectSession) => void;
  onUpdateSkills: (skills: SkillSession) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  day,
  onUpdateProject,
  onUpdateSkills,
}) => {
  const project = day.project;
  const skills = day.skills;

  const handleProjectChange = (field: keyof ProjectSession, value: string) => {
    onUpdateProject({
      ...project,
      [field]: value,
    });
  };

  const handleSkillChange = (field: keyof SkillSession, value: string) => {
    onUpdateSkills({
      ...skills,
      [field]: value,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-sky-400 uppercase">
              WORK / PROJECTS & ENGINEERING
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">20:40–22:00 Block</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Project & Technical Skill Acquisition
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Focus: Tangible engineering artifacts, ship velocity, and technical capability building.
          </p>
        </div>
      </div>

      {/* Engineering Lifecycle Reminder */}
      <div className="mb-6 p-3 rounded-xl bg-[#0f121a] border border-[#1d2232] flex items-center overflow-x-auto text-[11px] text-zinc-400 font-mono whitespace-nowrap scrollbar-none">
        <span className="text-sky-400 font-semibold mr-1.5 flex items-center gap-1">
          <Hammer className="w-3 h-3" />
          LIFECYCLE:
        </span>
        <span className="text-zinc-200">Problem Framing</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">System Design</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Minimal Prototype</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Core Engineering</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-200">Deploy & Ship</span>
      </div>

      {/* Section 1: Main Project Log */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#12151e] border border-[#202534] space-y-4 mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#1d222e]">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Primary Engineering Sprint</span>
          </h2>
          <span className="text-xs text-zinc-400 font-mono">Date: {day.date}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Project Name / Repository
            </label>
            <input
              type="text"
              value={project.name}
              maxLength={200}
              onChange={(e) => handleProjectChange('name', e.target.value)}
              placeholder="e.g. DAILY OS / Distributed Key-Value Store"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          {/* Block Goal */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Sprint Goal for this Block
            </label>
            <input
              type="text"
              value={project.goal}
              maxLength={2000}
              onChange={(e) => handleProjectChange('goal', e.target.value)}
              placeholder="e.g. Implement Raft leader election RPC handlers"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        {/* Work Done */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
            <span>Work Done (Concrete Implementation Details)</span>
            <span className="text-[10px] text-zinc-500 font-mono">Files, modules, logic</span>
          </label>
          <textarea
            rows={3}
            value={project.workedOn}
            maxLength={5000}
            onChange={(e) => handleProjectChange('workedOn', e.target.value)}
            placeholder="Wrote candidate request vote timer, handled term increments, passed unit test suite..."
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 resize-y leading-relaxed"
          />
        </div>

        {/* 2 Columns: Artifact Produced & Blockers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-emerald-300 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Artifact Produced (Shipped Proof)</span>
            </label>
            <textarea
              rows={2}
              value={project.artifact}
              maxLength={5000}
              onChange={(e) => handleProjectChange('artifact', e.target.value)}
              placeholder="e.g. PR #14 merged, commit 8f9a2b, Docker image deployed"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#1d2d24] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-amber-300 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Blockers & Technical Roadblocks</span>
            </label>
            <textarea
              rows={2}
              value={project.blocker}
              maxLength={5000}
              onChange={(e) => handleProjectChange('blocker', e.target.value)}
              placeholder="e.g. Goroutine deadlock during split-brain simulation"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#2e261d] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500 resize-y"
            />
          </div>
        </div>

        {/* Next Action */}
        <div>
          <label className="block text-xs font-medium text-sky-300 mb-1 flex items-center gap-1">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Next Concrete Engineering Action</span>
          </label>
          <input
            type="text"
            value={project.nextAction}
            maxLength={2000}
            onChange={(e) => handleProjectChange('nextAction', e.target.value)}
            placeholder="e.g. Write snapshot compaction handler before tomorrow evening"
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#1e2a3c] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Section 2: Skill Acquisition / Technical Reading */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#12151e] border border-[#202534] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1d222e]">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Technical Skill Acquisition (22:00–22:30)
          </h2>
          <span className="text-xs text-zinc-400 font-mono">Documentation, RFCs, Papers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Skill / Topic / Paper
            </label>
            <input
              type="text"
              value={skills.topic}
              maxLength={200}
              onChange={(e) => handleSkillChange('topic', e.target.value)}
              placeholder="e.g. Linux eBPF internals / PostgreSQL WAL architecture"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Specific Focus
            </label>
            <input
              type="text"
              value={skills.focus}
              maxLength={2000}
              onChange={(e) => handleSkillChange('focus', e.target.value)}
              placeholder="e.g. Chapter 4: Checkpointing and recovery protocols"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Core Takeaways & Synthesized Notes
          </label>
          <textarea
            rows={3}
            value={skills.notes}
            maxLength={5000}
            onChange={(e) => handleSkillChange('notes', e.target.value)}
            placeholder="Key mental models, architecture notes, performance tradeoffs..."
            className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 resize-y leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
