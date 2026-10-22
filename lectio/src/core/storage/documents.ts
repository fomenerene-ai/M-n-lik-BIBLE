// Opérations sur les documents du classeur : import, lecture, suppression.

import type { BuiltDocument, DocFormat, DocMeta, DocPosition } from '../model';
import { db, type DocContent } from './db';
import { deleteOriginal, saveOriginal } from './files';
import { sha256Hex } from './hash';
import { detectFormat, SUPPORTED_NOW } from '../import/detect';
import { ImportError, isQuotaError } from '../import/errors';

const MAX_SIZE = 200 * 1024 * 1024;

export type Extractor = (
  buffer: ArrayBuffer,
  format: DocFormat,
  name: string,
) => Promise<BuiltDocument>;

export type ImportOutcome =
  { status: 'imported'; doc: DocMeta } | { status: 'duplicate'; existing: DocMeta };

export function newId(): string {
  return crypto.randomUUID();
}

export function createMeta(
  built: BuiltDocument,
  file: { name: string; size: number; type: string },
  format: DocFormat,
  hash: string,
  now = Date.now(),
): DocMeta {
  const first = built.blocks[0];
  const meta: DocMeta = {
    id: newId(),
    title: built.title,
    format,
    hash,
    folderId: null,
    tags: [],
    favorite: false,
    pages: built.pages,
    chars: built.chars,
    langMain: built.langMain,
    langMode: 'auto',
    ocr: built.ocr,
    toc: built.toc,
    position: { blockId: first?.id ?? 'b0', sentenceId: first?.sentences[0]?.id ?? 'b0.s0' },
    progress: 0,
    listenedSeconds: 0,
    addedAt: now,
    openedAt: 0,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
  if (built.author) meta.author = built.author;
  return meta;
}

/**
 * Importe un fichier : empreinte, détection de doublon, extraction, enregistrement.
 * `force` importe même si un document identique existe déjà.
 */
export async function importFile(
  file: File,
  extract: Extractor,
  options: { force?: boolean } = {},
): Promise<ImportOutcome> {
  if (file.size > MAX_SIZE) throw new ImportError('too-large');
  const buffer = await file.arrayBuffer();
  const format = detectFormat(file.name, file.type, new Uint8Array(buffer.slice(0, 8)));
  if (!format) throw new ImportError('unsupported');
  if (!SUPPORTED_NOW.has(format)) {
    throw new ImportError(
      'unsupported',
      `${format.toUpperCase()} arrive dans une prochaine version`,
    );
  }

  const hash = await sha256Hex(buffer);
  if (!options.force) {
    const existing = await findByHash(hash);
    if (existing) return { status: 'duplicate', existing };
  }

  const built = await extract(buffer, format, file.name);
  const meta = createMeta(built, file, format, hash);
  try {
    await saveOriginal(meta.id, buffer, file.type);
    await db.transaction('rw', db.docs, db.contents, async () => {
      await db.docs.add(meta);
      await db.contents.add({ docId: meta.id, blocks: built.blocks });
    });
  } catch (error) {
    await deleteOriginal(meta.id).catch(() => undefined);
    if (isQuotaError(error)) throw new ImportError('storage-full');
    throw error;
  }
  return { status: 'imported', doc: meta };
}

export async function findByHash(hash: string): Promise<DocMeta | undefined> {
  const matches = await db.docs.where('hash').equals(hash).toArray();
  return matches.find((d) => d.deletedAt === undefined);
}

/** Documents visibles (hors corbeille), du plus récent au plus ancien. */
export async function listDocs(): Promise<DocMeta[]> {
  const all = await db.docs.toArray();
  return all
    .filter((d) => d.deletedAt === undefined)
    .sort((a, b) => Math.max(b.openedAt, b.addedAt) - Math.max(a.openedAt, a.addedAt));
}

export function getDoc(id: string): Promise<DocMeta | undefined> {
  return db.docs.get(id);
}

export function getContent(id: string): Promise<DocContent | undefined> {
  return db.contents.get(id);
}

export async function markOpened(id: string): Promise<void> {
  await db.docs.update(id, { openedAt: Date.now() });
}

export async function savePosition(id: string, position: DocPosition, progress: number) {
  await db.docs.update(id, { position, progress });
}

/** Envoie à la corbeille (suppression réversible). */
export async function trashDoc(id: string): Promise<void> {
  await db.docs.update(id, { deletedAt: Date.now() });
}

export async function restoreDoc(id: string): Promise<void> {
  const doc = await db.docs.get(id);
  if (!doc) return;
  delete doc.deletedAt;
  await db.docs.put(doc);
}

/** Suppression définitive : métadonnées, texte et original. */
export async function purgeDoc(id: string): Promise<void> {
  await db.transaction('rw', db.docs, db.contents, async () => {
    await db.docs.delete(id);
    await db.contents.delete(id);
  });
  await deleteOriginal(id);
}
