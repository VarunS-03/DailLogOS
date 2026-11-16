import React, { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle, ChevronRight, Key, Shield } from 'lucide-react';
import { AiBriefing, hasGeminiKey, setGeminiApiKey } from '../services/ai';

interface AiInsightCardProps {
  briefing: AiBriefing | null;
  loading: boolean;
  onRefresh: () => void;
  onCompletePriority?: (priority: string) => void;
}

export const AiInsightCard: React.FC<AiInsightCardProps> = ({
  briefing,
  loading,
  onRefresh,
}) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const isKeyConfigured = hasGeminiKey();

  const handleSaveKey = () => {
    setGeminiApiKey(inputKey);
    setShowKeyModal(false);
    onRefresh();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-indigo-950/40 via-[#131722] to-[#121624] border border-indigo-500/20 shadow-xl shadow-indigo-950/10">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 font-mono">
                AI Coach & Morning Briefing
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isKeyConfigured ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'}`}>
                {isKeyConfigured ? 'Gemini 2.5 Active' : 'Smart Assist'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">Psychology-backed focus for your day</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeyModal(true)}
            title="Configure Gemini API Key"
            className="p-2 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Regenerate Insights"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Headline & Focus */}
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug mb-1.5">
          {briefing?.headline || 'Ready to execute your day with clarity?'}
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {briefing?.focusMessage || 'Focus on consistent steps rather than intense bursts. Small wins compound into monumental momentum.'}
        </p>
      </div>

      {/* Top 3 High-Impact Priorities */}
      {briefing?.threePriorities && briefing.threePriorities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-indigo-500/15">
          <span className="text-xs font-semibold text-indigo-200 block mb-2.5">
            Key Anchors for Today:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {briefing.threePriorities.map((priority, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0f121b]/80 border border-[#222a3d] hover:border-indigo-500/40 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <span className="text-xs text-zinc-200 font-medium leading-relaxed">
                  {priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational Quote pill */}
      {briefing?.motivationalQuote && (
        <div className="mt-4 pt-3 flex items-center justify-between text-xs text-zinc-400 italic">
          <span>{briefing.motivationalQuote}</span>
        </div>
      )}

      {/* Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-indigo-500/30 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">Gemini API Key</h3>
            </div>
            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Add your Google Gemini API key to enable live AI briefings, algorithmic code reviews, and auto-reflections. The key is stored safely in your browser.
            </p>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 bg-[#0a0c12] border border-[#2a344d] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-4 font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
