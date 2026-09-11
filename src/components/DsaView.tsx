import React, { useState } from 'react';
import {
  Code2,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Tag,
  ExternalLink,
  Brain,
  History,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { DayRecord, DsaProblem } from '../types';
import { DSA_TAGS } from '../constants/templates';
import { getLocalDateId } from '../utils/localDate';

interface DsaViewProps {
  day: DayRecord;
  allDays?: Record<string, DayRecord>;
  onUpdateProblems: (problems: DsaProblem[]) => void;
  onSelectDate?: (dateStr: string) => void;
}

export const DsaView: React.FC<DsaViewProps> = ({
  day,
  allDays = {},
  onUpdateProblems,
  onSelectDate,
}) => {
  const problems = day.dsa || [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);

  // Form state
  const [problem, setProblem] = useState('');
  const [platform, setPlatform] = useState<DsaProblem['platform']>('LeetCode');
  const [difficulty, setDifficulty] = useState<DsaProblem['difficulty']>('Medium');
  const [pattern, setPattern] = useState('');
  const [firstIdea, setFirstIdea] = useState('');
  const [solvedIndependently, setSolvedIndependently] = useState(true);
  const [failureMistake, setFailureMistake] = useState('');
  const [insight, setInsight] = useState('');
  const [algorithm, setAlgorithm] = useState('');
  const [timeComplexity, setTimeComplexity] = useState('O(N)');
  const [spaceComplexity, setSpaceComplexity] = useState('O(1)');
  const [reimplemented, setReimplemented] = useState(false);
  const [reviewDate, setReviewDate] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Insight']);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddProblem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim()) return;

    const newProblem: DsaProblem = {
      id: `dsa-${Date.now()}`,
      problem: problem.trim(),
      platform,
      difficulty,
      pattern: pattern.trim() || 'General',
      firstIdea: firstIdea.trim(),
      solvedIndependently,
      failureMistake: failureMistake.trim(),
      insight: insight.trim(),
      algorithm: algorithm.trim(),
      timeComplexity: timeComplexity.trim() || 'O(N)',
      spaceComplexity: spaceComplexity.trim() || 'O(1)',
      reimplemented,
      reviewDate: reviewDate || getLocalDateId(new Date(Date.now() + 3 * 86400000)),
      tags: selectedTags,
    };

    onUpdateProblems([...problems, newProblem]);

    // Reset form
    setProblem('');
    setPattern('');
    setFirstIdea('');
    setFailureMistake('');
    setInsight('');
    setAlgorithm('');
    setSelectedTags(['Insight']);
    setShowAddForm(false);
  };

  const deleteProblem = (id: string) => {
    onUpdateProblems(problems.filter((p) => p.id !== id));
  };

  // Find recent problems across other days in allDays
  const pastProblems: { date: string; problem: DsaProblem }[] = [];
  (Object.values(allDays) as DayRecord[])
    .filter((d) => d.date !== day.date && d.dsa && d.dsa.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((d) => {
      d.dsa.forEach((p) => {
        if (pastProblems.length < 8) {
          pastProblems.push({ date: d.date, problem: p });
        }
      });
    });

  const independentCount = problems.filter((p) => p.solvedIndependently).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400 uppercase">
              WORK / DSA
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">19:30–20:40 Block</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            DSA & Algorithmic Problem Solving
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Focus: Algorithmic pattern recognition, error diagnosis, and clean reimplementation.
          </p>
        </div>

        <button
          id="btn-add-dsa-header"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : 'Log New Problem'}</span>
        </button>
      </div>

      {/* TOP SECTION: Today's DSA Session Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534]">
          <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Solved Today</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-100">{problems.length}</span>
            <span className="text-xs text-zinc-400">problem{problems.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534]">
          <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Independence Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {problems.length > 0 ? Math.round((independentCount / problems.length) * 100) : 0}%
            </span>
            <span className="text-xs text-zinc-400">
              ({independentCount}/{problems.length} solo)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534]">
          <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">Patterns Logged</span>
          <div className="text-xs font-mono text-zinc-300 truncate mt-1">
            {problems.length > 0
              ? Array.from(new Set(problems.map((p) => p.pattern))).join(', ')
              : 'None yet'}
          </div>
        </div>
      </div>

      {/* Log Form Box */}
      {showAddForm && (
        <form
          onSubmit={handleAddProblem}
          className="mb-8 p-5 sm:p-6 rounded-xl bg-[#131722] border border-[#273044] space-y-4 shadow-lg animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#21293c]">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Log Problem Details</span>
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">Preserves all 13 DSA metadata fields</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Problem Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Problem Title / Number *
              </label>
              <input
                type="text"
                required
                value={problem}
                maxLength={500}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. 200. Number of Islands"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="LeetCode">LeetCode</option>
                <option value="Codeforces">Codeforces</option>
                <option value="GeeksforGeeks">GeeksforGeeks</option>
                <option value="NeetCode">NeetCode</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Difficulty */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Pattern */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Algorithmic Pattern
              </label>
              <input
                type="text"
                value={pattern}
                maxLength={200}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. BFS / DFS / Two Pointers"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Independent Solving Toggle */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Solved Independently?
              </label>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSolvedIndependently(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    solvedIndependently
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                      : 'bg-[#0e1118] border-[#232938] text-zinc-400'
                  }`}
                >
                  Yes (Solo)
                </button>
                <button
                  type="button"
                  onClick={() => setSolvedIndependently(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !solvedIndependently
                      ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                      : 'bg-[#0e1118] border-[#232938] text-zinc-400'
                  }`}
                >
                  Needed Hint
                </button>
              </div>
            </div>
          </div>

          {/* First Idea */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Initial Hypothesis / First Idea
            </label>
            <input
              type="text"
              value={firstIdea}
              maxLength={2000}
              onChange={(e) => setFirstIdea(e.target.value)}
              placeholder="What was your initial intuition before coding?"
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Core Insight */}
            <div>
              <label className="block text-xs font-medium text-emerald-300 mb-1 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Core Insight (The 'Aha!' Moment)</span>
              </label>
              <textarea
                rows={2}
                value={insight}
                maxLength={10000}
                onChange={(e) => setInsight(e.target.value)}
                placeholder="The single key invariant, reduction, or transformation..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#1e2f24] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 resize-y"
              />
            </div>

            {/* Failure Points */}
            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Failure Point / Mistake Made</span>
              </label>
              <textarea
                rows={2}
                value={failureMistake}
                maxLength={5000}
                onChange={(e) => setFailureMistake(e.target.value)}
                placeholder="Off-by-one, missed cycle, visited check omitted, TLE..."
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#2d271e] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500 resize-y"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Algorithm */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Algorithm Used
              </label>
              <input
                type="text"
                value={algorithm}
                maxLength={5000}
                onChange={(e) => setAlgorithm(e.target.value)}
                placeholder="e.g. Iterative BFS with Queue"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Time Complexity */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Time Complexity
              </label>
              <input
                type="text"
                value={timeComplexity}
                maxLength={100}
                onChange={(e) => setTimeComplexity(e.target.value)}
                placeholder="O(V + E)"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Space Complexity */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Space Complexity
              </label>
              <input
                type="text"
                value={spaceComplexity}
                maxLength={100}
                onChange={(e) => setSpaceComplexity(e.target.value)}
                placeholder="O(min(M, N))"
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Review Date */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Spaced Review Date
              </label>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Reimplementation status */}
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reimplemented}
                  onChange={(e) => setReimplemented(e.target.checked)}
                  className="rounded border-[#232938] bg-[#0e1118] text-emerald-500 focus:ring-0 w-4 h-4"
                />
                <span>Clean reimplementation from scratch completed</span>
              </label>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Workflow Stages / Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DSA_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                      isSelected
                        ? 'bg-emerald-900/60 border border-emerald-500 text-emerald-200'
                        : 'bg-[#0e1118] border border-[#232938] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Save Problem Log
            </button>
          </div>
        </form>
      )}

      {/* PROBLEM LOG (Today's Problems) */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between pb-2 border-b border-[#1f2430]">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Problem Log ({problems.length})
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Date: {day.date}</span>
        </div>

        {problems.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#12151e] border border-dashed border-[#202534] text-zinc-500 text-xs">
            No DSA problems logged yet today. Click "Log New Problem" above to track your algorithmic session.
          </div>
        ) : (
          problems.map((p) => {
            const isExpanded = expandedProblemId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-xl bg-[#12151e] border border-[#202534] hover:border-[#272e40] transition-colors overflow-hidden"
              >
                {/* Header summary row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedProblemId(isExpanded ? null : p.id)}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                        p.difficulty === 'Easy'
                          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                          : p.difficulty === 'Medium'
                          ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                          : 'text-red-400 bg-red-950/40 border-red-800/40'
                      }`}
                    >
                      {p.difficulty}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-100 truncate">{p.problem}</span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-[#161a23] px-1.5 py-0.2 rounded border border-[#222838]">
                          {p.platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 font-mono">
                        <span className="text-zinc-300">{p.pattern}</span>
                        <span>·</span>
                        <span>{p.timeComplexity}</span>
                        <span>·</span>
                        <span className={p.solvedIndependently ? 'text-emerald-400' : 'text-amber-400'}>
                          {p.solvedIndependently ? 'Solo' : 'Hinted'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProblem(p.id);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md transition-colors"
                      title="Delete problem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-[#1a1f2b] mt-1 space-y-3 text-xs bg-[#0e1118]">
                    {p.firstIdea && (
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-0.5">
                          Initial Hypothesis:
                        </span>
                        <p className="text-zinc-300 font-mono text-[11px]">{p.firstIdea}</p>
                      </div>
                    )}

                    {p.insight && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold block mb-0.5">
                          Core Invariant / Insight:
                        </span>
                        <p className="text-emerald-200">{p.insight}</p>
                      </div>
                    )}

                    {p.failureMistake && (
                      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30">
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-semibold block mb-0.5">
                          Failure Point / Obstacle:
                        </span>
                        <p className="text-amber-200">{p.failureMistake}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-zinc-400 pt-1">
                      <div>
                        <span className="text-zinc-500 block">Algorithm:</span>
                        <span className="text-zinc-200">{p.algorithm || 'Standard'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Time:</span>
                        <span className="text-zinc-200">{p.timeComplexity}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Space:</span>
                        <span className="text-zinc-200">{p.spaceComplexity}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Review Date:</span>
                        <span className="text-zinc-200">{p.reviewDate || 'Not set'}</span>
                      </div>
                    </div>

                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181d29] text-zinc-300 border border-[#252c3c]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* RECENT PROBLEMS (Cross-Day History) */}
      {pastProblems.length > 0 && (
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1f2430]">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-zinc-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Recent Problems Logged ({pastProblems.length})</span>
            </h3>
          </div>

          <div className="space-y-2">
            {pastProblems.map(({ date, problem }) => (
              <div
                key={`${date}-${problem.id}`}
                className="p-3 rounded-xl bg-[#10131b] border border-[#1c2230] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">{date}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                        problem.difficulty === 'Easy'
                          ? 'text-emerald-400 border-emerald-800/40'
                          : problem.difficulty === 'Medium'
                          ? 'text-amber-400 border-amber-800/40'
                          : 'text-red-400 border-red-800/40'
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                    <span className="font-semibold text-zinc-200 truncate">{problem.problem}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                    <span>{problem.pattern}</span>
                    <span>·</span>
                    <span>{problem.platform}</span>
                    {problem.insight && (
                      <>
                        <span>·</span>
                        <span className="text-zinc-500 truncate max-w-xs">{problem.insight}</span>
                      </>
                    )}
                  </div>
                </div>

                {onSelectDate && (
                  <button
                    onClick={() => onSelectDate(date)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 font-mono px-2 py-1 bg-[#141824] rounded border border-[#222838] transition-colors shrink-0"
                  >
                    Open {date}
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
