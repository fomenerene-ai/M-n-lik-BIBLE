/**
 * Listening content pool across tiers:
 * 0 generated dialogues (contentCache), 1-2 VOA manifest items, 3 imported audio (library).
 * Every item is normalised to:
 * {id, tier, kind: 'dialogue'|'audio', title, topic, transcript, units: [{text, speaker?, start?, end?}],
 *  turns?, audioUrl?, libraryId?, hasSegments, questions?, gaps?, source?, licenseNote?}
 */
import { getAll, get, put } from '../state/db.js';
import { validateManifest } from './manifest-schema.js';
import { listLibrary } from '../audio/library.js';
import { splitSentences, wordCount } from '../learning/text.js';
import { chatJson } from '../ai/claude.js';
import { EXERCISES_SCHEMA, EXERCISES_SYSTEM } from '../ai/prompts.js';
import { checkExercises } from '../learning/answers.js';

let manifestCache = null;

/** VOA items from the shipped manifest (placeholders and invalid items are skipped). */
export async function manifestItems() {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch('content/voa-manifest.json', { cache: 'no-cache' });
    const { valid } = validateManifest(await res.json());
    manifestCache = valid.map((it) => ({
      id: `voa-${it.id}`, tier: it.tier, kind: 'audio', title: it.title, topic: it.topic, transcript: it.transcript,
      audioUrl: it.audioUrl, hasSegments: Array.isArray(it.segments) && it.segments.length > 0,
      units: it.segments && it.segments.length ? it.segments.map((s) => ({ text: s.text, start: s.start, end: s.end })) : splitSentences(it.transcript).map((text) => ({ text })),
      source: it.source, licenseNote: it.licenseNote, durationSec: it.durationSec,
    }));
  } catch (e) {
    console.warn('Manifest unavailable', e.message);
    manifestCache = [];
  }
  return manifestCache;
}

/** Normalises a stored dialogue. */
export function dialogueItem(d) {
  return {
    id: d.id, tier: 0, kind: 'dialogue', title: d.title, topic: d.topic, level: d.level, createdAt: d.createdAt,
    turns: d.turns, transcript: d.turns.map((t) => t.text).join(' '),
    units: d.turns.map((t) => ({ text: t.text, speaker: t.speaker })), hasSegments: true,
    questions: d.questions, gaps: d.gaps,
  };
}

/** Normalises an imported library item. */
export function libraryItem(m) {
  const segs = m.segments || [];
  return {
    id: `lib-${m.id}`, libraryId: m.id, tier: 3, kind: 'audio', title: m.title, topic: 'imported', transcript: m.transcript || '',
    hasSegments: segs.length > 0, durationSec: m.durationSec,
    units: segs.map((s) => ({ text: s.text || '', start: s.start, end: s.end })),
  };
}

/** Generated dialogues, newest first. */
export async function dialogues() {
  const rows = await getAll('contentCache', 'kind', IDBKeyRange.only('dialogue'));
  return rows.sort((a, b) => b.createdAt - a.createdAt).map(dialogueItem);
}

/** Every item of every tier. */
export async function allItems() {
  const [d, m, lib] = await Promise.all([dialogues(), manifestItems(), listLibrary()]);
  return [...d, ...m, ...lib.map(libraryItem)];
}

/** Finds one item by id. */
export async function findItem(id) {
  if (id.startsWith('lib-')) {
    const m = await get('audioLibrary', id.slice(4));
    return m ? libraryItem(m) : null;
  }
  if (id.startsWith('voa-')) return (await manifestItems()).find((x) => x.id === id) || null;
  const d = await get('contentCache', id);
  return d ? dialogueItem(d) : null;
}

/**
 * Tiers suited to a listening level: VOA Learning English is a stepping stone for lower levels,
 * normal-speed VOA news and real recordings take over above it.
 * @param {number} level
 * @returns {number[]}
 */
export function allowedTiers(level) {
  if (level < 4) return [0, 1, 3];
  if (level <= 6.5) return [0, 1, 2, 3];
  return [0, 2, 3];
}

/** Records that an item was listened to. */
export async function markListened(itemId, score) {
  await put('contentCache', { id: `done-${itemId}`, kind: 'listened', itemId, at: Date.now(), score });
}

/** Map itemId -> last listened record. */
export async function listenedMap() {
  const rows = await getAll('contentCache', 'kind', IDBKeyRange.only('listened'));
  return new Map(rows.map((r) => [r.itemId, r]));
}

/**
 * Recommended next item: the least recently heard item of an allowed tier that has a transcript,
 * preferring real audio when available. Returns null when only a new dialogue would do.
 * @param {number} level
 */
export async function recommend(level) {
  const [items, done] = await Promise.all([allItems(), listenedMap()]);
  const ok = items.filter((i) => allowedTiers(level).includes(i.tier) && i.transcript);
  const unheard = ok.filter((i) => !done.has(i.id));
  const real = unheard.filter((i) => i.tier > 0);
  return real[0] || unheard[0] || null;
}

/**
 * Exercises (3 questions, gaps) for an item: built in for dialogues, generated once and cached for audio.
 * @param {object} item
 */
export async function exercisesFor(item) {
  if (item.questions && item.gaps) return { questions: item.questions, gaps: item.gaps };
  const cached = await get('contentCache', `ex-${item.id}`);
  if (cached) return { questions: cached.questions, gaps: cached.gaps };
  if (!item.transcript) return null;
  const ex = await chatJson({
    system: EXERCISES_SYSTEM,
    messages: [{ role: 'user', content: `Transcript:\n${item.transcript.slice(0, 12000)}` }],
    schema: EXERCISES_SCHEMA, maxTokens: 3000,
    check: (v) => checkExercises(v, item.transcript),
  });
  await put('contentCache', { id: `ex-${item.id}`, kind: 'exercises', itemId: item.id, questions: ex.questions, gaps: ex.gaps, createdAt: Date.now() });
  return ex;
}

/**
 * Sentence units for Dictation and Shadowing: dialogue sentences (spoken by TTS) and timed audio
 * segments. Audio without segments is skipped (no per-sentence playback).
 * @param {object[]} items pool items
 * @param {number} min minimum words
 * @param {number} max maximum words
 * @returns {{text: string, item: object, unit: number, speaker?: string}[]}
 */
export function sentenceUnits(items, min, max) {
  const out = [];
  for (const item of items) {
    if (item.kind === 'dialogue') {
      item.units.forEach((u, i) => splitSentences(u.text).forEach((text) => out.push({ text, item, unit: i, speaker: u.speaker })));
    } else if (item.hasSegments) {
      item.units.forEach((u, i) => { if (u.text) out.push({ text: u.text, item, unit: i }); });
    }
  }
  return out.filter((s) => { const n = wordCount(s.text); return n >= min && n <= max; });
}
