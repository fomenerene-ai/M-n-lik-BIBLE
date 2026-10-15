/**
 * Backup format: build, validate, migrate and merge. Pure, no IndexedDB.
 *
 * Format (schemaVersion 1):
 * {
 *   app: "parley", schemaVersion: 1, exportedAt: ISO string,
 *   settings: {...} (never the API key), profile: {...},
 *   minutes: [], sessions: [], cards: [], reports: [], contentCache: [], shadowAttempts: []
 * }
 * Imported audio (audioLibrary and its blobs) is never exported.
 */
import { BACKUP_SCHEMA_VERSION, DEFAULT_SETTINGS } from '../config.js';

/** Stores included in a backup, all arrays of records. */
export const BACKUP_LISTS = ['minutes', 'sessions', 'cards', 'reports', 'contentCache', 'shadowAttempts'];

/** Settings keys that must never leave the device. */
const SECRET_KEYS = ['apiKey'];

/**
 * Builds a backup object from a snapshot of the stores.
 * @param {{settings: object, profile: object} & Record<string, any[]>} snap
 * @param {Date} [now]
 */
export function buildBackup(snap, now = new Date()) {
  const settings = { ...(snap.settings || {}) };
  for (const k of SECRET_KEYS) delete settings[k];
  const out = { app: 'parley', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), settings, profile: snap.profile || null };
  for (const k of BACKUP_LISTS) out[k] = Array.isArray(snap[k]) ? snap[k] : [];
  return out;
}

/**
 * Migration steps: MIGRATIONS[v] converts a backup at version v to v + 1.
 * Version 0 is any backup without a schemaVersion (pre-release exports): its lists may be missing and
 * levels may sit under profile.levels.
 */
const MIGRATIONS = {
  0: (b) => {
    const out = { ...b, app: 'parley', schemaVersion: 1 };
    for (const k of BACKUP_LISTS) if (!Array.isArray(out[k])) out[k] = [];
    if (out.profile && out.profile.levels) {
      const { levels, ...rest } = out.profile;
      out.profile = { ...rest, listeningLevel: levels.listening, speakingLevel: levels.speaking, shadowLevel: levels.shadow };
    }
    out.settings = out.settings || {};
    return out;
  },
};

/**
 * Brings a backup up to the current schema version.
 * @param {any} b parsed JSON
 * @returns {object}
 * @throws {Error} if the version is newer than this app
 */
export function migrateBackup(b) {
  let v = Number.isInteger(b.schemaVersion) ? b.schemaVersion : 0;
  if (v > BACKUP_SCHEMA_VERSION) throw new Error(`This backup comes from a newer version of the app (schema ${v}). Update the app first.`);
  let cur = b;
  while (v < BACKUP_SCHEMA_VERSION) { cur = MIGRATIONS[v](cur); v += 1; }
  return cur;
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isStr = (x) => typeof x === 'string';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Per-list record validators. Records failing them are dropped, not imported. */
const RECORD_CHECKS = {
  minutes: (r) => isObj(r) && DATE_RE.test(r.date) && isNum(r.total),
  sessions: (r) => isObj(r) && DATE_RE.test(r.date) && isObj(r.steps),
  cards: (r) => isObj(r) && isStr(r.id) && isStr(r.front) && r.front.length <= 500 && ['word', 'expression', 'phrasal', 'sentence'].includes(r.type) && isNum(r.due),
  reports: (r) => isObj(r) && isStr(r.id) && isStr(r.date),
  contentCache: (r) => isObj(r) && isStr(r.id) && isStr(r.kind),
  shadowAttempts: (r) => isObj(r) && ['S', 'M', 'L'].includes(r.tier) && isNum(r.score),
};

/**
 * Validates and migrates a parsed backup. Invalid records are dropped and counted.
 * @param {any} raw parsed JSON
 * @returns {{backup: object, dropped: number}}
 * @throws {Error} with a user-facing message when the file is not a backup at all
 */
export function validateBackup(raw) {
  if (!isObj(raw)) throw new Error('This file is not a backup (not a JSON object).');
  if (raw.app !== undefined && raw.app !== 'parley') throw new Error('This file is a backup from another app.');
  if (raw.schemaVersion === undefined && !raw.profile && !raw.cards) throw new Error('This file is not a backup (no profile or cards).');
  const b = migrateBackup(raw);
  let dropped = 0;
  const out = { ...b };
  for (const k of BACKUP_LISTS) {
    const list = Array.isArray(b[k]) ? b[k] : [];
    out[k] = list.filter((r) => { const ok = RECORD_CHECKS[k](r); if (!ok) dropped += 1; return ok; });
  }
  out.settings = isObj(b.settings) ? sanitizeSettings(b.settings) : {};
  out.profile = isObj(b.profile) ? sanitizeProfile(b.profile) : null;
  return { backup: out, dropped };
}

/** Keeps only known settings keys with plausible types. Never accepts an API key. */
function sanitizeSettings(s) {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in s && !SECRET_KEYS.includes(k)) out[k] = s[k];
  if (out.voices && !isObj(out.voices)) delete out.voices;
  if (out.model !== undefined && !(isStr(out.model) && /^[a-z0-9.-]{3,80}$/.test(out.model))) delete out.model;
  if (out.conversationMinutes !== undefined && ![5, 10, 15, 20].includes(out.conversationMinutes)) delete out.conversationMinutes;
  return out;
}

function sanitizeProfile(p) {
  const lv = (x) => (isNum(x) ? Math.min(10, Math.max(1, x)) : undefined);
  return {
    id: 'main',
    listeningLevel: lv(p.listeningLevel), speakingLevel: lv(p.speakingLevel), shadowLevel: lv(p.shadowLevel),
    xp: isNum(p.xp) && p.xp >= 0 ? Math.floor(p.xp) : 0,
    placementDoneAt: isStr(p.placementDoneAt) ? p.placementDoneAt : null,
    shadowTier: ['S', 'M', 'L'].includes(p.shadowTier) ? p.shadowTier : undefined,
  };
}

/** Key of a record within a list, used for merging. */
export function recordKey(list, r) {
  if (list === 'minutes' || list === 'sessions') return r.date;
  if (list === 'shadowAttempts') return `${r.tier}|${r.at}|${r.score}`;
  return r.id;
}

/**
 * Merges imported records into existing ones.
 * - minutes: per date, the max of each activity (re-importing never doubles minutes)
 * - cards: by id, the most recently reviewed copy wins; imported cards whose front already exists
 *   (case-insensitive) under another id are skipped
 * - everything else: existing records win, missing ones are added
 * @param {string} list
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]} the records to write
 */
export function mergeRecords(list, existing, incoming) {
  const byKey = new Map(existing.map((r) => [recordKey(list, r), r]));
  const fronts = new Set(list === 'cards' ? existing.map((c) => c.front.toLowerCase().trim()) : []);
  const out = [];
  for (const r of incoming) {
    const key = recordKey(list, r);
    const cur = byKey.get(key);
    if (list === 'minutes') {
      if (!cur) { out.push(r); continue; }
      const merged = { ...cur };
      for (const a of ['listen', 'talk', 'shadow', 'cards', 'dictation']) merged[a] = Math.max(cur[a] || 0, r[a] || 0);
      merged.total = ['listen', 'talk', 'shadow', 'cards', 'dictation'].reduce((s, a) => s + merged[a], 0);
      out.push(merged);
    } else if (list === 'cards') {
      if (cur) { if ((r.lastReviewedAt || 0) > (cur.lastReviewedAt || 0)) out.push(r); continue; }
      const f = r.front.toLowerCase().trim();
      if (fronts.has(f)) continue;
      fronts.add(f);
      out.push(r);
    } else if (!cur) {
      out.push(r);
    }
  }
  return out;
}
