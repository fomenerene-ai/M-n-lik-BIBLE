// Messages échangés entre l'interface et le Worker d'extraction.

import type { BuiltDocument, DocFormat } from '../model';
import type { ImportErrorCode } from './errors';

export type ExtractRequest = {
  id: number;
  buffer: ArrayBuffer;
  format: DocFormat;
  fileName: string;
};

export type ExtractResponse =
  | { id: number; ok: true; doc: BuiltDocument }
  | { id: number; ok: false; code: ImportErrorCode; message: string };
