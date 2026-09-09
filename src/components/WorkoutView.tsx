import React, { useState } from 'react';
import {
  Dumbbell,
  Flame,
  Check,
  FastForward,
  Plus,
  MessageSquare,
  Trash2,
  RotateCw,
  ShieldCheck,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { WorkoutSession, WorkoutMode, ExerciseRecord, DayRecord } from '../types';
import { GYM_WORKOUT_PLANS, CALISTHENICS_WORKOUT_PLANS } from '../constants/templates';

interface WorkoutViewProps {
  day: DayRecord;
  onUpdateWorkout: (workout: WorkoutSession) => void;
}

export const WorkoutView: React.FC<WorkoutViewProps> = ({ day, onUpdateWorkout }) => {
  const workout = day.workout;
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
      status: 'not_started',
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
    const completedCount = updatedExercises.filter((e) => e.completed).length;
    let newStatus = workout.status;
    if (completedCount === updatedExercises.length && updatedExercises.length > 0) {
      newStatus = 'completed';
    } else if (completedCount > 0) {
      newStatus = 'partially_completed';
    }

    onUpdateWorkout({
      ...workout,
      status: newStatus,
      exercises: updatedExercises,
    });
  };

  const toggleComplete = (ex: ExerciseRecord) => {
    updateExercise(ex.id, { completed: !ex.completed, skipped: false });
  };

  const toggleSkip = (ex: ExerciseRecord) => {
    updateExercise(ex.id, { skipped: !ex.skipped, completed: false });
  };

  const addCustomMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newEx: ExerciseRecord = {
      id: `ex-custom-${Date.now()}`,
      name: customName.trim(),
      target: customTarget.trim() || '3 × 10',
      completed: false,
      skipped: false,
      sets: 3,
      reps: '',
      weight: '',
      duration: '',
      notes: '',
    };

    onUpdateWorkout({
      ...workout,
      exercises: [...workout.exercises, newEx],
    });

    setCustomName('');
    setCustomTarget('3 × 10');
    setShowAddCustom(false);
  };

  const deleteExercise = (id: string) => {
    onUpdateWorkout({
      ...workout,
      exercises: workout.exercises.filter((ex) => ex.id !== id),
    });
  };

  const completedCount = workout.exercises.filter((e) => e.completed).length;
  const totalCount = workout.exercises.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const startSession = () => {
    onUpdateWorkout({
      ...workout,
      status: 'in_progress',
    });
  };

  const finishSession = () => {
    onUpdateWorkout({
      ...workout,
      status: 'completed',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1f2430]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-orange-400 uppercase">
              FITNESS / WORKOUT
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">·</span>
            <span className="text-[11px] text-zinc-400 font-mono">17:00–18:15 Block</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Physical Training & Hypertrophy
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Focus: Progressive overload, strict tempo, and full range of motion.
          </p>
        </div>

        {/* Mode Switch: [ GYM ] [ HOME ] */}
        <div className="flex items-center p-1 bg-[#10131c] border border-[#202534] rounded-lg self-start sm:self-auto">
          <button
            id="btn-mode-gym"
            onClick={() => handleModeChange('gym')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              workout.mode === 'gym'
                ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            GYM
          </button>
          <button
            id="btn-mode-home"
            onClick={() => handleModeChange('home')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              workout.mode === 'home'
                ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            HOME CALISTHENICS
          </button>
        </div>
      </div>

      {/* Cycle Selector & Session Controls */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#12151e] border border-[#202534] mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
              Active Routine Cycle
            </span>
            <div className="flex flex-wrap gap-2">
              {(workout.mode === 'gym' ? gymCycles : calisthenicsCycles).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCycleChange(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    workout.cycleDay === c
                      ? 'bg-orange-950/50 border-orange-600/80 text-orange-300 font-semibold'
                      : 'bg-[#0e1118] border-[#232938] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {workout.status === 'not_started' ? (
              <button
                onClick={startSession}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START WORKOUT</span>
              </button>
            ) : workout.status === 'completed' ? (
              <span className="flex items-center gap-1 text-xs font-semibold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                <span>SESSION COMPLETED</span>
              </span>
            ) : (
              <button
                onClick={finishSession}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>FINISH WORKOUT</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-2 border-t border-[#1a1f2b]">
          <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
            <span className="text-zinc-400">
              Progress: <strong className="text-zinc-200">{completedCount}</strong> / {totalCount} exercises
            </span>
            <span className="text-orange-400 font-semibold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-[#0d0f15] rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* EXERCISES LIST */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between pb-2 border-b border-[#1f2430]">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200">
            Exercise Execution Logger
          </h2>
          <button
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 bg-[#161a25] px-2.5 py-1 rounded-md border border-[#222838] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Movement</span>
          </button>
        </div>

        {/* Add custom movement form */}
        {showAddCustom && (
          <form
            onSubmit={addCustomMovement}
            className="p-4 rounded-xl bg-[#131722] border border-[#273044] flex flex-col sm:flex-row gap-3 items-end"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Movement Name</label>
              <input
                type="text"
                value={customName}
                maxLength={200}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Lateral Cable Raises"
                className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Target Scheme</label>
              <input
                type="text"
                value={customTarget}
                maxLength={100}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder="3 × 12-15"
                className="w-full px-3 py-1.5 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="px-3 py-1.5 text-xs text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {workout.exercises.map((ex, idx) => (
          <div
            key={ex.id}
            className={`p-4 rounded-xl border transition-all ${
              ex.completed
                ? 'bg-[#101614] border-emerald-900/40'
                : ex.skipped
                ? 'bg-[#141215] border-zinc-800 opacity-60'
                : 'bg-[#12151e] border-[#202534]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Exercise name & target */}
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-zinc-500 mt-0.5 w-5">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    className={`text-sm font-semibold tracking-wide ${
                      ex.completed
                        ? 'text-emerald-300 line-through'
                        : ex.skipped
                        ? 'text-zinc-500 line-through'
                        : 'text-zinc-100'
                    }`}
                  >
                    {ex.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                    <span className="text-orange-400 font-medium">Target: {ex.target}</span>
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleComplete(ex)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    ex.completed
                      ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                      : 'bg-[#0e1118] border-[#232938] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{ex.completed ? 'Done' : 'Complete'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleSkip(ex)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    ex.skipped
                      ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                      : 'bg-[#0e1118] border-[#232938] text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Skip exercise"
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteExercise(ex.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md transition-colors"
                  title="Remove exercise"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline performance inputs: Weight, Reps, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-[#1a1f2c]">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">
                  Weight (kg/lbs)
                </label>
                <input
                  type="text"
                  value={ex.weight}
                  maxLength={50}
                  onChange={(e) => updateExercise(ex.id, { weight: e.target.value })}
                  placeholder="e.g. 24kg DBs"
                  className="w-full px-2.5 py-1 bg-[#0e1118] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">
                  Actual Reps / Sets
                </label>
                <input
                  type="text"
                  value={ex.reps}
                  maxLength={50}
                  onChange={(e) => updateExercise(ex.id, { reps: e.target.value })}
                  placeholder="e.g. 12, 10, 10"
                  className="w-full px-2.5 py-1 bg-[#0e1118] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">
                  Cues / Form Notes
                </label>
                <input
                  type="text"
                  value={ex.notes}
                  maxLength={1000}
                  onChange={(e) => updateExercise(ex.id, { notes: e.target.value })}
                  placeholder="e.g. paused at chest, RPE 8"
                  className="w-full px-2.5 py-1 bg-[#0e1118] border border-[#232938] rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* General workout session notes */}
      <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534]">
        <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase font-mono tracking-wide">
          Workout Debrief & Fatigue Notes
        </label>
        <textarea
          rows={2}
          value={workout.notes || ''}
          maxLength={5000}
          onChange={(e) => onUpdateWorkout({ ...workout, notes: e.target.value })}
          placeholder="Hydration, joint discomfort, energy level during compound lifts..."
          className="w-full px-3 py-2 bg-[#0e1118] border border-[#232938] rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-orange-500 resize-y"
        />
      </div>
    </div>
  );
};
