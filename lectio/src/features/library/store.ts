// État du classeur : liste des documents, imports en cours, doublons à trancher.

import { create } from 'zustand';
import type { DocMeta } from '../../core/model';
import { importFile, listDocs, trashDoc } from '../../core/storage/documents';
import { extractInWorker } from '../../core/import/client';
import { userMessage } from '../../core/import/errors';
import { toast } from '../../ui/toast';

export type PendingDuplicate = { file: File; existing: DocMeta };

type LibraryState = {
  docs: DocMeta[];
  loaded: boolean;
  importing: string[];
  duplicates: PendingDuplicate[];
  load: () => Promise<void>;
  importFiles: (files: Iterable<File>) => Promise<void>;
  resolveDuplicate: (choice: 'open' | 'import' | 'cancel') => Promise<DocMeta | null>;
  trash: (id: string) => Promise<void>;
};

export const useLibrary = create<LibraryState>((set, get) => ({
  docs: [],
  loaded: false,
  importing: [],
  duplicates: [],

  load: async () => {
    set({ docs: await listDocs(), loaded: true });
  },

  importFiles: async (files) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    set({ importing: [...get().importing, ...list.map((f) => f.name)] });
    let imported = 0;
    // Un fichier à la fois : mémoire maîtrisée sur tablette.
    for (const file of list) {
      try {
        const outcome = await importFile(file, extractInWorker);
        if (outcome.status === 'duplicate') {
          set({ duplicates: [...get().duplicates, { file, existing: outcome.existing }] });
        } else {
          imported += 1;
          await get().load();
        }
      } catch (error) {
        toast.error(`${file.name} : ${userMessage(error)}`);
      } finally {
        const importing = [...get().importing];
        importing.splice(importing.indexOf(file.name), 1);
        set({ importing });
      }
    }
    if (imported > 0) {
      toast.success(imported === 1 ? 'Document importé.' : `${imported} documents importés.`);
    }
  },

  resolveDuplicate: async (choice) => {
    const [current, ...rest] = get().duplicates;
    set({ duplicates: rest });
    if (!current) return null;
    if (choice === 'open') return current.existing;
    if (choice === 'import') {
      try {
        const outcome = await importFile(current.file, extractInWorker, { force: true });
        await get().load();
        if (outcome.status === 'imported') {
          toast.success('Document importé.');
          return null;
        }
      } catch (error) {
        toast.error(`${current.file.name} : ${userMessage(error)}`);
      }
    }
    return null;
  },

  trash: async (id) => {
    await trashDoc(id);
    await get().load();
    toast.info('Document placé dans la corbeille.');
  },
}));
