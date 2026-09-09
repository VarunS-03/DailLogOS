import React, { useState } from 'react';
import { Dumbbell, Flame, Check, FastForward, Plus, MessageSquare, Trash2, RotateCw } from 'lucide-react';
import { WorkoutSession, WorkoutMode, ExerciseRecord } from '../../types';
import { GYM_WORKOUT_PLANS, CALISTHENICS_WORKOUT_PLANS } from '../../constants/templates';

interface WorkoutSectionProps {
  workout: WorkoutSession;
  onUpdateWorkout: (workout: WorkoutSession) => void;
}

export const WorkoutSection: React.FC<WorkoutSectionProps> = ({
  workout,
  onUpdateWorkout,
}) => {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTarget, setCustomTarget] = useState('3 × 10');

  const gymCycles = Object.keys(GYM_WORKOUT_PLANS);
  const calisthenicsCycles = Object.keys(CALISTHENICS_WORKOUT_PLANS);

  // Switch Mode (Gym vs Home)
  const handleModeChange = (mode: WorkoutMode) => {
    const cycleDay =
      mode === 'gym'
        ? 'Day A — Shoulders + Chest'
        : 'Day 1 — Push Foundations + Upper Core';
    const plan =
      mode === 'gym'
        ? GYM_WORKOUT_PLANS['Day A — Shoulders + Chest']
        : CALISTHENICS_WORKOUT_PLANS['Day 1 — Push Foundations + Upper Core'];

    const exercises: ExerciseRecord[] = plan.map((p, idx) => ({
      id: `ex-${mode}-${idx}-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: p.name,
      target: p.target,
      completed: false,
      skipped: false,
      sets: 3,
      reps: '',
      weight: '',
      duration: '',
      notes: '',
    }));

    onUpdateWorkout({
      ...workout,
      mode,
      cycleDay,
      exercises,
    });
  };

  // Switch Cycle (Day A, B, C or Day 1, 2, 3)
  const handleCycleChange = (cycleDay: string) => {
    const plan =
      workout.mode === 'gym'
        ? (GYM_WORKOUT_PLANS as any)[cycleDay] || []
        : (CALISTHENICS_WORKOUT_PLANS as any)[cycleDay] || [];

    const exercises: ExerciseRecord[] = plan.map((p: any, idx: number) => ({
      id: `ex-${workout.mode}-${idx}-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: p.name,
      target: p.target,
      completed: false,
      skipped: false,
      sets: 3,
      reps: '',
      weight: '',
      duration: '',
      notes: '',
    }));

    onUpdateWorkout({
      ...workout,
      cycleDay,
      exercises,
    });
  };

  const updateExercise = (id: string, updates: Partial<ExerciseRecord>) => {
    const updatedExercises = workout.exercises.map((ex) =>
      ex.id === id ? { ...ex, ...updates } : ex
    );
    onUpdateWorkout({
      ...workout,
      exercises: updatedExercises,
    });
  };

  const toggleComplete = (id: string) => {
    const ex = workout.exercises.find((e) => e.id === id);
    if (!ex) return;
    updateExercise(id, {
      completed: !ex.completed,
      skipped: false,
    });
  };

  const toggleSkip = (id: string) => {
    const ex = workout.exercises.find((e) => e.id === id);
    if (!ex) return;
    updateExercise(id, {
      skipped: !ex.skipped,
      completed: false,
    });
  };

  const addCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const newEx: ExerciseRecord = {
      id: `custom-ex-${Date.now()}`,
      name: customName.trim(),
      target: customTarget.trim() || '3 × 10',
      completed: false,
      skipped: false,
      sets: 3,
      reps: '',
      weight: '',
      notes: '',
    };
    onUpdateWorkout({
      ...workout,
      exercises: [...workout.exercises, newEx],
    });
    setCustomName('');
    setShowAddCustom(false);
  };

  const deleteExercise = (id: string) => {
    onUpdateWorkout({
      ...workout,
      exercises: workout.exercises.filter((e) => e.id !== id),
    });
  };

  const completedCount = workout.exercises.filter((e) => e.completed).length;
  const totalCount = workout.exercises.length;

  return (
    <section id="section-workout" className="mb-8 p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534]">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1d222e]">
        <div className="flex items-center space-x-2">
          <Dumbbell className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Workout Session
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">(17:00–18:15 Block)</span>
        </div>

        {/* Mode Toggle Pills (GYM vs HOME CALISTHENICS) */}
        <div className="flex items-center bg-[#0d1017] p-1 rounded-lg border border-[#232938]">
          <button
            id="btn-workout-mode-gym"
            onClick={() => handleModeChange('gym')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              workout.mode === 'gym'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Gym Plan
          </button>
          <button
            id="btn-workout-mode-home"
            onClick={() => handleModeChange('home')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              workout.mode === 'home'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Home Calisthenics
          </button>
        </div>
      </div>

      {/* Cycle Selector and Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Current Cycle:</span>
          <select
            value={workout.cycleDay}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="px-2.5 py-1 bg-[#0d1017] border border-[#232938] rounded-md text-xs font-semibold text-zinc-200 focus:outline-hidden"
          >
            {(workout.mode === 'gym' ? gymCycles : calisthenicsCycles).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-mono">
            {completedCount} / {totalCount} completed
          </span>
          <button
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 bg-[#161a23] hover:bg-[#1e2332] px-2.5 py-1 rounded-md border border-[#232938]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Movement</span>
          </button>
        </div>
      </div>

      {/* Custom exercise form */}
      {showAddCustom && (
        <form
          onSubmit={addCustomExercise}
          className="mb-4 p-3 bg-[#0d1017] border border-zinc-700 rounded-lg flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            placeholder="Exercise Name (e.g. Cable Lateral Raise)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-[#141822] border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
          <input
            type="text"
            placeholder="Target (e.g. 3 × 12)"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            className="w-32 px-3 py-1.5 bg-[#141822] border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 bg-zinc-800 text-zinc-100 rounded text-xs font-medium border border-zinc-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="px-2 text-xs text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Exercise Performance Table */}
      <div className="space-y-2">
        {workout.exercises.map((ex) => {
          const isDone = ex.completed;
          const isSkipped = ex.skipped;

          return (
            <div
              key={ex.id}
              className={`p-3 rounded-lg border transition-all ${
                isDone
                  ? 'bg-[#121914] border-emerald-950/60 text-zinc-300'
                  : isSkipped
                  ? 'bg-[#131419] border-[#1e222c] text-zinc-500 opacity-70'
                  : 'bg-[#0e1118] border-[#1f2432] text-zinc-200 hover:border-[#2a3244]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Name & Target */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleComplete(ex.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-black'
                        : 'border-zinc-600 bg-transparent hover:border-zinc-400'
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isDone ? 'line-through text-zinc-400' : isSkipped ? 'line-through text-zinc-500' : 'text-zinc-100'
                        }`}
                      >
                        {ex.name}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        ({ex.target})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actual Performance Inputs (Sets, Weight, Reps, Notes) */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                  {/* Sets */}
                  <div className="flex items-center bg-[#131620] border border-[#232938] rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-zinc-400 font-mono mr-1">Sets</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={ex.sets || 3}
                      onChange={(e) => updateExercise(ex.id, { sets: Number(e.target.value) })}
                      className="w-9 bg-transparent text-xs font-mono text-zinc-200 text-center focus:outline-hidden"
                    />
                  </div>

                  {/* Weight (for Gym or weighted calisthenics) */}
                  <div className="flex items-center bg-[#131620] border border-[#232938] rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-zinc-400 font-mono mr-1">Weight</span>
                    <input
                      type="text"
                      placeholder="e.g. 22.5kg"
                      value={ex.weight || ''}
                      onChange={(e) => updateExercise(ex.id, { weight: e.target.value })}
                      className="w-16 bg-transparent text-xs font-mono text-zinc-200 focus:outline-hidden placeholder-zinc-600"
                    />
                  </div>

                  {/* Reps */}
                  <div className="flex items-center bg-[#131620] border border-[#232938] rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-zinc-400 font-mono mr-1">Reps</span>
                    <input
                      type="text"
                      placeholder="10, 10, 8"
                      value={ex.reps || ''}
                      onChange={(e) => updateExercise(ex.id, { reps: e.target.value })}
                      className="w-16 bg-transparent text-xs font-mono text-zinc-200 focus:outline-hidden placeholder-zinc-600"
                    />
                  </div>

                  {/* Skip Toggle */}
                  <button
                    onClick={() => toggleSkip(ex.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                      isSkipped
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                        : 'text-zinc-400 border-[#232938] hover:text-zinc-200'
                    }`}
                  >
                    {isSkipped ? 'Skipped' : 'Skip'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteExercise(ex.id)}
                    className="p-1 text-zinc-600 hover:text-red-400 rounded"
                    title="Remove Exercise"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Optional Exercise Note */}
              <div className="mt-2 pt-2 border-t border-[#1a1e2a]/50 flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Notes on form, RPE, or tempo (e.g. felt strong on set 2, 2 RIR)..."
                  value={ex.notes || ''}
                  onChange={(e) => updateExercise(ex.id, { notes: e.target.value })}
                  className="w-full bg-transparent text-[11px] text-zinc-300 placeholder-zinc-500 focus:outline-hidden"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
