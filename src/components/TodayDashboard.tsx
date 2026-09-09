import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  XCircle,
  ArrowRight,
  Plus,
  Play,
  Calendar as CalendarIcon,
  BookOpen,
  Code2,
  Dumbbell,
  Terminal,
  Moon,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Compass,
  AlertCircle,
  Flame,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { DayRecord, ScheduleItem, NonNegotiableItem, HabitItem, TabType } from '../types';
import { calculateCompletionPercentage } from '../constants/templates';
import {
  getNowAndNextScheduleBlocks,
  formatBlockHeadline,
  renderAsciiBar,
  getTabForScheduleItem,
} from '../utils/scheduleTime';

interface TodayDashboardProps {
  day: DayRecord;
  onUpdateDay: (updatedDay: DayRecord) => void;
  onDateChange: (dateStr: string) => void;
  onNavigateTab: (tab: TabType) => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  day,
  onUpdateDay,
  onDateChange,
  onNavigateTab,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showTomorrowInput, setShowTomorrowInput] = useState(false);
  const [tomorrowActionInput, setTomorrowActionInput] = useState(day.tomorrowFirstAction || '');

  // Active Session Focus Modal State
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(25 * 60);
  const [manualFocusedBlockId, setManualFocusedBlockId] = useState<string | null>(null);

  // Live digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer countdown for active focus session
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Synchronize tomorrow input if day changes
  useEffect(() => {
    setTomorrowActionInput(day.tomorrowFirstAction || '');
  }, [day.tomorrowFirstAction, day.date]);

  const handleSubUpdate = (updates: Partial<DayRecord>) => {
    const updated = {
      ...day,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    updated.completionPercentage = calculateCompletionPercentage(updated);
    onUpdateDay(updated);
  };

  // Toggle Schedule Block status directly from Timeline
  const handleToggleScheduleItem = (id: string, currentStatus: ScheduleItem['status']) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const updatedSchedule = (day.schedule || []).map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    handleSubUpdate({ schedule: updatedSchedule });
  };

  // Toggle Non-negotiables with 1-tap
  const handleToggleNonNegotiable = (id: string) => {
    const currentNN = day.workout?.dailyNonNegotiables || [];
    const updatedNN = currentNN.map((nn) =>
      nn.id === id ? { ...nn, completed: !nn.completed } : nn
    );
    handleSubUpdate({
      workout: {
        ...day.workout,
        dailyNonNegotiables: updatedNN,
      },
    });
  };

  // Toggle Habit item with 1-tap
  const handleToggleHabit = (id: string) => {
    const updatedHabits = (day.habits || []).map((h) =>
      h.id === id ? { ...h, completed: !h.completed } : h
    );
    handleSubUpdate({ habits: updatedHabits });
  };

  // Save tomorrow's first action
  const handleSaveTomorrowAction = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubUpdate({
      tomorrowFirstAction: tomorrowActionInput.trim(),
      dailyReflection: {
        ...day.dailyReflection,
        tomorrowFirstAction: tomorrowActionInput.trim(),
      },
    });
    setShowTomorrowInput(false);
  };

  // Prev / Next day navigation
  const changeDayBy = (offset: number) => {
    const [y, m, d] = day.date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offset);
    const newDateStr = date.toISOString().split('T')[0];
    onDateChange(newDateStr);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isActualToday = day.date === todayStr;

  // Format header title: e.g. "TODAY — Tuesday, Sep 3"
  const getHeroTitle = () => {
    const [y, m, d] = day.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = dateObj.getDate();
    const weekday = day.dayOfWeek || dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    return `TODAY — ${weekday}, ${month} ${dayNum}`;
  };

  // Resolve NOW and NEXT schedule blocks
  const nowAndNext = getNowAndNextScheduleBlocks(day.schedule || [], day.date);
  const nowBlock = manualFocusedBlockId
    ? (day.schedule || []).find((s) => s.id === manualFocusedBlockId) || nowAndNext.nowBlock
    : nowAndNext.nowBlock;

  const nextBlock = manualFocusedBlockId
    ? (() => {
        const idx = (day.schedule || []).findIndex((s) => s.id === manualFocusedBlockId);
        return idx !== -1 ? (day.schedule || [])[idx + 1] || null : nowAndNext.nextBlock;
      })()
    : nowAndNext.nextBlock;

  // Topic resolution helper
  const getBlockDisplayTopic = (block: ScheduleItem | null): string => {
    if (!block) return 'Free buffer / rest';
    if (block.note && block.note.trim()) {
      return block.note.trim();
    }

    const cat = block.category;
    const title = block.title.toLowerCase();

    if (cat === 'dsa' || title.includes('dsa') || title.includes('leetcode')) {
      if (day.dsa && day.dsa.length > 0 && day.dsa[0].title) {
        return day.dsa[0].title;
      }
      return 'Binary Search'; // Classic default matching prompt
    }

    if (cat === 'academic' || title.includes('academic')) {
      if (day.academics?.subject && day.academics?.objective) {
        return `${day.academics.subject} — ${day.academics.objective}`;
      }
      if (day.academics?.subject) {
        return `${day.academics.subject} — Problem Solving`;
      }
      return 'Optimization — Fundamental Region'; // Matching prompt
    }

    if (cat === 'project' || title.includes('project') || title.includes('skill')) {
      if (day.project?.name && day.project?.goal) {
        return `${day.project.name} — ${day.project.goal}`;
      }
      return 'Optimization — Fundamental Region'; // Matching prompt
    }

    if (cat === 'workout' || title.includes('workout') || title.includes('gym')) {
      return day.workout?.cycleDay || 'Day A — Shoulders + Chest';
    }

    if (cat === 'reading' || title.includes('reading')) {
      return 'Technical Papers & Architecture';
    }

    if (cat === 'sleep' || title.includes('sleep')) {
      return 'Night Calibration & Sleep';
    }

    return block.title;
  };

  // Next block headline formatter: e.g. "20:40 Academic / Project"
  const formatNextHeadline = (block: ScheduleItem | null): string => {
    if (!block) return '22:30 Rest / Sleep';
    const startTime = block.time.split(/[–\-]/)[0].trim().replace('~', '');
    let title = block.title;
    if (title.toLowerCase().includes('academic / project')) {
      title = 'Academic / Project';
    }
    return `${startTime} ${title}`;
  };

  const nowHeadline = formatBlockHeadline(nowBlock);
  const nowTopic = getBlockDisplayTopic(nowBlock);
  const nextHeadline = formatNextHeadline(nextBlock);
  const nextTopic = getBlockDisplayTopic(nextBlock);
  const nowTab = nowBlock ? getTabForScheduleItem(nowBlock) : 'today';
  const nextTab = nextBlock ? getTabForScheduleItem(nextBlock) : 'today';

  // 6 Core TODAY Pillars
  const isWorkoutDone =
    (day.workout?.exercises || []).some((e) => e.completed) ||
    Boolean(day.workout?.completedAt) ||
    (day.schedule || []).some((s) => s.category === 'workout' && s.status === 'completed');

  const isClassesDone = (day.schedule || []).some(
    (s) =>
      (s.title.toLowerCase().includes('class') || s.title.toLowerCase().includes('academic')) &&
      s.status === 'completed'
  );

  const isNonNegotiablesDone =
    (day.workout?.dailyNonNegotiables || []).length > 0 &&
    (day.workout?.dailyNonNegotiables || []).every((nn) => nn.completed);

  const isDsaDone =
    (day.dsa?.length || 0) > 0 ||
    (day.schedule || []).some((s) => s.category === 'dsa' && s.status === 'completed');

  const isAcademicDone = Boolean(
    (day.academics?.subject && (day.dailyReflection?.academicLearned || day.academics?.notes)) ||
      (day.schedule || []).some((s) => s.category === 'academic' && s.status === 'completed')
  );

  const isReviewDone = Boolean(
    day.dailyReflection?.completed ||
      day.stats?.tomorrowFirstAction ||
      day.tomorrowFirstAction ||
      day.notes
  );

  // Toggle handler for the 6 TODAY pillars
  const handleTogglePillar = (pillarId: string) => {
    const currentSchedule = day.schedule || [];

    if (pillarId === 'workout') {
      const workoutItem = currentSchedule.find((s) => s.category === 'workout');
      const newStatus = isWorkoutDone ? 'pending' : 'completed';
      const updatedSchedule = workoutItem
        ? currentSchedule.map((s) => (s.id === workoutItem.id ? { ...s, status: newStatus } : s))
        : currentSchedule;

      const currentExercises = day.workout?.exercises || [];
      const updatedExercises = currentExercises.map((e) => ({ ...e, completed: !isWorkoutDone }));

      handleSubUpdate({
        schedule: updatedSchedule,
        workout: {
          ...day.workout,
          completedAt: !isWorkoutDone ? new Date().toISOString() : undefined,
          exercises: updatedExercises,
        },
      });
    } else if (pillarId === 'classes') {
      const newStatus = isClassesDone ? 'pending' : 'completed';
      const updatedSchedule = currentSchedule.map((s) =>
        s.title.toLowerCase().includes('class') || s.title.toLowerCase().includes('academic')
          ? { ...s, status: newStatus }
          : s
      );
      handleSubUpdate({ schedule: updatedSchedule });
    } else if (pillarId === 'non-negotiables') {
      const currentNN = day.workout?.dailyNonNegotiables || [];
      const targetVal = !isNonNegotiablesDone;
      const updatedNN = currentNN.map((nn) => ({ ...nn, completed: targetVal }));
      handleSubUpdate({
        workout: {
          ...day.workout,
          dailyNonNegotiables: updatedNN,
        },
      });
    } else if (pillarId === 'dsa') {
      const dsaItem = currentSchedule.find((s) => s.category === 'dsa');
      const newStatus = isDsaDone ? 'pending' : 'completed';
      const updatedSchedule = dsaItem
        ? currentSchedule.map((s) => (s.id === dsaItem.id ? { ...s, status: newStatus } : s))
        : currentSchedule;
      handleSubUpdate({ schedule: updatedSchedule });
    } else if (pillarId === 'academics') {
      const academicItem = currentSchedule.find((s) => s.category === 'academic');
      const newStatus = isAcademicDone ? 'pending' : 'completed';
      const updatedSchedule = academicItem
        ? currentSchedule.map((s) => (s.id === academicItem.id ? { ...s, status: newStatus } : s))
        : currentSchedule;
      handleSubUpdate({ schedule: updatedSchedule });
    } else if (pillarId === 'review') {
      handleSubUpdate({
        dailyReflection: {
          ...day.dailyReflection,
          completed: !isReviewDone,
        },
      });
    }
  };

  const todayPillars = [
    {
      id: 'workout',
      label: 'Workout',
      completed: isWorkoutDone,
      onToggle: () => handleTogglePillar('workout'),
      onNavigate: () => onNavigateTab('workout'),
    },
    {
      id: 'classes',
      label: 'Classes',
      completed: isClassesDone,
      onToggle: () => handleTogglePillar('classes'),
      onNavigate: () => onNavigateTab('schedule'),
    },
    {
      id: 'non-negotiables',
      label: 'Non-negotiables',
      completed: isNonNegotiablesDone,
      onToggle: () => handleTogglePillar('non-negotiables'),
      onNavigate: () => onNavigateTab('workout'),
    },
    {
      id: 'dsa',
      label: 'DSA',
      completed: isDsaDone,
      onToggle: () => handleTogglePillar('dsa'),
      onNavigate: () => onNavigateTab('dsa'),
    },
    {
      id: 'academics',
      label: 'Academic output',
      completed: isAcademicDone,
      onToggle: () => handleTogglePillar('academics'),
      onNavigate: () => onNavigateTab('academics'),
    },
    {
      id: 'review',
      label: 'Daily review',
      completed: isReviewDone,
      onToggle: () => handleTogglePillar('review'),
      onNavigate: () => onNavigateTab('review'),
    },
  ];

  const completedPillarsCount = todayPillars.filter((p) => p.completed).length;

  // Launch Focus Session Modal
  const handleStartSession = () => {
    setShowFocusModal(true);
    setIsTimerRunning(true);
    if (sessionSecondsLeft === 0) {
      setSessionSecondsLeft(25 * 60);
    }
  };

  // Mark active focus session block as completed
  const handleCompleteSessionBlock = () => {
    if (nowBlock) {
      handleToggleScheduleItem(nowBlock.id, 'pending');
    }
    setIsTimerRunning(false);
  };

  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Workout summary stats
  const workoutExercises = day.workout?.exercises || [];
  const completedExercises = workoutExercises.filter((e) => e.completed).length;
  const workoutSummary =
    workoutExercises.length > 0
      ? `${day.workout.mode === 'gym' ? 'Gym' : 'Home'} — ${day.workout.cycleDay.split('—')[0].trim()} · ${completedExercises}/${workoutExercises.length} done`
      : 'No routine selected';

  // DSA summary stats
  const dsaCount = day.dsa?.length || 0;
  const dsaSummary =
    dsaCount > 0
      ? `${dsaCount} problem${dsaCount > 1 ? 's' : ''} solved today`
      : 'No problems logged yet';

  // Academic summary stats
  const academicSummary = day.academics?.subject
    ? `${day.academics.subject} · ${day.academics.objective || 'Session in rotation'}`
    : 'Not logged yet';

  // Project summary stats
  const projectSummary = day.project?.name
    ? `${day.project.name} · ${day.project.goal || 'Sprint active'}`
    : 'No active project sprint logged';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* 1. HERO HEADER & ASCII PROGRESS BAR */}
      <header className="pb-4 border-b border-[#1b212f] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-zinc-100 flex items-center gap-2">
              <span>{getHeroTitle()}</span>
              {!isActualToday && (
                <button
                  onClick={() => onDateChange(todayStr)}
                  className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-0.5 rounded-full hover:bg-cyan-900/60 transition-colors cursor-pointer"
                >
                  Jump to Today
                </button>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#12151e] border border-[#202534] px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-zinc-400 mr-2" />
              <span>{currentTime || '00:00:00'}</span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => changeDayBy(-1)}
                className="p-1.5 rounded-lg bg-[#12151e] hover:bg-[#1a1e2b] border border-[#202534] text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeDayBy(1)}
                className="p-1.5 rounded-lg bg-[#12151e] hover:bg-[#1a1e2b] border border-[#202534] text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ASCII Progress Bar Line */}
        <div className="flex items-center gap-3 font-mono text-base sm:text-lg tracking-widest select-none">
          <span className="text-emerald-400 font-bold">{renderAsciiBar(day.completionPercentage)}</span>
          <span className="text-zinc-200 font-bold">{day.completionPercentage}%</span>
        </div>
      </header>

      {/* 2. CORE BRIEFING TILES: NOW, NEXT, TODAY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        {/* NOW Box */}
        <div className="space-y-1.5 flex flex-col justify-between">
          <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            NOW
          </div>
          <div className="flex-1 rounded-xl bg-[#0c1017] border border-cyan-800/70 p-4 sm:p-5 shadow-lg shadow-cyan-950/25 flex flex-col justify-between relative group">
            <div>
              <div className="text-sm sm:text-base font-bold text-zinc-100 flex items-center justify-between">
                <span>{nowHeadline}</span>
                {nowBlock?.status === 'completed' && (
                  <span className="text-xs text-emerald-400 font-normal">✓ Done</span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-cyan-300/90 mt-1 font-medium">
                {nowTopic}
              </div>
            </div>

            <div className="mt-5 pt-1">
              <button
                id="btn-start-session"
                onClick={handleStartSession}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 active:bg-cyan-700 text-white font-mono text-xs sm:text-sm font-semibold tracking-wider transition-all shadow-md shadow-cyan-950/50 cursor-pointer border border-cyan-400/30 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>[ Start Session ]</span>
              </button>
            </div>
          </div>
        </div>

        {/* NEXT Box */}
        <div className="space-y-1.5 flex flex-col justify-between">
          <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            NEXT
          </div>
          <div className="flex-1 rounded-xl bg-[#0c1017] border border-[#222838] p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="text-sm sm:text-base font-bold text-zinc-100">
                {nextHeadline}
              </div>
              <div className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium">
                {nextTopic}
              </div>
            </div>

            {nextBlock && (
              <div className="mt-5 pt-1">
                <button
                  onClick={() => onNavigateTab(nextTab)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open workspace</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TODAY Checklist */}
        <div className="space-y-1.5 flex flex-col justify-between">
          <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            TODAY
          </div>
          <div className="flex-1 rounded-xl bg-[#0c1017] border border-[#222838] p-4 sm:p-5 flex flex-col justify-between space-y-2">
            <div className="space-y-2">
              {todayPillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="flex items-center justify-between text-xs sm:text-sm group select-none"
                >
                  <div
                    onClick={pillar.onToggle}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                    title="Click to toggle status"
                  >
                    <span
                      className={`font-mono font-bold text-sm w-4 shrink-0 text-center ${
                        pillar.completed ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                      }`}
                    >
                      {pillar.completed ? '✓' : '○'}
                    </span>
                    <span
                      className={`truncate ${
                        pillar.completed ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                      } group-hover:text-white transition-colors`}
                    >
                      {pillar.label}
                    </span>
                  </div>

                  <button
                    onClick={pillar.onNavigate}
                    className="text-zinc-600 hover:text-zinc-300 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Open ${pillar.label}`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#1c2230] flex items-center justify-between text-[11px] text-zinc-500">
              <span>{completedPillarsCount}/6 Complete</span>
              <span className="text-emerald-400 font-semibold">
                {Math.round((completedPillarsCount / 6) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE FOCUS SESSION MODAL */}
      {showFocusModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-[#0c1017] border border-cyan-700/70 rounded-2xl p-6 shadow-2xl shadow-cyan-950/60 space-y-5 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2738]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                  FOCUS SESSION RUNNER
                </span>
              </div>
              <button
                onClick={() => setShowFocusModal(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-100">{nowHeadline}</h3>
              <p className="text-sm text-cyan-300 font-medium">{nowTopic}</p>
            </div>

            {/* Countdown Display */}
            <div className="p-6 bg-[#080b10] border border-[#1b2233] rounded-xl text-center space-y-2">
              <div className="text-4xl sm:text-5xl font-bold tracking-wider text-zinc-100">
                {formatSeconds(sessionSecondsLeft)}
              </div>
              <div className="text-[11px] text-zinc-400">
                {isTimerRunning ? '● Focus window in progress' : '○ Timer paused'}
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-lg text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isTimerRunning ? 'PAUSE' : 'RESUME'}
              </button>
              <button
                onClick={() => setSessionSecondsLeft((s) => s + 5 * 60)}
                className="px-3 py-2 bg-[#141926] hover:bg-[#1b2233] text-zinc-300 rounded-lg text-xs font-medium border border-[#232c3f] transition-colors cursor-pointer"
              >
                +5m
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setSessionSecondsLeft(25 * 60);
                }}
                className="px-3 py-2 bg-[#141926] hover:bg-[#1b2233] text-zinc-400 rounded-lg text-xs font-medium border border-[#232c3f] transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Session Actions */}
            <div className="pt-3 border-t border-[#1b2233] flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleCompleteSessionBlock}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Mark Block Completed</span>
              </button>
              <button
                onClick={() => {
                  setShowFocusModal(false);
                  onNavigateTab(nowTab);
                }}
                className="px-4 py-2.5 bg-[#141926] hover:bg-[#1f273b] text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-800/40 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TODAY TIMELINE (Compact List of Major Schedule Blocks) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#12151e] border border-[#202534] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#1d222e]">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
              Today's Timeline
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('schedule')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>Full Schedule Editor</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          {(day.schedule || []).map((block) => {
            const isCompleted = block.status === 'completed';
            const isSkipped = block.status === 'skipped';
            const isFocused = nowBlock?.id === block.id;
            const targetTab = getTabForScheduleItem(block);

            return (
              <div
                key={block.id}
                className={`flex items-center justify-between p-2 sm:px-3 rounded-lg border transition-colors ${
                  isFocused
                    ? 'bg-[#121a29] border-cyan-700/60 shadow-sm'
                    : isCompleted
                    ? 'bg-[#101514] border-emerald-900/30'
                    : isSkipped
                    ? 'bg-[#141215] border-zinc-800 opacity-50'
                    : 'bg-[#0e1118] border-[#1d2230] hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleScheduleItem(block.id, block.status)}
                    className="shrink-0 p-0.5 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                    title={isCompleted ? 'Mark pending' : 'Mark completed'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isSkipped ? (
                      <XCircle className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
                    )}
                  </button>

                  {/* Time + Title (Clicking focuses or opens module) */}
                  <div
                    onClick={() => {
                      setManualFocusedBlockId(block.id);
                    }}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 cursor-pointer flex-1 min-w-0 group"
                    title="Click to set as active NOW block"
                  >
                    <span
                      className={`text-xs font-mono shrink-0 ${
                        isCompleted
                          ? 'text-emerald-400 font-semibold'
                          : isSkipped
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-400 group-hover:text-cyan-400'
                      }`}
                    >
                      {block.time}
                    </span>
                    <span
                      className={`text-xs font-medium truncate ${
                        isCompleted
                          ? 'text-zinc-300 line-through'
                          : isSkipped
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-200 group-hover:text-white'
                      }`}
                    >
                      {block.title}
                    </span>
                    {block.note && (
                      <span className="text-[11px] font-mono text-cyan-400/80 truncate">
                        · {block.note}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setManualFocusedBlockId(block.id);
                      handleStartSession();
                    }}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-[#161d2b] hover:bg-cyan-900/40 text-cyan-400 border border-cyan-800/30 transition-colors cursor-pointer"
                    title="Focus on this block"
                  >
                    Focus
                  </button>
                  <button
                    onClick={() => onNavigateTab(targetTab)}
                    className="text-zinc-600 hover:text-zinc-300 p-1 transition-colors shrink-0 cursor-pointer"
                    title="Open dedicated section"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. DAILY NON-NEGOTIABLES & HABITS */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#12151e] border border-[#202534] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1d222e]">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
              Daily Non-Negotiables & Small Habits
            </h2>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">1-Tap Completion</span>
        </div>

        {/* 3 Core Non-Negotiables */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(day.workout?.dailyNonNegotiables || []).map((nn) => (
            <button
              key={nn.id}
              onClick={() => handleToggleNonNegotiable(nn.id)}
              className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                nn.completed
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                  : 'bg-[#0e1118] border-[#202534] text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <div
                className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 ${
                  nn.completed
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-zinc-600 bg-[#12151e]'
                }`}
              >
                {nn.completed && <Check className="w-3 h-3" />}
              </div>
              <div className="min-w-0">
                <span className={`text-xs font-medium block leading-tight ${nn.completed ? 'line-through' : ''}`}>
                  {nn.name}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">{nn.target}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Small Habits Check-Off */}
        {day.habits && day.habits.length > 0 && (
          <div className="pt-2 border-t border-[#1a1f2b] flex flex-wrap gap-2">
            {day.habits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => handleToggleHabit(habit.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${
                  habit.completed
                    ? 'bg-[#152119] border-emerald-800/50 text-emerald-300 line-through'
                    : 'bg-[#0e1118] border-[#222838] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    habit.completed
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-zinc-700 bg-transparent'
                  }`}
                >
                  {habit.completed && <Check className="w-2.5 h-2.5" />}
                </div>
                <span>{habit.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 5. QUICK ACTIONS */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-400">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <button
            onClick={() => onNavigateTab('academics')}
            className="p-3 rounded-xl bg-[#12151e] hover:bg-[#181d2a] border border-[#202534] hover:border-indigo-600/50 text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              + Academic
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Deep work log</span>
          </button>

          <button
            onClick={() => onNavigateTab('dsa')}
            className="p-3 rounded-xl bg-[#12151e] hover:bg-[#181d2a] border border-[#202534] hover:border-emerald-600/50 text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              + DSA Problem
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Log problem</span>
          </button>

          <button
            onClick={() => onNavigateTab('workout')}
            className="p-3 rounded-xl bg-[#12151e] hover:bg-[#181d2a] border border-[#202534] hover:border-orange-600/50 text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <Dumbbell className="w-4 h-4 text-orange-400" />
              <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              + Workout
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Track session</span>
          </button>

          <button
            onClick={() => onNavigateTab('projects')}
            className="p-3 rounded-xl bg-[#12151e] hover:bg-[#181d2a] border border-[#202534] hover:border-sky-600/50 text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <Terminal className="w-4 h-4 text-sky-400" />
              <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              + Project Log
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Artifact & sprint</span>
          </button>

          <button
            onClick={() => onNavigateTab('review')}
            className="p-3 rounded-xl bg-[#12151e] hover:bg-[#181d2a] border border-[#202534] hover:border-purple-600/50 text-left transition-colors group col-span-2 sm:col-span-1 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <Moon className="w-4 h-4 text-purple-400" />
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              + Daily Review
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Night calibration</span>
          </button>
        </div>
      </section>

      {/* 6. TODAY SUMMARY (Small Cards for Academics, DSA, Workout, Project) */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-400">
          Module Summaries
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Academics Card */}
          <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-200">Academics</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-[#161a25] px-2 py-0.5 rounded border border-[#222838]">
                  {day.academics?.subject || 'Rotation'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                {academicSummary}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('academics')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 self-start transition-colors"
            >
              <span>Open Academics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* DSA Card */}
          <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200">DSA & LeetCode</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-[#161a25] px-2 py-0.5 rounded border border-[#222838]">
                  {dsaCount} logged
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                {dsaSummary}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('dsa')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 self-start transition-colors"
            >
              <span>Open DSA Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Workout Card */}
          <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-zinc-200">Workout & Fitness</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-[#161a25] px-2 py-0.5 rounded border border-[#222838]">
                  {completedExercises}/{workoutExercises.length}
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                {workoutSummary}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('workout')}
              className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 self-start transition-colors"
            >
              <span>Open Workout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Project Card */}
          <div className="p-4 rounded-xl bg-[#12151e] border border-[#202534] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-zinc-200">Project / Engineering</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-[#161a25] px-2 py-0.5 rounded border border-[#222838]">
                  Sprint
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                {projectSummary}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('projects')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 self-start transition-colors"
            >
              <span>Open Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. TOMORROW (Tomorrow's First Action) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#151221] border border-purple-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Tomorrow's First Concrete Action</span>
            </span>

            {day.tomorrowFirstAction ? (
              <p className="text-sm font-semibold text-zinc-100">
                "{day.tomorrowFirstAction}"
              </p>
            ) : (
              <p className="text-xs text-zinc-500 italic">Not set yet</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!showTomorrowInput ? (
              <button
                onClick={() => setShowTomorrowInput(true)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
              >
                {day.tomorrowFirstAction ? 'Edit Action' : 'Set tomorrow’s first action'}
              </button>
            ) : null}
            <button
              onClick={() => onNavigateTab('review')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors px-2 py-1.5"
            >
              <span>Full Daily Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline edit form */}
        {showTomorrowInput && (
          <form onSubmit={handleSaveTomorrowAction} className="mt-3 pt-3 border-t border-purple-900/40 flex gap-2">
            <input
              type="text"
              value={tomorrowActionInput}
              maxLength={1000}
              onChange={(e) => setTomorrowActionInput(e.target.value)}
              placeholder="e.g. 06:00 AM — Solve Simplex tableau problem 3"
              className="flex-1 px-3 py-1.5 bg-[#0e1018] border border-purple-800/60 rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-purple-400"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowTomorrowInput(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium"
            >
              Save
            </button>
          </form>
        )}
      </section>
    </div>
  );
};
