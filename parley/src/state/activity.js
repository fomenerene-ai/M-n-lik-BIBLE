/**
 * Active-time tracker. Counts foreground time only: the clock pauses when the tab is hidden or when
 * nothing happened for IDLE_MS (no touch, key, audio playback, speech or recognition).
 * Minutes are flushed to the minutes store every 15 s; XP is awarded when the activity ends.
 */
import { IDLE_MS } from '../config.js';
import { addMinutes } from './minutes.js';
import { addXp, getProfile } from './profile.js';
import { recordStep } from './sessions.js';
import { xpForActivity, levelInfo } from '../learning/xp.js';

let lastActive = Date.now();
let listening = false;

/** Signals activity (called by audio, TTS and STT events, and by input listeners). */
export function markActive() {
  lastActive = Date.now();
}

function ensureListeners() {
  if (listening) return;
  listening = true;
  for (const ev of ['pointerdown', 'keydown', 'input', 'wheel']) document.addEventListener(ev, markActive, { passive: true, capture: true });
}

/**
 * Starts tracking an activity.
 * @param {string} activity one of ACTIVITIES
 * @param {{onTick?: (activeSec: number) => void, step?: boolean}} [o] step: part of the guided session
 */
export function startActivity(activity, o = {}) {
  ensureListeners();
  markActive();
  let activeMs = 0;
  let unflushedMs = 0;
  let paused = false;
  let ended = false;
  let last = Date.now();

  const flush = async () => {
    const ms = unflushedMs;
    unflushedMs = 0;
    if (ms > 0) await addMinutes(activity, ms / 60000).catch((e) => console.error(e));
  };

  const tick = () => {
    const now = Date.now();
    const dt = Math.min(now - last, 5000);
    last = now;
    if (!paused && document.visibilityState === 'visible' && now - lastActive < IDLE_MS) {
      activeMs += dt;
      unflushedMs += dt;
    }
    if (o.onTick) o.onTick(activeMs / 1000);
  };
  const timer = setInterval(tick, 1000);
  const flushTimer = setInterval(flush, 15000);
  const onHide = () => { if (document.visibilityState === 'hidden') { tick(); flush(); } else last = Date.now(); };
  document.addEventListener('visibilitychange', onHide);

  const stop = async () => {
    if (ended) return null;
    ended = true;
    tick();
    clearInterval(timer);
    clearInterval(flushTimer);
    document.removeEventListener('visibilitychange', onHide);
    await flush();
    return activeMs / 60000;
  };

  return {
    get activeSeconds() { return activeMs / 1000; },
    pause() { tick(); paused = true; },
    resume() { last = Date.now(); paused = false; markActive(); },
    /**
     * Ends the activity and awards XP.
     * @param {{quality?: number|null, done?: boolean}} [f] quality 0..1; done marks the session step done
     * @returns {Promise<{minutes: number, xp: number, bonus: number, leveledUp: boolean, level: number}|null>}
     */
    async finish(f = {}) {
      const minutes = await stop();
      if (minutes === null) return null;
      const before = levelInfo((await getProfile()).xp).level;
      const xp = xpForActivity(minutes, f.quality ?? null);
      await addXp(xp);
      let bonus = 0;
      if (o.step) bonus = (await recordStep(activity, { minutes, xp, done: !!f.done })).bonus;
      const level = levelInfo((await getProfile()).xp).level;
      return { minutes, xp, bonus, leveledUp: level > before, level };
    },
  };
}

