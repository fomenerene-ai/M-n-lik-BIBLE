// Extracteur texte brut : paragraphes séparés par des lignes vides,
// sinon une ligne = un paragraphe.

import type { Extraction, RawBlock } from '../model';
import { decodeText } from './decode';
import { joinHyphenatedLines, normalizeText } from '../text/normalize';

const LIST_ITEM = /^\s*(?:[-*•\u2013]|\d{1,3}[.)])\s+/u;

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || /[.,;:!?]$/.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  return letters.length >= 3 && letters === letters.toUpperCase() && /\p{Lu}/u.test(letters);
}

export function textToBlocks(text: string): RawBlock[] {
  const clean = joinHyphenatedLines(normalizeText(text));
  const hasBlankLines = /\n[ ]*\n/.test(clean);
  const chunks = hasBlankLines ? clean.split(/\n[ ]*\n+/) : clean.split('\n');
  const blocks: RawBlock[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (lines.length === 0) continue;
    // Une liste à puces dans un même paragraphe : un bloc par puce.
    if (lines.length > 1 && lines.every((l) => LIST_ITEM.test(l))) {
      for (const l of lines) blocks.push({ kind: 'list-item', text: l.replace(LIST_ITEM, '') });
      continue;
    }
    const joined = lines.join(' ');
    if (lines.length === 1 && isHeadingLine(joined)) {
      blocks.push({ kind: 'heading', level: 1, text: joined });
    } else if (LIST_ITEM.test(joined)) {
      blocks.push({ kind: 'list-item', text: joined.replace(LIST_ITEM, '') });
    } else {
      blocks.push({ kind: 'paragraph', text: joined });
    }
  }
  return blocks;
}

export function extractTxt(buffer: ArrayBuffer): Extraction {
  return { blocks: textToBlocks(decodeText(buffer)) };
}
