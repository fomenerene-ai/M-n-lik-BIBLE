/**
 * Small promise wrapper around IndexedDB, with versioned migrations.
 * Nothing touches indexedDB at import time.
 */
import { DB_NAME } from '../config.js';

/**
 * Schema migrations. MIGRATIONS[i] upgrades the database from version i to i + 1.
 * Never edit a shipped step: append a new one.
 */
const MIGRATIONS = [
  (db) => {
    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('profile', { keyPath: 'id' });
    db.createObjectStore('minutes', { keyPath: 'date' });
    db.createObjectStore('sessions', { keyPath: 'date' });
    const cards = db.createObjectStore('cards', { keyPath: 'id' });
    cards.createIndex('due', 'due');
    cards.createIndex('frontKey', 'frontKey');
    const reports = db.createObjectStore('reports', { keyPath: 'id' });
    reports.createIndex('date', 'date');
    const content = db.createObjectStore('contentCache', { keyPath: 'id' });
    content.createIndex('kind', 'kind');
    db.createObjectStore('audioLibrary', { keyPath: 'id' });
    db.createObjectStore('audioBlobs', { keyPath: 'id' });
    const attempts = db.createObjectStore('shadowAttempts', { keyPath: 'id', autoIncrement: true });
    attempts.createIndex('tier', 'tier');
  },
];

export const DB_VERSION = MIGRATIONS.length;

let dbPromise = null;

/** Opens (and upgrades) the database once. */
export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(storageError('This browser has no IndexedDB storage.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](db, req.transaction);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(storageError(req.error ? req.error.message : 'Could not open storage.'));
    req.onblocked = () => reject(storageError('Storage is busy: close other tabs of this app and reload.'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function storageError(message) {
  const e = new Error(message);
  e.kind = 'storage';
  return e;
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/**
 * Runs fn inside a transaction and resolves when the transaction completes.
 * @param {string|string[]} stores
 * @param {'readonly'|'readwrite'} mode
 * @param {(tx: IDBTransaction) => any} fn may return a value or a promise of one
 */
export async function withTx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(tx)).then((r) => { result = r; }, (e) => { try { tx.abort(); } catch { /* already done */ } reject(e); });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/** Gets one record. */
export async function get(store, key) {
  return withTx(store, 'readonly', (tx) => wrap(tx.objectStore(store).get(key)));
}

/** Gets all records of a store (optionally through an index and key range). */
export async function getAll(store, index, range) {
  return withTx(store, 'readonly', (tx) => {
    const s = tx.objectStore(store);
    return wrap(index ? s.index(index).getAll(range) : s.getAll(range));
  });
}

/** Puts one record; resolves its key. */
export async function put(store, value) {
  return withTx(store, 'readwrite', (tx) => wrap(tx.objectStore(store).put(value)));
}

/** Puts many records in one transaction. */
export async function putMany(store, values) {
  if (!values.length) return;
  return withTx(store, 'readwrite', (tx) => {
    const s = tx.objectStore(store);
    for (const v of values) s.put(v);
  });
}

/** Deletes one record. */
export async function del(store, key) {
  return withTx(store, 'readwrite', (tx) => wrap(tx.objectStore(store).delete(key)));
}

/** Clears stores. */
export async function clear(stores) {
  const list = Array.isArray(stores) ? stores : [stores];
  return withTx(list, 'readwrite', (tx) => { for (const s of list) tx.objectStore(s).clear(); });
}

/** Counts records. */
export async function count(store, index, range) {
  return withTx(store, 'readonly', (tx) => {
    const s = tx.objectStore(store);
    return wrap(index ? s.index(index).count(range) : s.count(range));
  });
}

/** Asks the browser for persistent storage, once. Resolves true when granted. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* not supported */ }
  return false;
}

/** All store names, for reset. */
export const ALL_STORES = ['settings', 'profile', 'minutes', 'sessions', 'cards', 'reports', 'contentCache', 'audioLibrary', 'audioBlobs', 'shadowAttempts'];
