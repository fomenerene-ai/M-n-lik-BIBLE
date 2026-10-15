/**
 * Imports local audio files with optional transcripts into the library (tier 3).
 * Audio is decoded in the browser at 16 kHz, segmented on silences and aligned with the transcript.
 * Nothing leaves the tablet.
 */
import { parseCues, parseTsv, baseName, alignSentences, txtSentences } from '../learning/transcript.js';
import { segmentBySilence, speechBounds } from './segment.js';
import { saveLibraryItem } from './library.js';

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'webm', 'flac'];
const MAX_BYTES = 80 * 1024 * 1024;
const MAX_SEGMENT_SEC = 25 * 60;
export const DECODE_RATE = 16000;

const ext = (name) => String(name).split('.').pop().toLowerCase();

/**
 * Decodes an audio file to mono samples at 16 kHz.
 * @param {Blob} blob
 * @returns {Promise<{samples: Float32Array, rate: number, duration: number}>}
 */
export async function decodeMono(blob) {
  const ctx = new OfflineAudioContext(1, 1, DECODE_RATE);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = buf.length;
  const samples = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) samples[i] += d[i] / buf.numberOfChannels;
  }
  return { samples, rate: buf.sampleRate, duration: buf.duration };
}

/**
 * Imports files chosen in the picker.
 * @param {File[]} files audio files plus optional .txt, .srt, .vtt (same base name) and .tsv
 * @param {(name: string, status: string) => void} [onProgress]
 * @returns {Promise<{imported: number, skipped: {name: string, reason: string}[]}>}
 */
export async function importFiles(files, onProgress = () => {}) {
  const audio = files.filter((f) => AUDIO_EXT.includes(ext(f.name)));
  const texts = new Map();
  const tsv = new Map();
  for (const f of files) {
    const e = ext(f.name);
    if (e === 'tsv') for (const [k, v] of parseTsv(await f.text())) tsv.set(baseName(k), v);
    else if (['txt', 'srt', 'vtt'].includes(e)) texts.set(baseName(f.name), { kind: e, text: await f.text() });
  }
  const skipped = files.filter((f) => !AUDIO_EXT.includes(ext(f.name)) && !['txt', 'srt', 'vtt', 'tsv'].includes(ext(f.name))).map((f) => ({ name: f.name, reason: 'Unsupported file type' }));
  let imported = 0;
  for (const f of audio) {
    if (f.size > MAX_BYTES) { skipped.push({ name: f.name, reason: 'File larger than 80 MB' }); onProgress(f.name, 'skipped: too large'); continue; }
    onProgress(f.name, 'decoding');
    let decoded;
    try { decoded = await decodeMono(f); } catch {
      skipped.push({ name: f.name, reason: 'Could not decode this audio format' });
      onProgress(f.name, 'skipped: cannot decode');
      continue;
    }
    onProgress(f.name, 'finding sentences');
    const key = baseName(f.name);
    const t = texts.get(key);
    const cvSentence = tsv.get(key);
    let segments = [];
    let transcript = '';
    if (t && (t.kind === 'srt' || t.kind === 'vtt')) {
      segments = parseCues(t.text).filter((c) => c.start < decoded.duration).map((c) => ({ ...c, end: Math.min(c.end, decoded.duration) }));
      transcript = segments.map((s) => s.text).join(' ');
    } else if (cvSentence) {
      segments = [{ ...speechBounds(decoded.samples, decoded.rate), text: cvSentence }];
      transcript = cvSentence;
    } else if (decoded.duration <= MAX_SEGMENT_SEC) {
      const segs = segmentBySilence(decoded.samples, decoded.rate);
      if (t) {
        transcript = t.text.replace(/\s+/g, ' ').trim();
        segments = alignSentences(txtSentences(t.text), segs);
      } else segments = segs.map((s) => ({ ...s, text: '' }));
    } else if (t) transcript = t.text.replace(/\s+/g, ' ').trim();
    const meta = {
      id: crypto.randomUUID(),
      title: cvSentence ? cvSentence.slice(0, 80) : f.name.replace(/\.[^.]+$/, ''),
      fileName: f.name,
      durationSec: Math.round(decoded.duration * 10) / 10,
      transcript, segments,
      commonVoice: !!cvSentence,
      createdAt: Date.now(),
    };
    await saveLibraryItem(meta, f);
    imported += 1;
    onProgress(f.name, `done, ${segments.length} segment${segments.length === 1 ? '' : 's'}${transcript ? '' : ', no transcript'}`);
  }
  return { imported, skipped };
}
