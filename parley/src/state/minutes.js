/**
 * Minutes practised per local day and activity.
 */
import { get, put, getAll } from './db.js';
import { ACTIVITIES } from '../config.js';
import { localDate, lastNDates } from '../learning/dates.js';

/** Empty record for a date. */
export function emptyDay(date) {
  const r = { date, total: 0 };
  for (const a of ACTIVITIES) r[a] = 0;
  return r;
}

/**
 * Adds active minutes to an activity for a date.
 * @param {string} activity one of ACTIVITIES
 * @param {number} minutes
 * @param {string} [date]
 */
export async function addMinutes(activity, minutes, date = localDate()) {
  if (!(minutes > 0) || !ACTIVITIES.includes(activity)) return;
  const r = { ...emptyDay(date), ...((await get('minutes', date)) || {}) };
  r[activity] = Math.round((r[activity] + minutes) * 1000) / 1000;
  r.total = Math.round(ACTIVITIES.reduce((s, a) => s + r[a], 0) * 1000) / 1000;
  await put('minutes', r);
}

/**
 * Minutes for the last n days, oldest first, zeros for empty days.
 * @param {number} n 7 or 30
 */
export async function lastDays(n) {
  const dates = lastNDates(n);
  const rows = await getAll('minutes', undefined, IDBKeyRange.bound(dates[0], dates[dates.length - 1]));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return dates.map((d) => byDate.get(d) || emptyDay(d));
}
