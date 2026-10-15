/**
 * Imported audio library (tier 3): metadata in `audioLibrary`, blobs in `audioBlobs`.
 */
import { get, getAll, put, del, withTx } from '../state/db.js';

/** All imported items (metadata only, no audio data). */
export function listLibrary() {
  return getAll('audioLibrary');
}

/** One item's metadata. */
export function getLibraryItem(id) {
  return get('audioLibrary', id);
}

/** The audio blob of an item. */
export async function getBlob(id) {
  const r = await get('audioBlobs', id);
  return r ? r.blob : null;
}

/**
 * Saves an item and its blob in one transaction.
 * @param {object} meta {id, title, fileName, durationSec, transcript, segments, createdAt}
 * @param {Blob} blob
 */
export function saveLibraryItem(meta, blob) {
  return withTx(['audioLibrary', 'audioBlobs'], 'readwrite', (tx) => {
    tx.objectStore('audioLibrary').put(meta);
    tx.objectStore('audioBlobs').put({ id: meta.id, blob });
  });
}

/** Updates metadata only. */
export function updateLibraryItem(meta) {
  return put('audioLibrary', meta);
}

/** Deletes an item and its blob. */
export async function deleteLibraryItem(id) {
  await del('audioLibrary', id);
  await del('audioBlobs', id);
}
