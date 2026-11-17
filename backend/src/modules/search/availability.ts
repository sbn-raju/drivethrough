import { env } from '../../config/env.js';

/**
 * Weekly availability coverage (Feature 04 §5, Feature 06 hard filter 6).
 * Windows are in market-local time (IST, fixed UTC+05:30); the booking window is in UTC.
 */

export type WeeklyWindow = { dayOfWeek: number; startMinute: number; endMinute: number };

const MINUTE = 60_000;
const DAY = 1_440 * MINUTE;

/**
 * Returns null when the windows don't cover [start, end) completely, otherwise the "slack": how many
 * minutes of availability surround the booking inside the covering block (used only for ranking).
 */
export function coverage(windows: WeeklyWindow[], start: Date, end: Date): { slackMinutes: number } | null {
  if (!windows.length || end <= start) return null;
  const offset = env.MARKET_UTC_OFFSET_MINUTES * MINUTE;
  // "Local" timestamps: UTC epoch shifted by the market offset, so UTC date maths gives local wall time.
  const localStart = start.getTime() + offset;
  const localEnd = end.getTime() + offset;

  const firstDay = Math.floor(localStart / DAY) - 1; // include the previous day so blocks crossing midnight merge
  const lastDay = Math.floor((localEnd - 1) / DAY) + 1;
  const intervals: [number, number][] = [];
  for (let d = firstDay; d <= lastDay; d++) {
    const dayStart = d * DAY;
    const dow = new Date(dayStart).getUTCDay();
    for (const w of windows) {
      if (w.dayOfWeek === dow) intervals.push([dayStart + w.startMinute * MINUTE, dayStart + w.endMinute * MINUTE]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);

  // Merge touching/overlapping intervals (e.g. Mon 18:00–24:00 + Tue 00:00–06:00 is one block).
  const merged: [number, number][] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([...iv]);
  }

  const block = merged.find(([s, e]) => s <= localStart && e >= localEnd);
  if (!block) return null;
  return { slackMinutes: Math.round((localStart - block[0] + (block[1] - localEnd)) / MINUTE) };
}
