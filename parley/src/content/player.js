/**
 * One player interface for both kinds of listening items:
 * - dialogues (tier 0) spoken by two device voices, unit = turn;
 * - audio files (tiers 1 to 3) in a plain <audio> element, unit = segment when segments exist.
 * Always natural speed. Supports replay of the current unit, previous/next, and an A-B loop.
 */
import { speak, cancelSpeech } from '../speech/tts.js';
import { markActive } from '../state/activity.js';
import { getBlob } from '../audio/library.js';

/**
 * @typedef {object} Player
 * @property {'tts'|'audio'} mode
 * @property {{text: string, speaker?: string, start?: number, end?: number}[]} units
 * @property {() => void} toggle
 * @property {() => void} pause
 * @property {() => void} replay  replays the current unit (or the last 5 s without segments)
 * @property {() => void} prev
 * @property {() => void} next
 * @property {(i: number) => Promise<{durationMs: number}>} playUnit plays one unit only
 * @property {() => void} markA
 * @property {() => void} markB
 * @property {() => void} clearLoop
 * @property {(cb: (s: object) => void) => void} onChange state: {playing, index, time, duration, loop}
 * @property {() => void} destroy
 */

/**
 * Creates a player.
 * @param {object} item pool item
 * @param {{A?: {voice: any}, B?: {voice: any}}} [voices] dialogue voices
 * @returns {Promise<Player>}
 */
export async function createPlayer(item, voices = {}) {
  return item.kind === 'dialogue' ? ttsPlayer(item, voices) : audioPlayer(item);
}

function ttsPlayer(item, voices) {
  const units = item.units;
  let index = 0;
  let playing = false;
  let token = 0;
  let finished = false;
  let loop = { a: null, b: null };
  let listener = () => {};
  const emit = () => listener({ playing, index, loop: { ...loop }, time: null, duration: null });
  const voiceFor = (u) => (u.speaker === 'B' ? voices.B : voices.A)?.voice || null;

  const runFrom = async (start, single = false) => {
    const my = ++token;
    cancelSpeech();
    playing = true;
    finished = false;
    index = start;
    emit();
    let i = start;
    let durationMs = 0;
    while (i < units.length && my === token) {
      index = i;
      emit();
      const r = await speak(units[i].text, { voice: voiceFor(units[i]) }).catch(() => ({ durationMs: 0 }));
      durationMs = r.durationMs;
      if (my !== token) return { durationMs };
      if (single) break;
      if (loop.a !== null && loop.b !== null && i >= loop.b) i = loop.a;
      else i += 1;
    }
    if (my === token) { playing = false; finished = !single; emit(); }
    return { durationMs };
  };
  const stop = () => { token += 1; cancelSpeech(); playing = false; emit(); };

  return {
    mode: 'tts', units,
    toggle() { if (playing) stop(); else runFrom(finished ? 0 : index); },
    pause: stop,
    replay() { runFrom(index, true); },
    prev() { runFrom(Math.max(0, index - 1), !playing); },
    next() { runFrom(Math.min(units.length - 1, index + 1), !playing); },
    playUnit(i) { return runFrom(i, true); },
    markA() { loop = { a: index, b: null }; emit(); },
    markB() { if (loop.a !== null) { loop.b = Math.max(loop.a, index); emit(); runFrom(loop.a); } },
    clearLoop() { loop = { a: null, b: null }; emit(); },
    onChange(cb) { listener = cb; emit(); },
    destroy() { stop(); listener = () => {}; },
  };
}

async function audioPlayer(item) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.playbackRate = 1;
  let objectUrl = null;
  if (item.libraryId) {
    const blob = await getBlob(item.libraryId);
    if (!blob) throw Object.assign(new Error('The audio file is missing. Import it again.'), { kind: 'storage' });
    objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
  } else {
    audio.src = item.audioUrl;
  }
  const units = item.hasSegments ? item.units : [];
  let stopAt = null;
  let onUnitEnd = null;
  let loop = { a: null, b: null };
  let listener = () => {};
  let raf = 0;
  let error = null;

  const indexAt = (t) => {
    if (!units.length) return 0;
    let i = units.findIndex((u) => t < u.end);
    if (i < 0) i = units.length - 1;
    return i;
  };
  const emit = () => listener({ playing: !audio.paused, index: indexAt(audio.currentTime), time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : null, loop: { ...loop }, error });
  const watch = () => {
    cancelAnimationFrame(raf);
    const step = () => {
      const t = audio.currentTime;
      if (stopAt !== null && t >= stopAt) {
        audio.pause();
        stopAt = null;
        if (onUnitEnd) { const f = onUnitEnd; onUnitEnd = null; f(); }
      } else if (loop.a !== null && loop.b !== null && t >= loop.b) {
        audio.currentTime = loop.a;
      }
      if (!audio.paused) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  audio.addEventListener('play', () => { markActive(); watch(); emit(); });
  audio.addEventListener('pause', emit);
  audio.addEventListener('timeupdate', () => { markActive(); emit(); });
  audio.addEventListener('loadedmetadata', emit);
  audio.addEventListener('ended', () => { if (onUnitEnd) { const f = onUnitEnd; onUnitEnd = null; f(); } emit(); });
  audio.addEventListener('error', () => { error = 'The audio could not be loaded. Check the connection, or the file may have moved.'; emit(); });

  const playRange = (start, end) => new Promise((resolve) => {
    const t0 = performance.now();
    if (onUnitEnd) { const f = onUnitEnd; onUnitEnd = null; f(); }
    audio.currentTime = start;
    stopAt = end;
    onUnitEnd = () => resolve({ durationMs: performance.now() - t0 });
    audio.play().catch(() => { error = 'Playback was blocked. Tap play again.'; emit(); resolve({ durationMs: 0 }); });
  });

  return {
    mode: 'audio', units, element: audio,
    toggle() { if (audio.paused) { stopAt = null; audio.play().catch(() => {}); } else audio.pause(); },
    pause() { audio.pause(); },
    replay() {
      if (units.length) { const u = units[indexAt(audio.currentTime)]; playRange(u.start, u.end); }
      else { audio.currentTime = Math.max(0, audio.currentTime - 5); audio.play().catch(() => {}); }
    },
    prev() {
      if (!units.length) { audio.currentTime = Math.max(0, audio.currentTime - 10); return; }
      const i = Math.max(0, indexAt(audio.currentTime) - 1);
      audio.currentTime = units[i].start; emit();
    },
    next() {
      if (!units.length) { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); return; }
      const i = Math.min(units.length - 1, indexAt(audio.currentTime) + 1);
      audio.currentTime = units[i].start; emit();
    },
    playUnit(i) { const u = units[i]; return u ? playRange(u.start, u.end) : Promise.resolve({ durationMs: 0 }); },
    seek(t) { audio.currentTime = t; emit(); },
    markA() { loop = { a: audio.currentTime, b: null }; emit(); },
    markB() { if (loop.a !== null && audio.currentTime > loop.a) { loop.b = audio.currentTime; audio.currentTime = loop.a; audio.play().catch(() => {}); emit(); } },
    clearLoop() { loop = { a: null, b: null }; emit(); },
    onChange(cb) { listener = cb; emit(); },
    destroy() {
      cancelAnimationFrame(raf);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      listener = () => {};
    },
  };
}
