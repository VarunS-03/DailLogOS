import React, { useState } from 'react';
import { Code2, Plus, Check, ChevronDown, ChevronUp, Trash2, Tag } from 'lucide-react';
import { DsaProblem } from '../../types';
import { DSA_TAGS } from '../../constants/templates';

interface DsaSectionProps {
  problems: DsaProblem[];
  onUpdateProblems: (problems: DsaProblem[]) => void;
}

export const DsaSection: React.FC<DsaSectionProps> = ({
  problems,
  onUpdateProblems,
}) => {
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
      reviewDate: reviewDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
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
    setShowAddForm(false);
  };

  const deleteProblem = (id: string) => {
    onUpdateProblems(problems.filter((p) => p.id !== id));
  };

  return (
    <section id="section-dsa" className="mb-8 p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1d222e]">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            DSA / LeetCode Session
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">
            ({problems.length} solved today)
          </span>
        </div>

        <button
          id="btn-add-dsa-problem"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1 text-xs text-zinc-300 hover:text-zinc-100 bg-[#171b26] hover:bg-[#1e2332] px-2.5 py-1 rounded-md border border-[#252c3d] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Problem</span>
        </button>
      </div>

      {/* Add Problem Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddProblem}
          className="mb-5 p-4 rounded-lg bg-[#0e1118] border border-[#232a3b] space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              New Problem Log
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Problem Name / Number *
              </label>
              <input
                type="text"
                required
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. 15. 3Sum"
                className="w-full px-3 py-1.5 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden"
              >
                <option value="LeetCode">LeetCode</option>
                <option value="NeetCode">NeetCode</option>
                <option value="Codeforces">Codeforces</option>
                <option value="GeeksforGeeks">GeeksforGeeks</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Pattern
              </label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. Two Pointers, Sliding Window, Monotonic Stack"
                className="w-full px-3 py-1.5 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Solved Independently?
              </label>
              <div className="flex items-center space-x-4 pt-1.5">
                <label className="flex items-center space-x-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="solvedIndependently"
                    checked={solvedIndependently}
                    onChange={() => setSolvedIndependently(true)}
                    className="accent-zinc-400"
                  />
                  <span>Yes (No hints)</span>
                </label>
                <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="radio"
                    name="solvedIndependently"
                    checked={!solvedIndependently}
                    onChange={() => setSolvedIndependently(false)}
                    className="accent-zinc-400"
                  />
                  <span>With Hint/Solution</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                First Idea (Initial Mental Hypothesis)
              </label>
              <textarea
                rows={2}
                value={firstIdea}
                onChange={(e) => setFirstIdea(e.target.value)}
                placeholder="What popped into my head first (even if brute force)..."
                className="w-full p-2 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Failure / Mistake (Why I Got Stuck / Edge Case)
              </label>
              <textarea
                rows={2}
                value={failureMistake}
                onChange={(e) => setFailureMistake(e.target.value)}
                placeholder="Off-by-one, missed duplicates, TLE on worst-case..."
                className="w-full p-2 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Core Insight (The "Aha!" Observation)
              </label>
              <textarea
                rows={2}
                value={insight}
                onChange={(e) => setInsight(e.target.value)}
                placeholder="Sorting first allows binary search / two-pointer skip of duplicates..."
                className="w-full p-2 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Algorithm & Steps
              </label>
              <textarea
                rows={2}
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                placeholder="1. Sort array; 2. Iterate i from 0..n-2; 3. Left/right pointers..."
                className="w-full p-2 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Time Complexity
              </label>
              <input
                type="text"
                value={timeComplexity}
                onChange={(e) => setTimeComplexity(e.target.value)}
                className="w-full px-2.5 py-1 bg-[#131620] border border-[#232938] rounded-md text-xs font-mono text-zinc-100 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Space Complexity
              </label>
              <input
                type="text"
                value={spaceComplexity}
                onChange={(e) => setSpaceComplexity(e.target.value)}
                className="w-full px-2.5 py-1 bg-[#131620] border border-[#232938] rounded-md text-xs font-mono text-zinc-100 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Reimplemented?
              </label>
              <button
                type="button"
                onClick={() => setReimplemented(!reimplemented)}
                className={`w-full py-1 px-2 rounded-md text-xs font-medium border flex items-center justify-center space-x-1 ${
                  reimplemented
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-[#131620] text-zinc-400 border-[#232938]'
                }`}
              >
                {reimplemented && <Check className="w-3 h-3" />}
                <span>{reimplemented ? 'Reimplemented' : 'Not yet'}</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Next Review Date
              </label>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="w-full px-2 py-1 bg-[#131620] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Quick Tags Selection */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>Phase & Attribute Tags</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DSA_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      isSelected
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-500 font-semibold'
                        : 'bg-[#12151d] text-zinc-400 border-[#232938] hover:text-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#1d222e]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold rounded-md border border-zinc-600 shadow-xs"
            >
              Save Problem Log
            </button>
          </div>
        </form>
      )}

      {/* Problems List */}
      {problems.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-[#1f2533] rounded-lg text-zinc-500 text-xs">
          No problems logged for this session yet. Click "Log Problem" to record LeetCode work.
        </div>
      ) : (
        <div className="space-y-2.5">
          {problems.map((p) => {
            const isExpanded = expandedProblemId === p.id;
            const diffColor =
              p.difficulty === 'Easy'
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                : p.difficulty === 'Medium'
                ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                : 'text-rose-400 bg-rose-950/40 border-rose-800/40';

            return (
              <div
                key={p.id}
                className="p-3 rounded-lg bg-[#0e1118] border border-[#1e2330] hover:border-[#273042] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border font-semibold ${diffColor}`}>
                      {p.difficulty}
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {p.problem}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      · {p.platform}
                    </span>
                    {p.pattern && (
                      <span className="text-[10px] text-zinc-400 bg-[#161a24] px-2 py-0.5 rounded border border-[#222838] hidden sm:inline-block">
                        {p.pattern}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setExpandedProblemId(isExpanded ? null : p.id)}
                      className="p-1 text-zinc-400 hover:text-zinc-200 rounded"
                      title={isExpanded ? 'Collapse' : 'Expand Details'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteProblem(p.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded"
                      title="Delete Problem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tags preview */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.tags?.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-1.5 py-0.2 bg-[#161a23] text-zinc-400 border border-[#222838] rounded"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="text-[9px] font-mono px-1.5 py-0.2 text-zinc-400">
                    Time: {p.timeComplexity} | Space: {p.spaceComplexity}
                  </span>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#1d222e] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {p.firstIdea && (
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          First Idea:
                        </span>
                        <p className="text-zinc-300 mt-0.5">{p.firstIdea}</p>
                      </div>
                    )}
                    {p.insight && (
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          Core Insight:
                        </span>
                        <p className="text-zinc-200 font-medium mt-0.5">{p.insight}</p>
                      </div>
                    )}
                    {p.failureMistake && (
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          Failure / Struggle:
                        </span>
                        <p className="text-zinc-400 mt-0.5">{p.failureMistake}</p>
                      </div>
                    )}
                    {p.algorithm && (
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          Algorithm:
                        </span>
                        <p className="text-zinc-300 mt-0.5">{p.algorithm}</p>
                      </div>
                    )}
                    {p.reviewDate && (
                      <div className="md:col-span-2 text-[11px] text-zinc-400 font-mono">
                        Scheduled Review: {p.reviewDate}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
