// Fichiers originaux : OPFS (Origin Private File System) en priorité, rapide et
// sans limite de taille par entrée ; repli IndexedDB si l'OPFS est absent ou refuse l'écriture.

import { db } from './db';

const DIR = 'originals';

async function originalsDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR, { create: true });
  } catch {
    return null;
  }
}

export async function saveOriginal(
  id: string,
  buffer: ArrayBuffer,
  type: string,
): Promise<'opfs' | 'idb'> {
  const dir = await originalsDir();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(id, { create: true });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return 'opfs';
    } catch {
      // createWritable absent (Safari) ou quota : on passe au repli.
    }
  }
  await db.files.put({ id, data: buffer, type });
  return 'idb';
}

export async function readOriginal(id: string, type = ''): Promise<Blob | null> {
  const dir = await originalsDir();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(id);
      const file = await handle.getFile();
      return type ? new Blob([await file.arrayBuffer()], { type }) : file;
    } catch {
      // absent de l'OPFS : peut-être dans IndexedDB
    }
  }
  const stored = await db.files.get(id);
  return stored ? new Blob([stored.data], { type: stored.type || type }) : null;
}

export async function deleteOriginal(id: string): Promise<void> {
  const dir = await originalsDir();
  if (dir) {
    try {
      await dir.removeEntry(id);
    } catch {
      // déjà absent
    }
  }
  await db.files.delete(id);
}
