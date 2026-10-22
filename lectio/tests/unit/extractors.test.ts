import { describe, expect, it } from 'vitest';
import { extractDocument } from '../../src/core/import/extract';
import { htmlToBlocks } from '../../src/core/import/html';
import { markdownToBlocks } from '../../src/core/import/markdown';
import { textToBlocks } from '../../src/core/import/txt';
import { detectFormat } from '../../src/core/import/detect';
import { ImportError } from '../../src/core/import/errors';
import { fixture } from './helpers';

describe('TXT', () => {
  it('reconstitue paragraphes, titres et listes', () => {
    const blocks = textToBlocks('TITRE\n\nUne ligne\ncoupée.\n\n- un\n- deux');
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'TITRE' },
      { kind: 'paragraph', text: 'Une ligne coupée.' },
      { kind: 'list-item', text: 'un' },
      { kind: 'list-item', text: 'deux' },
    ]);
  });

  it('lit le jeu d’essai et recolle les coupures', async () => {
    const doc = await extractDocument(fixture('notes-fr.txt'), 'txt', 'notes-fr.txt');
    expect(doc.blocks[0]).toMatchObject({ kind: 'heading', text: 'CHAPITRE PREMIER' });
    expect(doc.blocks[1]!.text).toContain('plusieurs paragraphes');
    expect(doc.langMain).toBe('fr');
  });

  it('accepte un fichier Windows-1252', async () => {
    const latin1 = new Uint8Array([0x45, 0x74, 0xe9, 0x20, 0x63, 0x68, 0x61, 0x75, 0x64, 0x2e]);
    const doc = await extractDocument(latin1.buffer, 'txt', 'vieux.txt');
    expect(doc.blocks[0]!.text).toBe('Eté chaud.');
  });
});

describe('Markdown', () => {
  it('gère titres, listes, citations, front matter et code', async () => {
    const doc = await extractDocument(fixture('notes-en.md'), 'md', 'notes-en.md');
    expect(doc.title).toBe('Reading notes');
    const kinds = doc.blocks.map((b) => [b.kind, b.text]);
    expect(kinds).toEqual([
      ['heading', 'Reading notes'],
      ['paragraph', 'This is important: read the guide first. It continues on a second line.'],
      ['heading', 'Steps'],
      ['list-item', 'Open the file.'],
      ['list-item', 'Press play.'],
      ['quote', 'A quoted sentence. Another one.'],
      ['paragraph', 'Final paragraph, e.g. with Mr. Brown.'],
    ]);
    expect(doc.langMain).toBe('en');
    expect(doc.blocks[5]!.sentences).toHaveLength(2);
  });

  it('gère les titres soulignés', () => {
    expect(markdownToBlocks('Titre\n=====\n\nTexte').blocks[0]).toEqual({
      kind: 'heading',
      level: 1,
      text: 'Titre',
    });
  });
});

describe('HTML', () => {
  it('produit des blocs sans DOM', () => {
    const { title, blocks } = htmlToBlocks(
      '<html><head><title>Mon &amp; titre</title><style>p{}</style></head><body>' +
        '<h2>Partie</h2><p>Un <b>texte</b>&nbsp;ici.<br>Suite.</p><ul><li>Point</li></ul>' +
        '<blockquote><p>Citation</p></blockquote><script>alert(1)</script></body></html>',
    );
    expect(title).toBe('Mon & titre');
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: 'Partie' },
      { kind: 'paragraph', text: 'Un texte ici. Suite.' },
      { kind: 'list-item', text: 'Point' },
      { kind: 'quote', text: 'Citation' },
    ]);
  });
});

describe('DOCX', () => {
  it('extrait titres, listes, métadonnées et langues', async () => {
    const doc = await extractDocument(fixture('cours-fr-en.docx'), 'docx', 'cours.docx');
    expect(doc.title).toBe('Cours de comptabilité');
    expect(doc.author).toBe('Ménélik');
    expect(doc.toc.map((t) => [t.title, t.level])).toEqual([
      ['Introduction à la comptabilité', 1],
      ['Les principes', 2],
      ['International standards', 2],
      ['Conclusion', 1],
    ]);
    const english = doc.blocks.find((b) => b.text.startsWith('The IFRS'));
    expect(english?.lang).toBe('en');
    expect(english?.sentences.map((s) => s.text)).toHaveLength(3);
    expect(doc.blocks.find((b) => b.text.startsWith('La comptabilité'))?.lang).toBe('fr');
    expect(doc.blocks.filter((b) => b.kind === 'list-item')).toHaveLength(2);
    expect(doc.langMain).toBe('fr');
  });

  it('refuse un fichier abîmé avec un message clair', async () => {
    const junk = new TextEncoder().encode('pas un docx').buffer as ArrayBuffer;
    await expect(extractDocument(junk, 'docx', 'x.docx')).rejects.toMatchObject({
      code: 'corrupt',
    });
  });
});

describe('détection et erreurs', () => {
  it('détecte le format par signature puis extension', () => {
    expect(detectFormat('x.bin', '', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('pdf');
    expect(detectFormat('Cours.DOCX', '', new Uint8Array([0x50, 0x4b]))).toBe('docx');
    expect(detectFormat('inconnu', 'text/markdown', new Uint8Array())).toBe('md');
    expect(detectFormat('a.xyz', '', new Uint8Array())).toBeNull();
  });

  it('signale un document vide', async () => {
    const empty = new TextEncoder().encode('   \n\n ').buffer as ArrayBuffer;
    await expect(extractDocument(empty, 'txt', 'vide.txt')).rejects.toBeInstanceOf(ImportError);
  });
});
