/**
 * Transcript parsing and alignment for imported audio. Pure.
 * Formats: .srt and .vtt (timed cues), .txt (plain text), Common Voice .tsv (columns path, sentence).
 */
import { splitSentences } from './text.js';

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSec(s) {
  const m = s.match(TIME);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
}

/**
 * Parses SRT or WebVTT cues.
 * @param {string} text
 * @returns {{start: number, end: number, text: string}[]}
 */
export function parseCues(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/);
  const cues = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lines[i].split('-->');
    const start = toSec(a);
    const end = toSec(z);
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && body) cues.push({ start, end, text: body });
  }
  return cues.sort((x, y) => x.start - y.start);
}

/**
 * Parses a Common Voice style TSV into a map from clip file name to sentence.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseTsv(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const map = new Map();
  if (!lines.length) return map;
  const head = lines[0].split('\t').map((h) => h.trim().toLowerCase());
  const pi = head.indexOf('path');
  const si = head.indexOf('sentence');
  if (pi < 0 || si < 0) return map;
  for (const l of lines.slice(1)) {
    const cols = l.split('\t');
    if (cols[pi] && cols[si]) map.set(cols[pi].trim(), cols[si].trim());
  }
  return map;
}

/**
 * File name without folders and extension, lowercase.
 * @param {string} name
 */
export function baseName(name) {
  return String(name).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').toLowerCase();
}

/**
 * Assigns transcript sentences to silence-based segments, in order.
 * Equal counts map one to one; otherwise each sentence goes to the segment where its middle falls
 * when both are laid out proportionally (characters versus seconds).
 * @param {string[]} sentences
 * @param {{start: number, end: number}[]} segments
 * @returns {{start: number, end: number, text: string}[]}
 */
export function alignSentences(sentences, segments) {
  if (!segments.length) return [];
  if (sentences.length === segments.length) return segments.map((s, i) => ({ ...s, text: sentences[i] }));
  const total = segments.reduce((a, s) => a + (s.end - s.start), 0);
  const cum = [];
  let acc = 0;
  for (const s of segments) { cum.push([acc / total, (acc + s.end - s.start) / total]); acc += s.end - s.start; }
  const chars = sentences.reduce((a, s) => a + s.length, 0) || 1;
  const texts = segments.map(() => []);
  let c = 0;
  for (const sent of sentences) {
    const mid = (c + sent.length / 2) / chars;
    c += sent.length;
    let k = cum.findIndex(([a, b]) => mid >= a && mid < b);
    if (k < 0) k = segments.length - 1;
    texts[k].push(sent);
  }
  return segments.map((s, i) => ({ ...s, text: texts[i].join(' ') }));
}

/**
 * Plain text transcript to sentences (keeps one line per sentence when lines are already sentences).
 * @param {string} text
 */
export function txtSentences(text) {
  return splitSentences(String(text || '').replace(/\r/g, ' ').replace(/\n+/g, ' '));
}
