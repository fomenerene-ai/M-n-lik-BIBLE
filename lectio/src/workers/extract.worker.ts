// Worker d'extraction : tout le travail lourd (décompression, analyse, découpage)
// se fait ici pour que l'interface ne fige jamais.

import { extractDocument } from '../core/import/extract';
import { ImportError } from '../core/import/errors';
import type { ExtractRequest, ExtractResponse } from '../core/import/protocol';

self.onmessage = async (event: MessageEvent<ExtractRequest>) => {
  const { id, buffer, format, fileName } = event.data;
  let response: ExtractResponse;
  try {
    const doc = await extractDocument(buffer, format, fileName);
    response = { id, ok: true, doc };
  } catch (error) {
    const code = error instanceof ImportError ? error.code : 'unknown';
    const message = error instanceof Error ? error.message : String(error);
    response = { id, ok: false, code, message };
  }
  self.postMessage(response);
};
