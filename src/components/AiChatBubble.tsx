import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  BookOpen,
  Code2,
  Calendar,
  X,
} from 'lucide-react';
import { parseNaturalLanguageLog, NaturalInputParsed } from '../services/ai';
import { DayRecord, DsaProblem, ScheduleItem } from '../types';

interface AiChatBubbleProps {
  day: DayRecord;
  onUpdateDay: (updatedDay: DayRecord) => Promise<void>;
}

export const AiChatBubble: React.FC<AiChatBubbleProps> = ({ day, onUpdateDay }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const parsed: NaturalInputParsed = await parseNaturalLanguageLog(query);

      if (parsed.type === 'dsa') {
        const newProblem: DsaProblem = {
          id: `dsa-ai-${Date.now()}`,
          problem: parsed.data?.problem || query,
          platform: parsed.data?.platform || 'LeetCode',
          difficulty: parsed.data?.difficulty || 'Medium',
          pattern: parsed.data?.pattern || 'Algorithmic Pattern',
          firstIdea: '',
          solvedIndependently: parsed.data?.solvedIndependently ?? true,
          failureMistake: '',
          insight: 'Logged via Quick AI assistant',
          algorithm: '',
          timeComplexity: '',
          spaceComplexity: '',
          reimplemented: false,
          reviewDate: '',
          tags: ['Classify'],
        };

        const updatedDsa = [...(day.dsa || []), newProblem];
        await onUpdateDay({ ...day, dsa: updatedDsa });
        setFeedback(`Logged "${newProblem.problem}" into DSA Practice!`);
      } else if (parsed.type === 'schedule') {
        const newSched: ScheduleItem = {
          id: `sched-ai-${Date.now()}`,
          time: 'Flexible',
          title: parsed.data?.note || query,
          category: 'other',
          status: 'completed',
        };
        const updatedSched = [...(day.schedule || []), newSched];
        await onUpdateDay({ ...day, schedule: updatedSched });
        setFeedback(`Added block: "${newSched.title}" to today's schedule!`);
      } else {
        // Fallback note in reflection
        const currentNotes = day.notes ? `${day.notes}\n• ${query}` : `• ${query}`;
        await onUpdateDay({ ...day, notes: currentNotes });
        setFeedback(`Saved into today's journal!`);
      }

      setQuery('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Quick AI parse error:', err);
      setFeedback('Could not parse completely, but keep up the focus!');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Action Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-8 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer font-medium text-xs tracking-wide"
        >
          <Sparkles className="w-4 h-4 text-indigo-200 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Quick AI Log</span>
        </button>
      )}

      {/* Expanded Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 w-[92vw] max-w-md p-4 rounded-2xl bg-[#131722]/95 border border-indigo-500/30 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white">Natural Language Logger</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
            Tell me what you did in plain English — e.g. <span className="text-indigo-300 italic">"Solved LeetCode 3Sum in medium"</span> or <span className="text-indigo-300 italic">"Finished database index chapter"</span>.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What did you just accomplish?..."
              className="flex-1 px-3.5 py-2.5 bg-[#0a0c12] border border-[#232a3d] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={isProcessing || !query.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>

          {feedback && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};
