// Point d'entrée unique de l'extraction : choisit l'extracteur selon le format
// et produit le modèle commun. Appelé dans le Worker (ou en direct pour les tests).

import type { BuiltDocument, DocFormat, Extraction } from '../model';
import { buildDocument } from './build';
import { extractDocx } from './docx';
import { ImportError } from './errors';
import { extractHtml } from './html';
import { extractMarkdown } from './markdown';
import { extractTxt } from './txt';

export async function extractDocument(
  buffer: ArrayBuffer,
  format: DocFormat,
  fileName: string,
): Promise<BuiltDocument> {
  let extraction: Extraction;
  switch (format) {
    case 'txt':
      extraction = extractTxt(buffer);
      break;
    case 'md':
      extraction = extractMarkdown(buffer);
      break;
    case 'html':
      extraction = extractHtml(buffer);
      break;
    case 'docx':
      extraction = await extractDocx(buffer);
      break;
    default:
      throw new ImportError('unsupported', `${format} : disponible dans une prochaine phase`);
  }
  const fallbackTitle = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const doc = buildDocument(extraction, fallbackTitle);
  if (doc.blocks.length === 0) throw new ImportError('empty');
  return doc;
}
