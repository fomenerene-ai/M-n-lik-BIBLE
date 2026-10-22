// Extracteur Word (.docx) : mammoth convertit les styles (Titre 1, Citation…) en HTML
// sémantique, puis htmlToBlocks produit les blocs. Titre et auteur viennent de docProps/core.xml.

import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { Extraction } from '../model';
import { ImportError } from './errors';
import { decodeEntities } from './decode';
import { htmlToBlocks } from './html';

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Titre'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Sous-titre'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Citation'] => blockquote > p:fresh",
  "p[style-name='Caption'] => figcaption:fresh",
  "p[style-name='Légende'] => figcaption:fresh",
];

function readCoreTag(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  const value = m?.[1] ? decodeEntities(m[1]).trim() : '';
  return value || undefined;
}

export async function extractDocx(buffer: ArrayBuffer): Promise<Extraction> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Un .docx chiffré par Word n'est pas un ZIP mais un conteneur OLE.
    const head = new Uint8Array(buffer.slice(0, 4));
    if (head[0] === 0xd0 && head[1] === 0xcf) throw new ImportError('password');
    throw new ImportError('corrupt');
  }
  if (!zip.file('word/document.xml')) throw new ImportError('corrupt', 'word/document.xml absent');

  const core = await zip.file('docProps/core.xml')?.async('string');
  // mammoth lit `arrayBuffer` dans le navigateur et `buffer` sous Node (tests).
  const input = { arrayBuffer: buffer, buffer } as unknown as { arrayBuffer: ArrayBuffer };
  const result = await mammoth.convertToHtml(input, {
    styleMap: STYLE_MAP,
    convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
  });
  const { blocks } = htmlToBlocks(result.value);

  const extraction: Extraction = { blocks };
  const title = core ? readCoreTag(core, 'dc:title') : undefined;
  const author = core ? readCoreTag(core, 'dc:creator') : undefined;
  if (title) extraction.title = title;
  if (author) extraction.author = author;
  return extraction;
}
