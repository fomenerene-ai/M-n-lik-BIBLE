/**
 * Text to speech with the device voices (speechSynthesis). Always natural rate (1.0).
 */
import { markActive } from '../state/activity.js';

/** Whether speech synthesis exists. */
export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Normalises a voice language tag: "en_US" -> "en-US".
 * @param {string} lang
 */
export function normLang(lang) {
  const [a, b] = String(lang || '').replace('_', '-').split('-');
  return b ? `${a.toLowerCase()}-${b.toUpperCase()}` : a.toLowerCase();
}

/**
 * Loads the voice list (it arrives asynchronously in Chrome).
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function getVoices() {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); resolve(speechSynthesis.getVoices()); };
    speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, 2500);
  });
}

const LANG_NAMES = { 'en-US': 'US', 'en-GB': 'UK', 'en-AU': 'Australia', 'en-IN': 'India', 'en-IE': 'Ireland', 'en-CA': 'Canada', 'en-NZ': 'New Zealand', 'en-ZA': 'South Africa', 'en-SG': 'Singapore', 'en-NG': 'Nigeria' };

/**
 * English voices grouped by language tag, US and UK first.
 * @param {SpeechSynthesisVoice[]} voices
 * @returns {{lang: string, label: string, voices: SpeechSynthesisVoice[]}[]}
 */
export function englishVoiceGroups(voices) {
  const groups = new Map();
  for (const v of voices) {
    const lang = normLang(v.lang);
    if (!lang.startsWith('en')) continue;
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang).push(v);
  }
  const order = (l) => (l === 'en-US' ? 0 : l === 'en-GB' ? 1 : 2);
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([lang, vs]) => ({ lang, label: `English (${LANG_NAMES[lang] || lang.slice(3)})`, voices: vs }));
}

/**
 * Picks a voice for a language: the saved one if still installed, else a local default, else any.
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} lang e.g. "en-GB"
 * @param {Record<string,string>} [saved] voiceURI per lang
 * @returns {SpeechSynthesisVoice|null}
 */
export function pickVoice(voices, lang, saved = {}) {
  const same = voices.filter((v) => normLang(v.lang) === lang);
  const chosen = same.find((v) => v.voiceURI === saved[lang]);
  if (chosen) return chosen;
  return same.find((v) => v.localService && v.default) || same.find((v) => v.localService) || same[0]
    || voices.find((v) => normLang(v.lang).startsWith('en')) || null;
}

const alive = new Set();

/**
 * Speaks text. Resolves when finished or cancelled.
 * @param {string} text
 * @param {{voice?: SpeechSynthesisVoice|null, lang?: string, onBoundary?: (charIndex: number, charLength: number) => void, onStart?: Function}} [o]
 * @returns {Promise<{cancelled: boolean, durationMs: number}>}
 */
export function speak(text, o = {}) {
  return new Promise((resolve, reject) => {
    if (!ttsSupported()) { reject(Object.assign(new Error('No speech synthesis'), { kind: 'no-voice' })); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (o.voice) { u.voice = o.voice; u.lang = o.voice.lang; } else if (o.lang) u.lang = o.lang;
    u.rate = 1;
    u.pitch = 1;
    alive.add(u);
    let started = 0;
    const watchdog = setTimeout(() => {
      if (!started) { alive.delete(u); speechSynthesis.cancel(); reject(Object.assign(new Error('Speech did not start'), { kind: 'no-voice' })); }
    }, 8000);
    u.onstart = () => { started = performance.now(); markActive(); if (o.onStart) o.onStart(); };
    u.onboundary = (e) => { markActive(); if (o.onBoundary && e.name !== 'sentence') o.onBoundary(e.charIndex, e.charLength || 0); };
    u.onend = () => { clearTimeout(watchdog); alive.delete(u); markActive(); resolve({ cancelled: false, durationMs: started ? performance.now() - started : 0 }); };
    u.onerror = (e) => {
      clearTimeout(watchdog);
      alive.delete(u);
      if (e.error === 'interrupted' || e.error === 'canceled') resolve({ cancelled: true, durationMs: 0 });
      else reject(Object.assign(new Error(`Speech error: ${e.error}`), { kind: e.error === 'voice-unavailable' || e.error === 'language-unavailable' ? 'no-voice' : 'tts' }));
    };
    speechSynthesis.speak(u);
  });
}

/** Stops any speech. */
export function cancelSpeech() {
  if (ttsSupported()) speechSynthesis.cancel();
}

/**
 * Sequential speech queue for streamed replies: push sentences as they arrive.
 * @param {SpeechSynthesisVoice|null} voice
 * @param {{onSentence?: (text: string) => void}} [o]
 */
export function createSpeechQueue(voice, o = {}) {
  const items = [];
  let ended = false;
  let cancelled = false;
  let running = null;
  let resolveIdle;
  const idle = new Promise((r) => { resolveIdle = r; });
  const run = async () => {
    while (items.length && !cancelled) {
      const t = items.shift();
      if (o.onSentence) o.onSentence(t);
      try { await speak(t, { voice }); } catch (e) { console.warn(e.message); }
    }
    running = null;
    if ((ended && !items.length) || cancelled) resolveIdle();
  };
  return {
    push(text) { if (cancelled || !text.trim()) return; items.push(text); if (!running) running = run(); },
    end() { ended = true; if (!running && !items.length) resolveIdle(); },
    /** Resolves when everything pushed before end() was spoken (or the queue was cancelled). */
    wait() { return idle; },
    cancel() { cancelled = true; items.length = 0; cancelSpeech(); resolveIdle(); },
  };
}
