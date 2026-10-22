// Conversion HTML → blocs, sans DOM : fonctionne dans un Web Worker (où DOMParser
// n'existe pas). Sert au DOCX (via mammoth) et servira à l'ePub et au HTML.

import type { BlockKind, Extraction, RawBlock } from '../model';
import { decodeEntities, decodeText } from './decode';

const SKIP = new Set(['script', 'style', 'head', 'noscript', 'template', 'svg', 'math', 'button']);
const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'aside',
  'li',
  'ul',
  'ol',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'figure',
  'figcaption',
  'caption',
  'table',
  'tr',
  'td',
  'th',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'body',
  'nav',
  'address',
  'center',
]);
const VOID = new Set([
  'br',
  'hr',
  'img',
  'meta',
  'link',
  'input',
  'col',
  'area',
  'base',
  'wbr',
  'source',
]);

type Frame = { tag: string };

function kindOf(stack: Frame[]): { kind: BlockKind; level?: number } {
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i]!.tag;
    const h = /^h([1-6])$/.exec(tag);
    if (h) return { kind: 'heading', level: Number(h[1]) };
    if (tag === 'li' || tag === 'dt' || tag === 'dd') return { kind: 'list-item' };
    if (tag === 'figcaption' || tag === 'caption') return { kind: 'caption' };
    if (tag === 'blockquote') return { kind: 'quote' };
  }
  return { kind: 'paragraph' };
}

export function htmlToBlocks(html: string): { title?: string; blocks: RawBlock[] } {
  const blocks: RawBlock[] = [];
  const stack: Frame[] = [];
  let buffer = '';
  let skipDepth = 0;
  let title: string | undefined;
  let inTitle = false;

  const flush = () => {
    const text = decodeEntities(buffer).replace(/\s+/g, ' ').trim();
    buffer = '';
    if (!text) return;
    const { kind, level } = kindOf(stack);
    blocks.push(level === undefined ? { kind, text } : { kind, level, text });
  };

  const re =
    /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<!(?:[^>]*)>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, cdata, closing, rawTag, attrs, text] = m;
    if (text !== undefined || cdata !== undefined) {
      const chunk = text ?? cdata ?? '';
      if (inTitle) title = (title ?? '') + chunk;
      else if (skipDepth === 0) buffer += chunk;
      continue;
    }
    if (!rawTag) continue;
    const tag = rawTag.toLowerCase().replace(/^.*:/, '');
    const selfClosing = /\/\s*$/.test(attrs ?? '') || VOID.has(tag);

    if (tag === 'title') {
      inTitle = !closing && !selfClosing;
      continue;
    }
    if (SKIP.has(tag)) {
      if (selfClosing) continue;
      skipDepth += closing ? -1 : 1;
      if (skipDepth < 0) skipDepth = 0;
      continue;
    }
    if (skipDepth > 0) continue;

    if (tag === 'br') {
      buffer += ' ';
      continue;
    }
    if (!BLOCK.has(tag)) {
      // Lien de note mammoth : <sup><a href="#footnote-1">[1]</a></sup> reste dans le texte.
      continue;
    }
    flush();
    if (selfClosing) continue;
    if (closing) {
      const idx = stack.map((f) => f.tag).lastIndexOf(tag);
      if (idx >= 0) stack.length = idx;
    } else {
      stack.push({ tag });
    }
  }
  flush();
  const cleanTitle = title ? decodeEntities(title).replace(/\s+/g, ' ').trim() : '';
  return cleanTitle ? { title: cleanTitle, blocks } : { blocks };
}

export function extractHtml(buffer: ArrayBuffer): Extraction {
  return htmlToBlocks(decodeText(buffer));
}
