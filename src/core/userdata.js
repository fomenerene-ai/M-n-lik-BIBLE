// Données personnelles : réglages, surlignages, notes, marque-pages, file de projection,
// sauvegarde et restauration. Tout reste sur l'appareil.
// Les marques sont rattachées à (livre, chapitre, verset), jamais à une version.

import * as db from './db.js';
import { applyRange } from './ranges.js';

/* ---------- Réglages ---------- */

export const DEFAULT_SETTINGS = {
  fontSize: 20, // taille du texte en lecture (px)
  version: 'FRLSG', // version par défaut
  theme: 'parchemin', // 'parchemin' | 'sombre'
  projColor: 'jaune', // 'jaune' | 'blanc'
  projScale: 1, // facteur de taille du texte en projection
  projVersion: 'FRLSG', // version utilisée par la file de projection
};

let settingsCache = null;

export async function loadSettings() {
  const rows = await db.getAll('settings');
  settingsCache = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) settingsCache[r.key] = r.value;
  return settingsCache;
}

export function settings() {
  return settingsCache || { ...DEFAULT_SETTINGS };
}

export async function setSetting(key, value) {
  if (!settingsCache) await loadSettings();
  settingsCache[key] = value;
  await db.put('settings', { key, value });
}

/* ---------- Surlignages ---------- */

export const COLORS = [
  { id: 'jaune', label: 'Jaune' },
  { id: 'vert', label: 'Vert' },
  { id: 'bleu', label: 'Bleu' },
  { id: 'rose', label: 'Rose' },
];

export function highlightsOf(b, c) {
  return db.getByIndex('highlights', 'bc', [b, c]);
}

/** Applique (ou retire si color = null) une couleur sur les versets vs..ve. */
export async function setHighlight(b, c, vs, ve, color) {
  const existing = await highlightsOf(b, c);
  const { remove, add } = applyRange(existing, { vs, ve }, color);
  const now = Date.now();
  const puts = add.map((h) => ({
    id: db.uid(),
    b,
    c,
    vs: h.vs,
    ve: h.ve,
    color: h.color,
    date: h.date || now, // les morceaux découpés gardent leur date d'origine
  }));
  await db.batch('highlights', { remove, put: puts });
}

/* ---------- Notes ---------- */

export function notesOf(b, c) {
  return db.getByIndex('notes', 'bc', [b, c]);
}

export async function saveNote({ id, b, c, vs, ve, text }) {
  const note = { id: id || db.uid(), b, c, vs, ve, text: text.trim(), date: Date.now() };
  await db.put('notes', note);
  return note;
}

export function deleteNote(id) {
  return db.del('notes', id);
}

/* ---------- Marque-pages et favoris ---------- */

export function bookmarksOf(b, c) {
  return db.getByIndex('bookmarks', 'bc', [b, c]);
}

/** Ajoute ou retire un marque-page (verset, ou chapitre entier si v = null). */
export async function toggleBookmark(b, c, v = null) {
  const list = await bookmarksOf(b, c);
  const found = list.find((x) => (x.v ?? null) === (v ?? null));
  if (found) {
    await db.del('bookmarks', found.id);
    return false;
  }
  await db.put('bookmarks', { id: db.uid(), b, c, v, date: Date.now() });
  return true;
}

export async function deleteMark(kind, id) {
  const store = { highlight: 'highlights', note: 'notes', bookmark: 'bookmarks' }[kind];
  await db.del(store, id);
}

/** Toutes les marques, pour l'écran Favoris. */
export async function allMarks() {
  const [h, n, bk] = await Promise.all([db.getAll('highlights'), db.getAll('notes'), db.getAll('bookmarks')]);
  return [
    ...h.map((x) => ({ kind: 'highlight', ...x })),
    ...n.map((x) => ({ kind: 'note', ...x })),
    ...bk.map((x) => ({ kind: 'bookmark', ...x, vs: x.v, ve: x.v })),
  ];
}

/* ---------- File de projection ---------- */

export async function getQueue() {
  const q = await db.getAll('queue');
  return q.sort((a, b) => a.pos - b.pos);
}

export async function addToQueue({ book, chapter, vStart, vEnd }) {
  const q = await getQueue();
  const item = {
    id: db.uid(),
    pos: q.length ? q[q.length - 1].pos + 1 : 0,
    b: book,
    c: chapter,
    vs: vStart || null,
    ve: vEnd || vStart || null,
  };
  await db.put('queue', item);
  return item;
}

export function removeFromQueue(id) {
  return db.del('queue', id);
}

export async function clearQueue() {
  const q = await getQueue();
  await db.batch('queue', { remove: q.map((x) => x.id) });
}

/* ---------- Sauvegarde ---------- */

export const BACKUP_FORMAT = 'menelik-bible-sauvegarde';

export async function exportBackup() {
  const data = {};
  for (const s of db.USER_STORES) data[s] = await db.getAll(s);
  return { format: BACKUP_FORMAT, schema: 1, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(obj) {
  if (!obj || obj.format !== BACKUP_FORMAT || !obj.data || typeof obj.data !== 'object') {
    throw new Error('Ce fichier n’est pas une sauvegarde Ménélik Bible.');
  }
  for (const s of db.USER_STORES) {
    if (obj.data[s] !== undefined && !Array.isArray(obj.data[s])) {
      throw new Error(`Sauvegarde invalide (${s}).`);
    }
  }
}

/** Restaure exactement le contenu d'une sauvegarde (remplace les données actuelles). */
export async function importBackup(obj) {
  validateBackup(obj);
  const contents = {};
  for (const s of db.USER_STORES) contents[s] = obj.data[s] || [];
  await db.replaceAll(contents);
  await loadSettings();
}
