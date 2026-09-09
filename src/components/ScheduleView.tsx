import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  FastForward,
  Clock,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ScheduleItem, DayRecord } from '../types';
import { DEFAULT_SCHEDULE_ITEMS } from '../constants/templates';

interface ScheduleViewProps {
  day: DayRecord;
  onUpdateSchedule: (newSchedule: ScheduleItem[]) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ day, onUpdateSchedule }) => {
  const schedule = day.schedule || [];
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('');
  const [activeNote, setActiveNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ScheduleItem['category']>('other');

  const toggleStatus = (id: string, newStatus: 'pending' | 'completed' | 'skipped') => {
    const updated = schedule.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          status: item.status === newStatus ? 'pending' : newStatus,
        };
      }
      return item;
    });
    onUpdateSchedule(updated);
  };

  const startEdit = (item: ScheduleItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditTime(item.time);
  };

  const saveEdit = (id: string) => {
    const updated = schedule.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          title: editTitle.trim() || item.title,
          time: editTime.trim() || item.time,
        };
      }
      return item;
    });
    onUpdateSchedule(updated);
    setEditingItemId(null);
  };

  const openNote = (item: ScheduleItem) => {
    setNoteItemId(item.id);
    setActiveNote(item.note || '');
  };

  const saveNote = (id: string) => {
    const updated = schedule.map((item) => {
      if (item.id === id) {
        return { ...item, note: activeNote };
      }
      return item;
    });
    onUpdateSchedule(updated);
    setNoteItemId(null);
  };

  const deleteItem = (id: string) => {
    onUpdateSchedule(schedule.filter((item) => item.id !== id));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ScheduleItem = {
      id: `sched-${Date.now()}`,
      time: newTime.trim() || 'Flexible',
      title: newTitle.trim(),
      category: newCategory,
      status: 'pending',
    };

    onUpdateSchedule([...schedule, newItem]);
    setNewTitle('');
    setNewTime('');
    setShowAddForm(false);
  };

  const resetToDefaultSchedule = () => {
    if (
      window.confirm(
        'Reset daily schedule back to the default master template (05:30 to 22:30)? Existing notes on blocks will be cleared.'
      )
    ) {
      const resetSchedule: ScheduleItem[] = DEFAULT_SCHEDULE_ITEMS.map((item, idx) => ({
        id: `sched-${idx}-${item.category}`,
        time: item.time,
        title: item.title,
        category: item.category as any,
        status: 'pending',
      }));
      onUpdateSchedule(resetSchedule);
    }
  };

  const completedCount = schedule.filter((s) => s.status === 'completed').length;
  const skippedCount = schedule.filter((s) => s.status === 'skipped').length;
  const pendingCount = schedule.filter((s) => s.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
              PLANNER / SCHEDULE
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">{day.dayOfWeek}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Daily Execution Schedule
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Full time-block architecture. Manage blocks, add custom slots, or reset recurring templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Block</span>
          </button>
          <button
            onClick={resetToDefaultSchedule}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1a2030] text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-[#232a3e] transition-colors"
            title="Reset to standard default schedule"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6 font-mono text-xs">
        <div className="p-3 rounded-xl bg-[#12151e] border border-[#202534] flex items-center justify-between">
          <span className="text-zinc-400 uppercase text-[10px]">Completed</span>
          <span className="text-emerald-400 font-bold text-base">{completedCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-[#12151e] border border-[#202534] flex items-center justify-between">
          <span className="text-zinc-400 uppercase text-[10px]">Pending</span>
          <span className="text-zinc-300 font-bold text-base">{pendingCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-[#12151e] border border-[#202534] flex items-center justify-between">
          <span className="text-zinc-400 uppercase text-[10px]">Skipped</span>
          <span className="text-zinc-500 font-bold text-base">{skippedCount}</span>
        </div>
      </div>

      {/* Add Block Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="p-4 sm:p-5 rounded-xl bg-[#131722] border border-[#273044] mb-6 space-y-3 animate-in fade-in"
        >
          <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-cyan-300">
            Create Custom Schedule Slot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Time Interval
              </label>
              <input
                type="text"
                value={newTime}
                maxLength={50}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="e.g. 14:00–15:00"
                className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Block Title / Activity
              </label>
              <input
                type="text"
                value={newTitle}
                maxLength={200}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Code Review / Math Problem Sheet"
                className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="academic">Academic</option>
                <option value="dsa">DSA</option>
                <option value="workout">Workout</option>
                <option value="project">Project / Skill</option>
                <option value="reading">Reading</option>
                <option value="break">Break / Food</option>
                <option value="wake">Wake / Hygiene</option>
                <option value="sleep">Sleep</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium"
            >
              Add Block
            </button>
          </div>
        </form>
      )}

      {/* Schedule Items List */}
      <div className="space-y-2">
        {schedule.map((item) => {
          const isCompleted = item.status === 'completed';
          const isSkipped = item.status === 'skipped';
          const isEditing = editingItemId === item.id;
          const isWritingNote = noteItemId === item.id;

          return (
            <div
              key={item.id}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                isCompleted
                  ? 'bg-[#101514] border-emerald-900/40 text-zinc-300'
                  : isSkipped
                  ? 'bg-[#141215] border-zinc-800 text-zinc-500 opacity-60'
                  : 'bg-[#12151e] border-[#202534] text-zinc-100 hover:border-[#272e40]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Checkbox status & Time/Title */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleStatus(item.id, 'completed')}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-[#293144] hover:border-zinc-500 bg-[#0e1118]'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-col sm:flex-row gap-2 py-1">
                        <input
                          type="text"
                          value={editTime}
                          maxLength={50}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="px-2 py-1 bg-[#0e1118] border border-cyan-500 rounded text-xs font-mono text-zinc-100 w-28"
                        />
                        <input
                          type="text"
                          value={editTitle}
                          maxLength={200}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 px-2 py-1 bg-[#0e1118] border border-cyan-500 rounded text-xs text-zinc-100"
                        />
                        <button
                          onClick={() => saveEdit(item.id)}
                          className="px-3 py-1 bg-cyan-600 text-white text-xs rounded"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span
                          className={`text-xs font-mono shrink-0 ${
                            isCompleted
                              ? 'text-emerald-400 font-semibold'
                              : isSkipped
                              ? 'text-zinc-500 line-through'
                              : 'text-cyan-400 font-medium'
                          }`}
                        >
                          {item.time}
                        </span>
                        <span
                          className={`text-xs font-medium truncate ${
                            isCompleted
                              ? 'text-zinc-300 line-through'
                              : isSkipped
                              ? 'text-zinc-500 line-through'
                              : 'text-zinc-100'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick actions: skip, note, edit, delete */}
                {!isEditing && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => toggleStatus(item.id, 'skipped')}
                      className={`p-1.5 rounded-md transition-colors ${
                        isSkipped
                          ? 'bg-zinc-700 text-zinc-200'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#181d29]'
                      }`}
                      title={isSkipped ? 'Mark pending' : 'Skip block'}
                    >
                      <FastForward className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => (isWritingNote ? setNoteItemId(null) : openNote(item))}
                      className={`p-1.5 rounded-md transition-colors ${
                        item.note
                          ? 'text-amber-400 bg-amber-950/30'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#181d29]'
                      }`}
                      title="Add note"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-[#181d29] rounded-md transition-colors"
                      title="Edit block"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-[#181d29] rounded-md transition-colors"
                      title="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Note input/display */}
              {isWritingNote && (
                <div className="mt-2.5 pt-2.5 border-t border-[#1a1f2b] flex gap-2">
                  <input
                    type="text"
                    value={activeNote}
                    maxLength={500}
                    onChange={(e) => setActiveNote(e.target.value)}
                    placeholder="Log a note or reflection for this block..."
                    className="flex-1 px-2.5 py-1 bg-[#0e1118] border border-[#232938] rounded text-xs text-zinc-100 focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    onClick={() => saveNote(item.id)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium"
                  >
                    Save Note
                  </button>
                </div>
              )}

              {item.note && !isWritingNote && (
                <div className="mt-1.5 pt-1.5 border-t border-[#1a1f2b] text-[11px] text-amber-300/80 font-mono italic">
                  Note: {item.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
