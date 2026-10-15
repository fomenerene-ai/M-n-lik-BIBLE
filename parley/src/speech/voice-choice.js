/**
 * Chooses the voice for a session from the settings (voice per accent, accent mix).
 */
import { getSettings } from '../state/settings.js';
import { getVoices, pickVoice, englishVoiceGroups } from './tts.js';

const LAST_ACCENT = 'parley.lastAccent';

/**
 * Resolves the accent for a new session: alternates US and UK when the mix is "mixed".
 * @param {string} mix "mixed" or a language tag
 * @param {string[]} available installed English language tags
 * @returns {string}
 */
export function nextAccent(mix, available) {
  if (mix !== 'mixed' && available.includes(mix)) return mix;
  let last = 'en-GB';
  try { last = localStorage.getItem(LAST_ACCENT) || last; } catch { /* storage blocked */ }
  const pool = ['en-US', 'en-GB'].filter((l) => available.includes(l));
  if (!pool.length) return available[0] || 'en-US';
  const next = pool.find((l) => l !== last) || pool[0];
  try { localStorage.setItem(LAST_ACCENT, next); } catch { /* storage blocked */ }
  return next;
}

/**
 * Voice and language for a new session.
 * @param {{lang?: string}} [o] force a language tag
 * @returns {Promise<{voice: SpeechSynthesisVoice|null, lang: string, available: string[]}>}
 */
export async function sessionVoice(o = {}) {
  const [settings, voices] = await Promise.all([getSettings(), getVoices()]);
  const available = englishVoiceGroups(voices).map((g) => g.lang);
  const lang = o.lang || nextAccent(settings.accentMix, available);
  return { voice: pickVoice(voices, lang, settings.voices), lang, available };
}

/**
 * Two different voices for dialogues (mixed accents when possible).
 * @returns {Promise<{A: {voice: SpeechSynthesisVoice|null, lang: string}, B: {voice: SpeechSynthesisVoice|null, lang: string}}>}
 */
export async function dialogueVoices() {
  const [settings, voices] = await Promise.all([getSettings(), getVoices()]);
  const groups = englishVoiceGroups(voices);
  const langs = groups.map((g) => g.lang);
  const a = langs.includes('en-US') ? 'en-US' : langs[0] || 'en-US';
  const b = langs.includes('en-GB') ? 'en-GB' : langs.find((l) => l !== a) || a;
  const va = pickVoice(voices, a, settings.voices);
  let vb = pickVoice(voices, b, settings.voices);
  if (vb && va && vb.voiceURI === va.voiceURI) {
    const other = (groups.find((g) => g.lang === b) || { voices: [] }).voices.find((v) => v.voiceURI !== va.voiceURI);
    if (other) vb = other;
  }
  return { A: { voice: va, lang: a }, B: { voice: vb, lang: b } };
}
