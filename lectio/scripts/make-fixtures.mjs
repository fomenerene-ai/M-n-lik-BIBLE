// Génère les jeux d'essai de tests/fixtures. Relancer : npm run fixtures
// Les fichiers produits sont versionnés pour que les tests ne dépendent pas de ce script.

import { writeFile, mkdir } from 'node:fs/promises';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const dir = new URL('../tests/fixtures/', import.meta.url);
await mkdir(dir, { recursive: true });

const docx = new Document({
  title: 'Cours de comptabilité',
  creator: 'Ménélik',
  styles: { default: { document: { run: { font: 'Calibri' } } } },
  sections: [
    {
      children: [
        new Paragraph({ text: 'Introduction à la comptabilité', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun(
              'La comptabilité enregistre les opérations de l’entreprise. M. Dupont, p. ex., tient ses comptes selon le SYSCOHADA. ',
            ),
            new TextRun({ text: 'Le bilan', bold: true }),
            new TextRun(' résume la situation à une date donnée.'),
          ],
        }),
        new Paragraph({ text: 'Les principes', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Prudence et permanence des méthodes.', bullet: { level: 0 } }),
        new Paragraph({ text: 'Indépendance des exercices.', bullet: { level: 0 } }),
        new Paragraph({ text: 'International standards', heading: HeadingLevel.HEADING_2 }),
        new Paragraph(
          'The IFRS framework is used by listed companies. It was designed by the IASB, e.g. for consolidated statements. Dr. Smith wrote about it in 3.5 pages.',
        ),
        new Paragraph({ text: 'Conclusion', heading: HeadingLevel.HEADING_1 }),
        new Paragraph(
          'Une bonne comptabilité facilite les décisions. Elle est aussi une obligation légale.',
        ),
      ],
    },
  ],
});
await writeFile(new URL('cours-fr-en.docx', dir), await Packer.toBuffer(docx));

await writeFile(
  new URL('notes-fr.txt', dir),
  [
    'CHAPITRE PREMIER',
    '',
    'Le présent document sert d’essai. Il comporte plusieurs para-',
    'graphes et des lignes coupées au milieu.',
    '',
    'Mme Martin est arrivée à 10 h. Elle a lu le rapport de 2,5 pages.',
    '',
    '- premier point',
    '- second point',
    '',
  ].join('\n'),
);

await writeFile(
  new URL('notes-en.md', dir),
  [
    '---',
    'title: Reading notes',
    '---',
    '# Reading notes',
    '',
    'This is **important**: read the [guide](https://example.com) first.',
    'It continues on a second line.',
    '',
    '## Steps',
    '',
    '1. Open the file.',
    '2. Press *play*.',
    '',
    '> A quoted sentence. Another one.',
    '',
    '```js',
    'console.log("skipped");',
    '```',
    '',
    'Final paragraph, e.g. with Mr. Brown.',
    '',
  ].join('\n'),
);

console.log('Jeux d’essai générés dans tests/fixtures/');
