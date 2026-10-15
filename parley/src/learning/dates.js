/**
 * Local date helpers. Dates are "YYYY-MM-DD" in the tablet's local time zone.
 */

/**
 * Local date string for a Date.
 * @param {Date} [d]
 * @returns {string}
 */
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The last n local dates ending with `today`, oldest first.
 * @param {number} n
 * @param {string} [today] YYYY-MM-DD
 * @returns {string[]}
 */
export function lastNDates(n, today = localDate()) {
  const [y, m, d] = today.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(localDate(new Date(y, m - 1, d - i, 12)));
  return out;
}
