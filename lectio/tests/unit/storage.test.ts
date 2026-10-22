import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/core/storage/db';
import {
  getContent,
  importFile,
  listDocs,
  purgeDoc,
  restoreDoc,
  trashDoc,
} from '../../src/core/storage/documents';
import { readOriginal } from '../../src/core/storage/files';
import { extractDocument } from '../../src/core/import/extract';
import { fixtureFile } from './helpers';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('import et classeur', () => {
  it('importe un DOCX : métadonnées, texte et original conservés', async () => {
    const outcome = await importFile(fixtureFile('cours-fr-en.docx'), extractDocument);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;
    const { doc } = outcome;
    expect(doc.format).toBe('docx');
    expect(doc.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.position).toEqual({ blockId: 'b0', sentenceId: 'b0.s0' });

    const docs = await listDocs();
    expect(docs.map((d) => d.id)).toEqual([doc.id]);
    expect((await getContent(doc.id))?.blocks.length).toBeGreaterThan(5);
    const original = await readOriginal(doc.id);
    expect(original?.size).toBe(doc.fileSize);
  });

  it('détecte les doublons par empreinte, sauf si on force', async () => {
    await importFile(fixtureFile('notes-fr.txt'), extractDocument);
    const second = await importFile(fixtureFile('notes-fr.txt'), extractDocument);
    expect(second.status).toBe('duplicate');
    const forced = await importFile(fixtureFile('notes-fr.txt'), extractDocument, { force: true });
    expect(forced.status).toBe('imported');
    expect(await listDocs()).toHaveLength(2);
  });

  it('refuse un format inconnu', async () => {
    const file = new File(['abc'], 'x.xyz');
    await expect(importFile(file, extractDocument)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('corbeille réversible puis suppression définitive', async () => {
    const outcome = await importFile(fixtureFile('notes-en.md'), extractDocument);
    if (outcome.status !== 'imported') throw new Error('import attendu');
    const id = outcome.doc.id;
    await trashDoc(id);
    expect(await listDocs()).toHaveLength(0);
    await restoreDoc(id);
    expect(await listDocs()).toHaveLength(1);
    await purgeDoc(id);
    expect(await db.docs.get(id)).toBeUndefined();
    expect(await readOriginal(id)).toBeNull();
  });
});
