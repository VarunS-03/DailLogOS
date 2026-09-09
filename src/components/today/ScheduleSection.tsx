import React, { useState } from 'react';
import { Check, FastForward, Clock, MessageSquare, Plus, Edit2, Trash2 } from 'lucide-react';
import { ScheduleItem } from '../../types';

interface ScheduleSectionProps {
  schedule: ScheduleItem[];
  onUpdateSchedule: (newSchedule: ScheduleItem[]) => void;
}

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  schedule,
  onUpdateSchedule,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('');
  const [activeNote, setActiveNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');

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
    const updated = schedule.filter((item) => item.id !== id);
    onUpdateSchedule(updated);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem: ScheduleItem = {
      id: `custom-${Date.now()}`,
      time: newTime.trim() || 'Flexible',
      title: newTitle.trim(),
      category: 'other',
      status: 'pending',
      note: '',
    };
    onUpdateSchedule([...schedule, newItem]);
    setNewTime('');
    setNewTitle('');
    setShowAddForm(false);
  };

  return (
    <section id="section-schedule" className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Daily Timeline
          </h2>
          <span className="text-xs text-zinc-400 font-mono">({schedule.length} blocks)</span>
        </div>

        <button
          id="btn-add-schedule-slot"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-[#181c26] px-2.5 py-1 rounded-md border border-[#222736] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Block</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="mb-4 p-3 bg-[#131620] border border-[#23293a] rounded-lg flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            placeholder="Time (e.g. 14:00–15:00)"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="px-3 py-1.5 bg-[#0d1017] border border-[#222838] rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500 sm:w-40"
          />
          <input
            type="text"
            placeholder="Activity description"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="px-3 py-1.5 bg-[#0d1017] border border-[#222838] rounded text-xs text-zinc-100 placeholder-zinc-500 flex-1 focus:outline-hidden focus:border-zinc-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="submit"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded text-xs font-medium border border-zinc-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Timeline items container */}
      <div className="space-y-1.5">
        {schedule.map((item) => {
          const isCompleted = item.status === 'completed';
          const isSkipped = item.status === 'skipped';

          return (
            <div
              key={item.id}
              className={`group flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border transition-all ${
                isCompleted
                  ? 'bg-[#121814] border-emerald-950/60 text-zinc-300'
                  : isSkipped
                  ? 'bg-[#14151a] border-[#20232c] text-zinc-500 opacity-75'
                  : 'bg-[#12151c] border-[#1d222e] text-zinc-200 hover:border-[#283042]'
              }`}
            >
              {/* Left: Time and Title */}
              <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                <span className="font-mono text-[11px] text-zinc-400 w-24 shrink-0 pt-0.5 sm:pt-0">
                  {item.time}
                </span>

                {editingItemId === item.id ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <input
                      type="text"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-24 px-2 py-0.5 bg-[#0e1118] border border-zinc-700 rounded text-xs font-mono text-zinc-100"
                    />
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 px-2 py-0.5 bg-[#0e1118] border border-zinc-700 rounded text-xs text-zinc-100"
                    />
                    <button
                      onClick={() => saveEdit(item.id)}
                      className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-xs rounded text-zinc-100"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-medium tracking-tight block truncate ${
                        isCompleted ? 'line-through text-zinc-400' : isSkipped ? 'line-through text-zinc-500' : ''
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.note && (
                      <p className="text-[11px] text-zinc-400 mt-0.5 italic flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 shrink-0" />
                        <span>{item.note}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center space-x-1.5 self-end sm:self-center mt-2 sm:mt-0 shrink-0">
                {/* Note toggle */}
                <button
                  id={`btn-note-${item.id}`}
                  onClick={() => openNote(item)}
                  title="Add / Edit Note"
                  className={`p-1.5 rounded text-xs transition-colors ${
                    item.note
                      ? 'text-zinc-300 bg-[#1c2230]'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#181c26]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>

                {/* Edit inline */}
                <button
                  id={`btn-edit-${item.id}`}
                  onClick={() => startEdit(item)}
                  title="Edit Block"
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-[#181c26] rounded text-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Skip toggle button */}
                <button
                  id={`btn-skip-${item.id}`}
                  onClick={() => toggleStatus(item.id, 'skipped')}
                  title={isSkipped ? 'Unskip' : 'Skip'}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    isSkipped
                      ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                      : 'text-zinc-400 border-[#232938] hover:bg-[#181c26] hover:text-zinc-200'
                  }`}
                >
                  <FastForward className="w-3 h-3" />
                  <span>{isSkipped ? 'Skipped' : 'Skip'}</span>
                </button>

                {/* Complete checkbox button */}
                <button
                  id={`btn-complete-${item.id}`}
                  onClick={() => toggleStatus(item.id, 'completed')}
                  title={isCompleted ? 'Mark Pending' : 'Complete'}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    isCompleted
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                      : 'text-zinc-300 bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>{isCompleted ? 'Done' : 'Complete'}</span>
                </button>

                {/* Delete button (on hover or custom) */}
                <button
                  id={`btn-delete-${item.id}`}
                  onClick={() => deleteItem(item.id)}
                  title="Delete Block"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note Edit Modal / Popup */}
      {noteItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-[#252c3d] rounded-xl p-4 max-w-sm w-full shadow-2xl">
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Schedule Note</span>
            </h3>
            <textarea
              rows={3}
              value={activeNote}
              onChange={(e) => setActiveNote(e.target.value)}
              placeholder="Add details, notes, or execution observations..."
              className="w-full p-2.5 bg-[#0d1017] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-500 resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setNoteItemId(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => saveNote(noteItemId)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded-lg border border-zinc-700"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
