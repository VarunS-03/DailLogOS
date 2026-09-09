import React from 'react';
import { Terminal, Hammer, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { ProjectSession, SkillSession } from '../../types';

interface ProjectSkillSectionProps {
  project: ProjectSession;
  skills: SkillSession;
  onUpdateProject: (project: ProjectSession) => void;
  onUpdateSkills: (skills: SkillSession) => void;
}

export const ProjectSkillSection: React.FC<ProjectSkillSectionProps> = ({
  project,
  skills,
  onUpdateProject,
  onUpdateSkills,
}) => {
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
    <section id="section-project-skill" className="mb-8 p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#1d222e]">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Project / Engineering Block
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">(20:40–22:00 Block)</span>
        </div>
        <div className="text-[11px] text-zinc-400 font-mono">
          Focus: High-leverage output & engineering
        </div>
      </div>

      {/* Engineering lifecycle reminder */}
      <div className="mb-4 px-3 py-2 rounded-lg bg-[#0e1117] border border-[#1b202c] flex items-center overflow-x-auto text-[10px] text-zinc-400 font-mono whitespace-nowrap scrollbar-none">
        <span className="text-zinc-400 font-semibold mr-1">PROCESS:</span>
        <span className="text-zinc-300">Problem</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Research</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">MVP</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Engineering</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Deploy</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Document</span>
        <span className="mx-1 text-zinc-600">→</span>
        <span className="text-zinc-300">Postmortem</span>
      </div>

      {/* Project Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Project / Skill Name
          </label>
          <input
            type="text"
            value={project.name}
            onChange={(e) => handleProjectChange('name', e.target.value)}
            placeholder="e.g. DAILY OS / Distributed Key-Value Store / C Kernel"
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Block Goal
          </label>
          <input
            type="text"
            value={project.goal}
            onChange={(e) => handleProjectChange('goal', e.target.value)}
            placeholder="e.g. Implement WAL recovery protocol or optimize b-tree search"
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            What I Worked On
          </label>
          <textarea
            rows={2}
            value={project.workedOn}
            onChange={(e) => handleProjectChange('workedOn', e.target.value)}
            placeholder="Specific modules, refactoring, tests written..."
            className="w-full p-2.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Artifact / Feature Produced
          </label>
          <textarea
            rows={2}
            value={project.artifact}
            onChange={(e) => handleProjectChange('artifact', e.target.value)}
            placeholder="PR merged, test suite passing, Docker container running, documentation..."
            className="w-full p-2.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>Blocker / Architectural Ambiguity</span>
          </label>
          <input
            type="text"
            value={project.blocker}
            onChange={(e) => handleProjectChange('blocker', e.target.value)}
            placeholder="Any friction or missing prerequisite..."
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-emerald-400" />
            <span>Next Concrete Action</span>
          </label>
          <input
            type="text"
            value={project.nextAction}
            onChange={(e) => handleProjectChange('nextAction', e.target.value)}
            placeholder="Immediate next task to pick up in the next session..."
            className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
        </div>
      </div>
    </section>
  );
};
