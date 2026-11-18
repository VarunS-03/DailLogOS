import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import type { AuthUser, DayRecord, UserSettings } from '../types';
import { clearCoachChatHistory, CoachChatMessage, loadCoachChatHistory, saveCoachChatMessages } from '../firebase';
import { sendCoachMessage } from '../services/firebaseCoachChat';
import { reportAiFailure } from '../services/aiDiagnostics';

interface CoachChatPanelProps {
  user: AuthUser | null;
  day: DayRecord;
  settings: UserSettings;
}

export const CoachChatPanel: React.FC<CoachChatPanelProps> = ({ user, day, settings }) => {
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const uid = user?.uid;
  const activeUidRef = useRef(uid);
  const lastSequenceRef = useRef(0);

  useEffect(() => {
    let active = true;
    activeUidRef.current = uid;
    setMessages([]);
    setNotice(null);
    setError(null);
    if (!uid) return () => { active = false; };
    setLoadingHistory(true);
    loadCoachChatHistory(uid)
      .then((history) => {
        if (active) {
          setMessages(history);
          lastSequenceRef.current = history.at(-1)?.createdAt ?? 0;
        }
      })
      .catch(() => { if (active) setError('Could not load your saved chat. Check your connection and retry.'); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!user || !text || sending || text.length > 4_000) return;
    setSending(true);
    setDraft('');
    setError(null);
    setNotice(null);
    const userSequence = Math.max(Date.now() * 2, lastSequenceRef.current + 1);
    const userMessage: CoachChatMessage = { id: crypto.randomUUID(), role: 'user', text, createdAt: userSequence };
    try {
      const answer = await sendCoachMessage(user, day, settings, messages, text);
      if (activeUidRef.current !== user.uid) return;
      const assistantMessage: CoachChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', text: answer, createdAt: userSequence + 1,
      };
      lastSequenceRef.current = assistantMessage.createdAt;
      const updated = [...messages, userMessage, assistantMessage].slice(-40);
      setMessages(updated);
      try {
        await saveCoachChatMessages(user.uid, [userMessage, assistantMessage]);
      } catch {
        setNotice('Reply received, but chat history could not be saved. It will remain here until you leave this page.');
      }
    } catch (caught) {
      if (activeUidRef.current !== user.uid) return;
      reportAiFailure('coach chat', caught);
      setDraft(text);
      setError('The coach could not reply. Check your connection and App Check setup, then try again.');
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!user || sending || messages.length === 0) return;
    setError(null);
    setNotice(null);
    try {
      await clearCoachChatHistory(user.uid);
      setMessages([]);
      lastSequenceRef.current = 0;
    } catch {
      setError('Could not clear your saved chat. Please try again.');
    }
  };

  if (!user) {
    return <div className="rounded-xl border border-indigo-500/20 bg-[#0a0c12] p-4 text-xs leading-relaxed text-zinc-300">
      <MessageCircle className="mb-2 h-5 w-5 text-indigo-300" />
      Sign in to start a personal coach chat. Your conversation will be saved privately to your account.
    </div>;
  }

  return (
    <section className="flex min-h-[55vh] flex-col" aria-label="Personal Daily OS coach chat">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-zinc-400">Your goals, preferences, and selected details from today personalize each reply.</p>
        <button type="button" onClick={clear} disabled={sending || loadingHistory || messages.length === 0}
          className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40" aria-label="Clear coach chat history" title="Clear chat history">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 flex-1 space-y-3 overflow-y-auto rounded-xl border border-[#232a3d] bg-[#0a0c12] p-3">
        {loadingHistory && <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Loading your conversation…</div>}
        {!loadingHistory && messages.length === 0 && <p className="py-8 text-center text-xs leading-relaxed text-zinc-500">Ask for help planning your day, following through on a goal, or reflecting on a challenge.</p>}
        {messages.map((message) => (
          <div key={message.id} className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 text-xs leading-relaxed ${message.role === 'user' ? 'ml-auto bg-indigo-600/25 text-indigo-50' : 'mr-auto border border-[#273149] bg-[#151a27] text-zinc-200'}`}>
            {message.text}
          </div>
        ))}
        {sending && <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Your coach is thinking…</div>}
        <div ref={bottomRef} />
      </div>
      {error && <p role="alert" className="mb-2 text-[11px] text-rose-300">{error}</p>}
      {notice && <p role="status" className="mb-2 text-[11px] text-amber-200">{notice}</p>}
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4_000} rows={2} disabled={sending || loadingHistory}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
          placeholder="Ask your coach…" aria-label="Message your coach" className="min-w-0 flex-1 resize-y rounded-xl border border-[#232a3d] bg-[#0a0c12] px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60" />
        <button type="submit" disabled={sending || loadingHistory || !draft.trim() || draft.length > 4_000}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50" aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Your message, recent chat turns, and selected Daily OS context are sent to Google for a response. Signed-in chat history is stored in your account and can be cleared here.</p>
    </section>
  );
};
