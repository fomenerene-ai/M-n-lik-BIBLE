// Téléchargement et enregistrement hors ligne des deux versions.
//
// Reprise sans tout recommencer :
//  - une version terminée n'est jamais retéléchargée ;
//  - le fichier brut téléchargé est gardé en cache tant que son enregistrement n'est pas fini,
//    pour qu'un échec d'écriture ne force pas un nouveau téléchargement ;
//  - les livres déjà enregistrés sont sautés.

import * as db from './db.js';
import { parseBolls, validateAgainstCanon } from './parse-bolls.js';
import { VERSIONS } from './versions.js';
import { BOOKS } from './books.js';
import { renumber, RULES, NUMEROTATION } from './versification.js';

const RAW_CACHE = 'bible-brut';
const APPROX_SIZE = 5_500_000; // taille indicative si le serveur ne la donne pas

export function sourcesFor(id) {
  return [
    `https://bolls.life/static/translations/${id}.json`,
    `https://bolls.life/get-translation/${id}/`,
  ];
}

export async function versionStatus(id) {
  return (await db.get('meta', `version:${id}`)) || { key: `version:${id}`, complete: false };
}

/** Version installée avec une numérotation antérieure aux règles actuelles. */
export async function needsRenumbering(id) {
  const st = await versionStatus(id);
  return Boolean(st.complete && RULES[id] && st.numerotation !== NUMEROTATION);
}

export async function allReady() {
  for (const id of Object.keys(VERSIONS)) {
    if (!(await versionStatus(id)).complete) return false;
  }
  return true;
}

async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !res.body.getReader) {
    const txt = await res.text();
    onBytes(txt.length, txt.length);
    return txt;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes(received, total || Math.max(APPROX_SIZE, received * 1.05));
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return new TextDecoder('utf-8').decode(buf);
}

async function getRaw(id, onProgress) {
  // 1. fichier brut déjà téléchargé lors d'un essai précédent
  if ('caches' in self) {
    const cache = await caches.open(RAW_CACHE);
    const hit = await cache.match(`/__brut__/${id}.json`);
    if (hit) {
      onProgress({ phase: 'download', ratio: 1 });
      return hit.text();
    }
  }
  // 2. téléchargement, avec source de repli
  let lastErr = null;
  for (const url of sourcesFor(id)) {
    try {
      const txt = await fetchWithProgress(url, (r, t) =>
        onProgress({ phase: 'download', ratio: Math.min(1, r / t), bytes: r }),
      );
      if ('caches' in self) {
        const cache = await caches.open(RAW_CACHE);
        await cache.put(
          `/__brut__/${id}.json`,
          new Response(txt, { headers: { 'content-type': 'application/json' } }),
        );
      }
      return txt;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Téléchargement impossible (${lastErr?.message || 'réseau'}). Vérifiez la connexion puis réessayez.`,
  );
}

async function dropRaw(id) {
  if ('caches' in self) {
    const cache = await caches.open(RAW_CACHE);
    await cache.delete(`/__brut__/${id}.json`);
  }
}

/**
 * Enregistre un fichier déjà analysé dans IndexedDB, livre par livre.
 * replace : réécrit tous les chapitres, même ceux déjà présents.
 */
export async function storeParsed(id, parsed, onProgress, replace = false) {
  parsed = renumber(id, parsed);
  const problems = validateAgainstCanon(parsed.chapters);
  if (parsed.chapters.size < 1000) {
    throw new Error(`Fichier incomplet pour ${VERSIONS[id].label} (${parsed.chapters.size} chapitres).`);
  }
  const existing = replace ? new Set() : new Set((await db.chapterKeys(id)).map((k) => `${k[1]}:${k[2]}`));
  for (const book of BOOKS) {
    const rows = [];
    let have = true;
    for (let c = 1; c <= book.chapters; c++) {
      const key = `${book.id}:${c}`;
      if (!existing.has(key)) have = false;
      const ch = parsed.chapters.get(key);
      if (ch) rows.push({ v: id, b: book.id, c, verses: ch.verses });
    }
    if (!have) await db.batch('chapters', { put: rows });
    onProgress({ phase: 'store', ratio: book.id / BOOKS.length });
  }
  const status = {
    key: `version:${id}`,
    complete: true,
    verses: parsed.total,
    chapters: parsed.chapters.size,
    problems,
    numerotation: NUMEROTATION,
    emptyVerses: parsed.empty,
    date: Date.now(),
  };
  await db.put('meta', status);
  return status;
}

/**
 * Télécharge et enregistre une version (sautée si déjà complète).
 * replace : retélécharge et réécrit une version déjà installée, sans la vider avant :
 * l'ancien texte reste lisible jusqu'à ce que le nouveau le remplace.
 */
export async function importVersion(id, onProgress = () => {}, replace = false) {
  const st = await versionStatus(id);
  if (st.complete && !replace) {
    onProgress({ phase: 'done', ratio: 1 });
    return st;
  }
  const txt = await getRaw(id, onProgress);
  onProgress({ phase: 'parse', ratio: 0 });
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    await dropRaw(id);
    throw new Error('Fichier reçu illisible. Réessayez.');
  }
  const parsed = parseBolls(data);
  const status = await storeParsed(id, parsed, onProgress, replace);
  await dropRaw(id);
  onProgress({ phase: 'done', ratio: 1 });
  return status;
}

/** Import manuel depuis un fichier JSON Bolls choisi sur l'appareil (solution de repli). */
export async function importFromFile(file, onProgress = () => {}) {
  const data = JSON.parse(await file.text());
  const parsed = parseBolls(data);
  const tr = (parsed.translation || '').toUpperCase();
  const id = VERSIONS[tr] ? tr : /segond|lsg/i.test(file.name) ? 'FRLSG' : /semeur|bds/i.test(file.name) ? 'BDS' : null;
  if (!id) throw new Error('Version non reconnue : le fichier doit être FRLSG ou BDS.');
  return { id, status: await storeParsed(id, parsed, onProgress) };
}

export async function deleteVersion(id) {
  await db.clearVersion(id);
  await db.del('meta', `version:${id}`);
}

let renumbering = null;

/**
 * Retélécharge les versions installées avec une ancienne numérotation (connexion nécessaire).
 * Un seul passage à la fois ; en cas d'échec, nouvel essai au prochain appel.
 * @returns {Promise<string[]>} identifiants des versions réalignées
 */
export function renumberOutdated() {
  renumbering ||= (async () => {
    const done = [];
    for (const id of Object.keys(VERSIONS)) {
      if (!(await needsRenumbering(id))) continue;
      try {
        await importVersion(id, () => {}, true);
        done.push(id);
      } catch {
        /* hors ligne ou serveur indisponible */
      }
    }
    return done;
  })().finally(() => (renumbering = null));
  return renumbering;
}
