import React, { useState } from 'react';
import { CheckSquare, ShieldCheck, Plus, Check, Trash2 } from 'lucide-react';
import { HabitItem, NonNegotiableItem } from '../../types';

interface HabitsAndNonNegotiablesProps {
  nonNegotiables: NonNegotiableItem[];
  habits: HabitItem[];
  onUpdateNonNegotiables: (items: NonNegotiableItem[]) => void;
  onUpdateHabits: (items: HabitItem[]) => void;
}

export const HabitsAndNonNegotiables: React.FC<HabitsAndNonNegotiablesProps> = ({
  nonNegotiables,
  habits,
  onUpdateNonNegotiables,
  onUpdateHabits,
}) => {
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');

  const toggleNonNegotiable = (id: string) => {
    const updated = nonNegotiables.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onUpdateNonNegotiables(updated);
  };

  const toggleHabit = (id: string) => {
    const updated = habits.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onUpdateHabits(updated);
  };

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newHabit: HabitItem = {
      id: `habit-${Date.now()}`,
      title: newTitle.trim(),
      detail: newDetail.trim() || 'Daily habit',
      completed: false,
      timeOfDay: 'anytime',
    };
    onUpdateHabits([...habits, newHabit]);
    setNewTitle('');
    setNewDetail('');
    setShowAddHabit(false);
  };

  const deleteHabit = (id: string) => {
    onUpdateHabits(habits.filter((h) => h.id !== id));
  };

  return (
    <section id="section-habits-nonnegotiables" className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Daily Non-Negotiables Box */}
      <div className="p-4 rounded-xl bg-[#12151d] border border-[#202534]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-200">
              Daily Non-Negotiables
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            {nonNegotiables.filter((n) => n.completed).length} / {nonNegotiables.length}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3">
          Compulsory daily physiological reset — perform every day including rest days.
        </p>

        <div className="space-y-2">
          {nonNegotiables.map((item) => (
            <button
              key={item.id}
              id={`btn-nn-${item.id}`}
              onClick={() => toggleNonNegotiable(item.id)}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                item.completed
                  ? 'bg-[#121a15] border-emerald-900/50 text-zinc-200'
                  : 'bg-[#0f1218] border-[#1f2432] text-zinc-300 hover:border-[#2b3345]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    item.completed
                      ? 'bg-emerald-500 border-emerald-500 text-black'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div
                    className={`text-xs font-medium ${
                      item.completed ? 'line-through text-zinc-400' : 'text-zinc-200'
                    }`}
                  >
                    {item.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">{item.target}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Habits Box */}
      <div className="p-4 rounded-xl bg-[#12151d] border border-[#202534]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-200">
              Daily Habits
            </h3>
          </div>
          <button
            onClick={() => setShowAddHabit(!showAddHabit)}
            className="text-[11px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1 px-2 py-0.5 rounded bg-[#171b25] border border-[#232938]"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3">
          Consistent micro-actions maintaining mental clarity and recovery.
        </p>

        {showAddHabit && (
          <form onSubmit={addHabit} className="mb-3 p-2 bg-[#0e1117] border border-zinc-700 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="Habit title (e.g. 500ml water on wake)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-[#141822] border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
            />
            <input
              type="text"
              placeholder="Detail or motivation note"
              value={newDetail}
              onChange={(e) => setNewDetail(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-[#141822] border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddHabit(false)}
                className="px-2 py-1 text-xs text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-100 rounded border border-zinc-700 font-medium"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className={`group flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                habit.completed
                  ? 'bg-[#121a15] border-emerald-900/50 text-zinc-300'
                  : 'bg-[#0f1218] border-[#1f2432] text-zinc-300 hover:border-[#2b3345]'
              }`}
            >
              <button
                onClick={() => toggleHabit(habit.id)}
                className="flex items-center space-x-3 text-left flex-1"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    habit.completed
                      ? 'bg-emerald-500 border-emerald-500 text-black'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {habit.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div
                    className={`text-xs font-medium ${
                      habit.completed ? 'line-through text-zinc-400' : 'text-zinc-200'
                    }`}
                  >
                    {habit.title}
                  </div>
                  {habit.detail && (
                    <div className="text-[10px] text-zinc-400">{habit.detail}</div>
                  )}
                </div>
              </button>
              <button
                onClick={() => deleteHabit(habit.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                title="Delete habit"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
