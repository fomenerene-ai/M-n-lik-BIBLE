/**
 * Shadowing references: plays the model sentence and, when real audio samples are readable, provides
 * its pitch contour and rhythm. Speech synthesis output cannot be captured, so TTS references have no
 * contour (duration only, measured while speaking).
 */
import { decodeMono } from './import.js';
import { getBlob } from './library.js';
import { pitchTrack, semitoneContour } from './pitch.js';
import { rhythmProfile } from './rhythm.js';
import { createPlayer } from '../content/player.js';
import { speak, cancelSpeech } from '../speech/tts.js';

const decoded = new Map();

async function decodeItem(item) {
  if (decoded.has(item.id)) return decoded.get(item.id);
  let p;
  if (item.libraryId) p = getBlob(item.libraryId).then((b) => (b ? decodeMono(b) : null));
  else p = fetch(item.audioUrl, { mode: 'cors' }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? decodeMono(b) : null));
  p = p.catch(() => null);
  decoded.set(item.id, p);
  return p;
}

/**
 * Prepares a reference for a sentence unit.
 * @param {{text: string, item?: object, unit?: number, speaker?: string}} s
 * @param {{voice: any}} tts voice for synthetic references
 * @returns {Promise<{kind: 'audio'|'tts', play: () => Promise<void>, contour: {t: number, st: number}[]|null,
 *   rhythm: {duration: number, pauses: number[]|null}|null, note: string, destroy: () => void}>}
 */
export async function prepareReference(s, tts) {
  if (s.item && s.item.kind === 'audio') {
    const player = await createPlayer(s.item);
    const unit = s.item.units[s.unit];
    const dec = await decodeItem(s.item);
    let contour = null;
    let rhythm = null;
    if (dec) {
      const a = Math.floor(unit.start * dec.rate);
      const b = Math.min(dec.samples.length, Math.ceil(unit.end * dec.rate));
      const seg = dec.samples.subarray(a, b);
      contour = semitoneContour(pitchTrack(seg, dec.rate));
      rhythm = rhythmProfile(seg, dec.rate);
      if (contour.length < 10) contour = null;
    }
    return {
      kind: 'audio', contour, rhythm,
      note: dec ? 'Real recording: words, voice curve and rhythm are compared.' : 'This remote audio cannot be analysed in the browser (no CORS access), so it is compared like a synthetic voice: words and duration only.',
      async play() { await player.playUnit(s.unit); },
      destroy() { player.destroy(); },
    };
  }
  const ref = {
    kind: 'tts', contour: null, rhythm: null,
    note: 'Synthetic voice: its audio cannot be captured, so there is no reference curve. You see your own curve, the word match and a duration check.',
    async play() {
      cancelSpeech();
      const r = await speak(s.text, { voice: tts.voice });
      if (r.durationMs > 300) ref.rhythm = { duration: r.durationMs / 1000, pauses: null };
    },
    destroy() { cancelSpeech(); },
  };
  return ref;
}
