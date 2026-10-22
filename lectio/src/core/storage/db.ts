// Base locale IndexedDB via Dexie. Le schéma est versionné : toute évolution
// passe par un nouveau `this.version(n)` pour migrer les données existantes.

import Dexie, { type EntityTable } from 'dexie';
import type { Block, DocMeta } from '../model';

export type DocContent = { docId: string; blocks: Block[] };
export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  createdAt: number;
};
/** Repli quand l'OPFS est indisponible : l'original est gardé en IndexedDB. */
export type StoredFile = { id: string; data: ArrayBuffer; type: string };
export type Setting = { key: string; value: unknown };

export class LectioDB extends Dexie {
  docs!: EntityTable<DocMeta, 'id'>;
  contents!: EntityTable<DocContent, 'docId'>;
  folders!: EntityTable<Folder, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'lectio') {
    super(name);
    this.version(1).stores({
      docs: 'id, hash, folderId, addedAt, openedAt, deletedAt, *tags',
      contents: 'docId',
      folders: 'id, parentId',
      files: 'id',
      settings: 'key',
    });
  }
}

export const db = new LectioDB();
