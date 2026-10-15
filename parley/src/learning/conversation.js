/**
 * Pure helpers for Talk: learner metrics and history trimming.
 */
import { wordCount, words } from './text.js';
import { LONG_SILENCE_MS } from '../config.js';

/**
 * Local metrics computed without AI.
 * @param {{text: string, typed?: boolean, startedAt?: number, firstResultAt?: number|null, lastResultAt?: number|null, longPauses?: number}[]} turns learner turns
 * @returns {{wpm: number|null, turns: number, avgTurnWords: number, longSilences: number}}
 */
export function learnerMetrics(turns) {
  const spoken = turns.filter((t) => !t.typed && t.firstResultAt !== null && t.firstResultAt !== undefined);
  let speakMs = 0;
  let spokenWords = 0;
  let longSilences = 0;
  for (const t of spoken) {
    // The first result arrives ~0.5 s after speech starts; count that lag as speaking time.
    speakMs += Math.max(0, t.lastResultAt - t.firstResultAt) + 500;
    spokenWords += wordCount(t.text);
    if (t.firstResultAt - t.startedAt > LONG_SILENCE_MS) longSilences += 1;
    longSilences += t.longPauses || 0;
  }
  const total = turns.reduce((s, t) => s + wordCount(t.text), 0);
  return {
    wpm: speakMs > 3000 ? Math.round(spokenWords / (speakMs / 60000)) : null,
    turns: turns.length,
    avgTurnWords: turns.length ? Math.round((total / turns.length) * 10) / 10 : 0,
    longSilences,
  };
}

/**
 * Keeps the request history within a safe size. When too long, the oldest exchanges (after the
 * opening) are replaced by a short note that recalls what the learner said, so the partner keeps
 * the thread without resending everything.
 * @param {{role: 'user'|'assistant', content: string}[]} messages alternating, starting with user
 * @param {number} [maxChars]
 * @returns {{role: string, content: string}[]}
 */
export function trimHistory(messages, maxChars = 24000) {
  const size = (list) => list.reduce((s, m) => s + m.content.length, 0);
  if (size(messages) <= maxChars || messages.length < 8) return messages;
  const head = messages.slice(0, 2);
  let tail = messages.slice(2);
  const dropped = [];
  while (size(head) + size(tail) > maxChars * 0.8 && tail.length > 6) {
    dropped.push(...tail.slice(0, 2));
    tail = tail.slice(2);
  }
  const recall = dropped.filter((m) => m.role === 'user').map((m) => words(m.content).slice(0, 12).join(' ').slice(0, 80)).join(' / ').slice(-1500);
  const note = { role: 'user', content: `[Session note: earlier exchanges were shortened. The learner had said: ${recall}]` };
  const ack = { role: 'assistant', content: 'Right.' };
  return [...head, note, ack, ...tail];
}
