// Extracteur Markdown maison : titres, listes, citations, paragraphes.
// Les blocs de code sont ignorés (illisibles à voix haute).

import type { Extraction, RawBlock } from '../model';
import { decodeText } from './decode';
import { normalizeText } from '../text/normalize';

/** Retire la syntaxe en ligne : liens, images, emphase, code, balises HTML. */
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\p{L}\d])[*_](?!\s)(.+?)(?<!\s)[*_](?=$|[^\p{L}\d])/gu, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>|])/g, '$1');
}

export function markdownToBlocks(source: string): { title?: string; blocks: RawBlock[] } {
  const lines = normalizeText(source).split('\n');
  const blocks: RawBlock[] = [];
  let para: string[] = [];
  let paraKind: RawBlock['kind'] = 'paragraph';
  let inFence = false;
  let frontMatter = lines[0]?.trim() === '---';
  let title: string | undefined;

  const flush = () => {
    const text = stripInlineMarkdown(para.join(' ')).trim();
    if (text) blocks.push({ kind: paraKind, text });
    para = [];
    paraKind = 'paragraph';
  };

  lines.forEach((line, i) => {
    if (frontMatter) {
      if (i > 0 && line.trim() === '---') frontMatter = false;
      const m = /^title:\s*["']?(.+?)["']?\s*$/.exec(line);
      if (m?.[1]) title = m[1];
      return;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const trimmed = line.trim();
    if (!trimmed) return flush();
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) return flush();

    const atx = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (atx) {
      flush();
      blocks.push({ kind: 'heading', level: atx[1]!.length, text: stripInlineMarkdown(atx[2]!) });
      return;
    }
    if (para.length > 0 && paraKind === 'paragraph' && /^(=+|-+)$/.test(trimmed)) {
      const text = stripInlineMarkdown(para.join(' '));
      para = [];
      blocks.push({ kind: 'heading', level: trimmed.startsWith('=') ? 1 : 2, text });
      return;
    }
    const item = /^\s*(?:[-*+]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line);
    if (item) {
      flush();
      para = [item[1]!];
      paraKind = 'list-item';
      return;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      if (paraKind !== 'quote') flush();
      paraKind = 'quote';
      para.push(quote[1]!);
      return;
    }
    if (/^\|.*\|$/.test(trimmed)) {
      flush();
      if (/^\|[\s:|-]+\|$/.test(trimmed)) return;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length)
        blocks.push({ kind: 'paragraph', text: stripInlineMarkdown(cells.join(', ')) });
      return;
    }
    if (paraKind === 'quote') flush();
    para.push(trimmed);
  });
  flush();
  return title ? { title, blocks } : { blocks };
}

export function extractMarkdown(buffer: ArrayBuffer): Extraction {
  return markdownToBlocks(decodeText(buffer));
}
