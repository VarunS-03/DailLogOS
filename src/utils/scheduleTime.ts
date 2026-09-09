import { ScheduleItem, TabType } from '../types';

export interface CurrentBlockResult {
  block: ScheduleItem | null;
  isNow: boolean; // true if current time falls within this block
  isNext: boolean; // true if this is the upcoming block
  targetTab: TabType;
}

export interface NowAndNextBlocksResult {
  nowBlock: ScheduleItem | null;
  nextBlock: ScheduleItem | null;
  isNowActive: boolean;
  nowTab: TabType;
  nextTab: TabType;
}

/**
 * Maps a schedule item category or title to its corresponding dedicated page tab.
 */
export function getTabForScheduleItem(item: ScheduleItem): TabType {
  switch (item.category) {
    case 'academic':
      return 'academics';
    case 'dsa':
      return 'dsa';
    case 'workout':
      return 'workout';
    case 'project':
    case 'reading':
      return 'projects';
    case 'sleep':
      return 'review';
    default:
      if (item.title.toLowerCase().includes('academic') || item.title.toLowerCase().includes('class')) {
        return 'academics';
      }
      if (item.title.toLowerCase().includes('dsa') || item.title.toLowerCase().includes('leetcode')) {
        return 'dsa';
      }
      if (item.title.toLowerCase().includes('workout') || item.title.toLowerCase().includes('gym')) {
        return 'workout';
      }
      if (item.title.toLowerCase().includes('project') || item.title.toLowerCase().includes('skill')) {
        return 'projects';
      }
      if (item.title.toLowerCase().includes('review') || item.title.toLowerCase().includes('sleep')) {
        return 'review';
      }
      return 'schedule';
  }
}

/**
 * Formats a 24-hour time range like "19:30–20:40" into 12-hour like "7:30–8:40 PM".
 */
export function formatTimeRange12h(timeStr: string): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  const rangeParts = clean.split(/[–\-]/);
  if (rangeParts.length < 2) return clean;

  const to12h = (t: string) => {
    const s = t.trim().replace('~', '');
    const parts = s.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return null;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { h12, m, ampm };
  };

  const start = to12h(rangeParts[0]);
  const end = to12h(rangeParts[1]);

  if (start && end) {
    if (start.ampm === end.ampm) {
      return `${start.h12}:${start.m}–${end.h12}:${end.m} ${end.ampm}`;
    }
    return `${start.h12}:${start.m} ${start.ampm}–${end.h12}:${end.m} ${end.ampm}`;
  }
  return clean;
}

/**
 * Renders a monospace ASCII progress bar like "████████░░"
 */
export function renderAsciiBar(percentage: number, totalBlocks = 10): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filled = clamped === 0 ? 0 : Math.max(1, Math.min(totalBlocks, Math.round((clamped / 100) * totalBlocks)));
  const empty = Math.max(0, totalBlocks - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Converts a time string "HH:MM" to total minutes from midnight.
 */
function parseTimeToMinutes(timeStr: string): number | null {
  const clean = timeStr.trim().replace('~', '');
  const parts = clean.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Formats a block headline, e.g. "DSA — 7:30–8:40 PM"
 */
export function formatBlockHeadline(block: ScheduleItem | null): string {
  if (!block) return 'REST / IDLE';
  const time12h = formatTimeRange12h(block.time);
  
  let catPrefix = '';
  if (block.category === 'dsa') catPrefix = 'DSA';
  else if (block.category === 'academic') catPrefix = 'ACADEMIC';
  else if (block.category === 'workout') catPrefix = 'WORKOUT';
  else if (block.category === 'project') catPrefix = 'PROJECT';
  else if (block.category === 'reading') catPrefix = 'READING';
  else {
    catPrefix = block.title.split('/')[0].trim().toUpperCase();
  }

  return `${catPrefix} — ${time12h}`;
}

/**
 * Determines which block is NOW or NEXT based on the current local time.
 */
export function getCurrentOrNextScheduleBlock(
  schedule: ScheduleItem[],
  dateStr: string
): CurrentBlockResult {
  const { nowBlock, isNowActive, nowTab } = getNowAndNextScheduleBlocks(schedule, dateStr);
  return {
    block: nowBlock,
    isNow: isNowActive,
    isNext: !isNowActive,
    targetTab: nowTab,
  };
}

/**
 * Returns both NOW and NEXT blocks for the command briefing.
 */
export function getNowAndNextScheduleBlocks(
  schedule: ScheduleItem[],
  dateStr: string
): NowAndNextBlocksResult {
  if (!schedule || schedule.length === 0) {
    return {
      nowBlock: null,
      nextBlock: null,
      isNowActive: false,
      nowTab: 'today',
      nextTab: 'today',
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // If viewing a past or future date, select first pending block
  if (dateStr !== todayStr) {
    const firstIncompleteIdx = schedule.findIndex(
      (s) => s.status !== 'completed' && s.status !== 'skipped'
    );
    const nowIdx = firstIncompleteIdx !== -1 ? firstIncompleteIdx : 0;
    const nowBlock = schedule[nowIdx] || null;
    const nextBlock = schedule[nowIdx + 1] || null;
    return {
      nowBlock,
      nextBlock,
      isNowActive: false,
      nowTab: nowBlock ? getTabForScheduleItem(nowBlock) : 'today',
      nextTab: nextBlock ? getTabForScheduleItem(nextBlock) : 'today',
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activeIdx = -1;
  let nextUpcomingIdx = -1;
  let minDiffToNext = Infinity;

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    const rawTime = item.time || '';
    const rangeParts = rawTime.split(/[–\-]/);

    if (rangeParts.length >= 2) {
      const startMin = parseTimeToMinutes(rangeParts[0]);
      const endMin = parseTimeToMinutes(rangeParts[1]);

      if (startMin !== null && endMin !== null) {
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          activeIdx = i;
          break;
        }

        if (startMin > currentMinutes) {
          const diff = startMin - currentMinutes;
          if (diff < minDiffToNext) {
            minDiffToNext = diff;
            nextUpcomingIdx = i;
          }
        }
      }
    } else if (rangeParts.length === 1) {
      const singleMin = parseTimeToMinutes(rangeParts[0]);
      if (singleMin !== null && singleMin > currentMinutes) {
        const diff = singleMin - currentMinutes;
        if (diff < minDiffToNext) {
          minDiffToNext = diff;
          nextUpcomingIdx = i;
        }
      }
    }
  }

  if (activeIdx !== -1) {
    const nowBlock = schedule[activeIdx];
    const nextBlock = schedule[activeIdx + 1] || null;
    return {
      nowBlock,
      nextBlock,
      isNowActive: true,
      nowTab: getTabForScheduleItem(nowBlock),
      nextTab: nextBlock ? getTabForScheduleItem(nextBlock) : 'today',
    };
  }

  if (nextUpcomingIdx !== -1) {
    const nowBlock = schedule[nextUpcomingIdx];
    const nextBlock = schedule[nextUpcomingIdx + 1] || null;
    return {
      nowBlock,
      nextBlock,
      isNowActive: false,
      nowTab: getTabForScheduleItem(nowBlock),
      nextTab: nextBlock ? getTabForScheduleItem(nextBlock) : 'today',
    };
  }

  // Fallback to last block or sleep
  const lastIdx = schedule.length - 1;
  const nowBlock = schedule[lastIdx];
  return {
    nowBlock,
    nextBlock: null,
    isNowActive: false,
    nowTab: getTabForScheduleItem(nowBlock),
    nextTab: 'today',
  };
}
