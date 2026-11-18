import React, { useEffect, useState } from 'react';
import {
  Code2,
  BookOpen,
  Dumbbell,
  Terminal,
  Sparkles,
  Plus,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Flame,
  Brain,
  Trash2,
  Lightbulb,
} from 'lucide-react';
import { DayRecord, DsaProblem, SystemModuleId, WorkoutSession, AcademicsSession, ProjectSession } from '../types';
import { assistDsaProblem, DsaAiAssistance } from '../services/ai';
import { GYM_WORKOUT_PLANS, CALISTHENICS_WORKOUT_PLANS, ACADEMIC_SUBJECTS } from '../constants/templates';

interface TrackViewProps {
  day: DayRecord;
  onUpdateDay: (updatedDay: DayRecord, baseDay?: DayRecord) => Promise<void>;
  initialSection?: 'dsa' | 'academics' | 'workout' | 'projects';
  enabledModules: SystemModuleId[];
  aiEnabled: boolean;
}

export const TrackView: React.FC<TrackViewProps> = ({
  day,
  onUpdateDay,
  initialSection = 'dsa',
  enabledModules,
  aiEnabled,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dsa' | 'academics' | 'workout' | 'projects'>(initialSection);

  // DSA State
  const [showAddDsa, setShowAddDsa] = useState(false);
  const [problemTitle, setProblemTitle] = useState('');
  const [platform, setPlatform] = useState<DsaProblem['platform']>('LeetCode');
  const [difficulty, setDifficulty] = useState<DsaProblem['difficulty']>('Medium');
  const [aiAssistance, setAiAssistance] = useState<DsaAiAssistance | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (enabledModules.includes(activeSubTab)) return;
    const nextModule = (['dsa', 'academics', 'workout', 'projects'] as const)
      .find((module) => enabledModules.includes(module));
    if (nextModule) setActiveSubTab(nextModule);
  }, [activeSubTab, enabledModules]);

  // Request AI Assistance for DSA
  const handleAskDsaAi = async () => {
    if (!aiEnabled || !problemTitle.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await assistDsaProblem(problemTitle, platform, difficulty);
      setAiAssistance(res);
    } catch (e) {
      console.warn('AI assistance error:', e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveDsa = async () => {
    if (!problemTitle.trim()) return;

    const newProblem: DsaProblem = {
      id: `dsa-${Date.now()}`,
      problem: problemTitle.trim(),
      platform,
      difficulty,
      pattern: aiAssistance?.patternDetected || 'General Technique',
      firstIdea: '',
      solvedIndependently: true,
      failureMistake: aiAssistance?.pitfallToAvoid || '',
      insight: aiAssistance?.keyObservation || '',
      algorithm: aiAssistance?.recommendedApproach || '',
      timeComplexity: aiAssistance?.timeComplexityHint || 'O(N)',
      spaceComplexity: aiAssistance?.spaceComplexityHint || 'O(1)',
      reimplemented: false,
      reviewDate: '',
      tags: ['Classify', 'Insight'],
    };

    const updated = [...(day.dsa || []), newProblem];
    await onUpdateDay({ ...day, dsa: updated }, day);

    setProblemTitle('');
    setAiAssistance(null);
    setShowAddDsa(false);
  };

  const handleDeleteDsa = async (id: string) => {
    const updated = (day.dsa || []).filter((p) => p.id !== id);
    await onUpdateDay({ ...day, dsa: updated }, day);
  };

  // Workout state
  const workout = day.workout;
  const toggleExercise = async (id: string) => {
    const updatedEx = workout.exercises.map((ex) => {
      if (ex.id === id) {
        return { ...ex, completed: !ex.completed };
      }
      return ex;
    });
    await onUpdateDay({
      ...day,
      workout: { ...workout, exercises: updatedEx },
    }, day);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#11141c] border border-[#1f2638] mb-6">
        {enabledModules.includes('dsa') && <button
          onClick={() => setActiveSubTab('dsa')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'dsa'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>DSA Practice ({day.dsa?.length || 0})</span>
        </button>}

        {enabledModules.includes('academics') && <button
          onClick={() => setActiveSubTab('academics')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'academics'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Academics</span>
        </button>}

        {enabledModules.includes('workout') && <button
          onClick={() => setActiveSubTab('workout')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'workout'
              ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>Workout</span>
        </button>}

        {enabledModules.includes('projects') && <button
          onClick={() => setActiveSubTab('projects')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'projects'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Projects</span>
        </button>}
      </div>

      {/* 1. DSA SUB-TAB */}
      {activeSubTab === 'dsa' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Data Structures & Algorithms</h2>
              <p className="text-xs text-zinc-400">Streamlined logging with instant AI pattern assistance</p>
            </div>
            <button
              onClick={() => setShowAddDsa(!showAddDsa)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-950/30"
            >
              <Plus className="w-4 h-4" />
              <span>Log Problem</span>
            </button>
          </div>

          {/* Add Problem Modal / Drawer */}
          {showAddDsa && (
            <div className="p-5 rounded-2xl bg-[#131722] border border-emerald-500/30 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#20283c]">
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider font-mono">
                  Quick Problem Logger + AI Coach
                </span>
                <span className="text-[11px] text-zinc-400">{aiEnabled ? 'AI auto-fills patterns & complexities' : 'Manual problem logging'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">Problem Title</label>
                  <input
                    type="text"
                    value={problemTitle}
                    onChange={(e) => setProblemTitle(e.target.value)}
                    placeholder="e.g. 3Sum, Trapping Rain Water, Course Schedule"
                    className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                {aiEnabled && <button
                  type="button"
                  onClick={handleAskDsaAi}
                  disabled={!problemTitle.trim() || isAiLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? 'Analyzing...' : 'AI Pattern & Approach Hints'}</span>
                </button>}
              </div>

              {/* AI Guidance Box */}
              {aiAssistance && (
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                    <Lightbulb className="w-4 h-4" />
                    <span>Pattern: {aiAssistance.patternDetected}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 font-mono">
                      {aiAssistance.timeComplexityHint}
                    </span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">{aiAssistance.recommendedApproach}</p>
                  <div className="text-[11px] text-zinc-400">
                    <strong className="text-amber-300">Watch out: </strong>
                    {aiAssistance.pitfallToAvoid}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddDsa(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDsa}
                  disabled={!problemTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Save Problem
                </button>
              </div>
            </div>
          )}

          {/* Problem List */}
          <div className="space-y-2.5">
            {(!day.dsa || day.dsa.length === 0) && (
              <div className="p-8 text-center rounded-2xl bg-[#131722] border border-[#1f2638]">
                <Code2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-zinc-300">No problems logged today</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Click 'Log Problem' or use the quick AI command to record your LeetCode patterns.
                </p>
              </div>
            )}

            {day.dsa?.map((prob) => (
              <div
                key={prob.id}
                className="p-4 rounded-2xl bg-[#131722] border border-[#20283c] hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                        prob.difficulty === 'Easy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : prob.difficulty === 'Medium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {prob.difficulty}
                    </span>
                    <h4 className="text-sm font-semibold text-white truncate">{prob.problem}</h4>
                    <span className="text-xs text-zinc-500 font-mono">({prob.platform})</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                    <span className="text-emerald-400">{prob.pattern}</span>
                    <span>·</span>
                    <span>Time: {prob.timeComplexity || 'O(N)'}</span>
                    {prob.insight && (
                      <>
                        <span>·</span>
                        <span className="text-zinc-300 italic truncate max-w-xs">{prob.insight}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDeleteDsa(prob.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ACADEMICS SUB-TAB */}
      {activeSubTab === 'academics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Academic Deep Work</h2>
              <p className="text-xs text-zinc-400">Targeted study session with retrieval notes</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Subject Focus</label>
                <select
                  value={day.academics?.subject || 'Optimization Techniques'}
                  onChange={(e) =>
                    onUpdateDay({
                      ...day,
                      academics: { ...day.academics, subject: e.target.value },
                    }, day)
                  }
                  className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {ACADEMIC_SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Time Spent</label>
                <input
                  type="text"
                  value={day.academics?.timeSpent || '90m'}
                  onChange={(e) =>
                    onUpdateDay({
                      ...day,
                      academics: { ...day.academics, timeSpent: e.target.value },
                    }, day)
                  }
                  placeholder="e.g. 90 minutes"
                  className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">Session Objective</label>
              <input
                type="text"
                value={day.academics?.objective || ''}
                onChange={(e) =>
                  onUpdateDay({
                    ...day,
                    academics: { ...day.academics, objective: e.target.value },
                  }, day)
                }
                placeholder="e.g. Master Simplex algorithm tableau pivot rules"
                className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">Active Retrieval & Key Learnings</label>
              <textarea
                rows={3}
                value={day.academics?.learned || ''}
                onChange={(e) =>
                  onUpdateDay({
                    ...day,
                    academics: { ...day.academics, learned: e.target.value },
                  }, day)
                }
                placeholder="What did you learn from memory without looking at notes?..."
                className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. WORKOUT SUB-TAB */}
      {activeSubTab === 'workout' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Physical Training</h2>
              <p className="text-xs text-zinc-400">{workout.cycleDay} · Tap exercise to mark done</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">
                {workout.exercises.filter((e) => e.completed).length} / {workout.exercises.length} Done
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workout.exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => toggleExercise(ex.id)}
                className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 transition-all cursor-pointer ${
                  ex.completed
                    ? 'bg-orange-950/20 border-orange-500/40 text-orange-200'
                    : 'bg-[#131722] border-[#20283c] hover:border-zinc-700 text-zinc-200'
                }`}
              >
                <div>
                  <h4 className={`text-sm font-semibold ${ex.completed ? 'line-through text-zinc-400' : 'text-white'}`}>
                    {ex.name}
                  </h4>
                  <span className="text-xs text-zinc-400 font-mono mt-1 block">Target: {ex.target}</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    ex.completed ? 'bg-orange-500 border-orange-400 text-white' : 'border-zinc-600'
                  }`}
                >
                  {ex.completed && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. PROJECTS SUB-TAB */}
      {activeSubTab === 'projects' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Engineering Sprint</h2>
            <p className="text-xs text-zinc-400">Ship tangible artifacts every single day</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#131722] border border-[#20283c] space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">Project Name</label>
              <input
                type="text"
                value={day.project?.name || ''}
                onChange={(e) =>
                  onUpdateDay({
                    ...day,
                    project: { ...day.project, name: e.target.value },
                  }, day)
                }
                placeholder="e.g. Distributed Task Queue"
                className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">Artifact Shipped / Output</label>
              <textarea
                rows={3}
                value={day.project?.artifact || ''}
                onChange={(e) =>
                  onUpdateDay({
                    ...day,
                    project: { ...day.project, artifact: e.target.value },
                  }, day)
                }
                placeholder="What did you deploy, merge, or write tests for today?..."
                className="w-full px-3.5 py-2.5 bg-[#0b0e15] border border-[#232c3f] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
