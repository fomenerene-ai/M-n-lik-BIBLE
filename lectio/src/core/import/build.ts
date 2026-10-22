// Construit le modèle commun à partir des blocs bruts d'un extracteur :
// normalisation, langue par bloc, découpage en phrases, table des matières.

import type { Block, BuiltDocument, Extraction, Lang, TocEntry } from '../model';
import { collapseSpaces, normalizeText } from '../text/normalize';
import { detectLang } from '../text/lang';
import { segmentSentences } from '../text/segment';

export function buildDocument(extraction: Extraction, fallbackTitle: string): BuiltDocument {
  const cleaned = extraction.blocks
    .map((b) => ({ ...b, text: collapseSpaces(normalizeText(b.text)) }))
    .filter((b) => b.text.length > 0);

  // 1. Langue des blocs assez longs pour être fiables.
  const detected = cleaned.map((b) => (b.text.split(' ').length >= 4 ? detectLang(b.text) : null));
  const weight: Record<Lang, number> = { fr: 0, en: 0 };
  cleaned.forEach((b, i) => {
    const l = detected[i];
    if (l) weight[l] += b.text.length;
  });
  const langMain: Lang = weight.en > weight.fr ? 'en' : 'fr';

  // 2. Les blocs courts (titres, puces) héritent du bloc suivant, sinon du précédent.
  const langs: Lang[] = detected.map((l, i) => {
    if (l) return l;
    for (let j = i + 1; j < detected.length && j < i + 3; j++) {
      const next = detected[j];
      if (next) return next;
    }
    for (let j = i - 1; j >= 0; j--) {
      const prev = detected[j];
      if (prev) return prev;
    }
    return langMain;
  });

  const blocks: Block[] = cleaned.map((b, i) => {
    const id = `b${i}`;
    const lang = langs[i] ?? langMain;
    const block: Block = { id, kind: b.kind, text: b.text, lang, sentences: [] };
    if (b.level !== undefined) block.level = b.level;
    if (b.page !== undefined) block.page = b.page;
    if (b.sourceRects) block.sourceRects = b.sourceRects;
    block.sentences = segmentSentences(b.text, lang, id);
    return block;
  });

  const toc: TocEntry[] = blocks
    .filter((b) => b.kind === 'heading')
    .map((b) => ({ title: b.text, blockId: b.id, level: b.level ?? 1 }));

  const firstHeading = blocks.find((b) => b.kind === 'heading' && (b.level ?? 1) <= 2);
  const title =
    extraction.title?.trim() || firstHeading?.text.slice(0, 120) || fallbackTitle || 'Sans titre';

  const built: BuiltDocument = {
    title,
    pages: extraction.pages ?? 1,
    chars: blocks.reduce((n, b) => n + b.text.length, 0),
    langMain,
    ocr: extraction.ocr ?? false,
    toc,
    blocks,
  };
  if (extraction.author?.trim()) built.author = extraction.author.trim();
  return built;
}
