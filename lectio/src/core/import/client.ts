// Côté interface : envoie un fichier au Worker d'extraction et attend le résultat.

import type { BuiltDocument, DocFormat } from '../model';
import { ImportError } from './errors';
import type { ExtractRequest, ExtractResponse } from './protocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (d: BuiltDocument) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/extract.worker.ts', import.meta.url), {
      type: 'module',
      name: 'extraction',
    });
    worker.onmessage = (event: MessageEvent<ExtractResponse>) => {
      const res = event.data;
      const entry = pending.get(res.id);
      if (!entry) return;
      pending.delete(res.id);
      if (res.ok) entry.resolve(res.doc);
      else {
        const err = new ImportError(res.code);
        err.message = res.message;
        entry.reject(err);
      }
    };
    worker.onerror = () => {
      for (const entry of pending.values()) entry.reject(new ImportError('unknown', 'worker'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export async function extractInWorker(
  buffer: ArrayBuffer,
  format: DocFormat,
  fileName: string,
): Promise<BuiltDocument> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<BuiltDocument>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // Copie : le buffer d'origine reste disponible pour l'enregistrement de l'original.
    const request: ExtractRequest = { id, buffer: buffer.slice(0), format, fileName };
    w.postMessage(request, [request.buffer]);
  });
}
