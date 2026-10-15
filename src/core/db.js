// Petit wrapper IndexedDB basé sur des promesses.
//
// Magasins :
//  chapters   textes bibliques, un enregistrement par chapitre : {v, b, c, verses:[{n, t}]}
//  meta       état de l'import, rapports : {key, ...}
//  highlights {id, b, c, vs, ve, color, date}
//  notes      {id, b, c, vs, ve, text, date}
//  bookmarks  {id, b, c, v|null, date}
//  settings   {key, value}
//  queue      file de projection : {id, pos, b, c, vs, ve}

const NAME = 'menelik-bible';
const VERSION = 1;

export const USER_STORES = ['highlights', 'notes', 'bookmarks', 'settings', 'queue'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('chapters')) {
        db.createObjectStore('chapters', { keyPath: ['v', 'b', 'c'] });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      for (const s of ['highlights', 'notes', 'bookmarks']) {
        if (!db.objectStoreNames.contains(s)) {
          const st = db.createObjectStore(s, { keyPath: 'id' });
          st.createIndex('bc', ['b', 'c']);
        }
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de données bloquée par un autre onglet.'));
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Transaction annulée'));
  });
}

export async function get(store, key) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function getByIndex(store, index, key) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(key));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return done(tx);
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return done(tx);
}

/** Écritures groupées dans une seule transaction. */
export async function batch(store, { put: puts = [], remove = [] }) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const st = tx.objectStore(store);
  for (const k of remove) st.delete(k);
  for (const v of puts) st.put(v);
  return done(tx);
}

/** Remplace le contenu de plusieurs magasins en une transaction (restauration de sauvegarde). */
export async function replaceAll(contents) {
  const db = await openDB();
  const stores = Object.keys(contents);
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) {
    const st = tx.objectStore(s);
    st.clear();
    for (const v of contents[s]) st.put(v);
  }
  return done(tx);
}

export async function count(store) {
  const db = await openDB();
  return wrap(db.transaction(store).objectStore(store).count());
}

/** Supprime tous les chapitres d'une version. */
export async function clearVersion(version) {
  const db = await openDB();
  const tx = db.transaction('chapters', 'readwrite');
  const range = IDBKeyRange.bound([version, 0, 0], [version, Infinity, Infinity]);
  tx.objectStore('chapters').delete(range);
  return done(tx);
}

/** Clés de chapitres déjà présentes pour une version (pour la reprise d'import). */
export async function chapterKeys(version) {
  const db = await openDB();
  const range = IDBKeyRange.bound([version, 0, 0], [version, Infinity, Infinity]);
  return wrap(db.transaction('chapters').objectStore('chapters').getAllKeys(range));
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
