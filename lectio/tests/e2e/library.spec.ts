import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const docx = fileURLToPath(new URL('../fixtures/cours-fr-en.docx', import.meta.url));

test('affiche le rail et un classeur vide', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const label of ['Classeur', 'Lecture', 'Recherche', 'Annotations', 'Réglages']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Classeur' })).toBeVisible();
  await expect(page.getByText('Ton classeur est vide')).toBeVisible();
});

test('importe un DOCX qui survit au rechargement', async ({ page }) => {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer' }).click();
  await (await chooser).setFiles(docx);

  const card = page.getByRole('button', { name: /^Cours de comptabilité/ });
  await expect(card).toBeVisible();
  await expect(page.getByText('Document importé.')).toBeVisible();

  await page.reload();
  await expect(card).toBeVisible();

  // Réimporter le même fichier propose d'ouvrir l'existant.
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer' }).click();
  await (await chooser2).setFiles(docx);
  await expect(page.getByRole('heading', { name: 'Document déjà présent' })).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir l’existant' }).click();

  await expect(page.getByRole('heading', { name: 'Introduction à la comptabilité' })).toBeVisible();
  await expect(page.getByText('The IFRS framework is used by listed companies.')).toHaveAttribute(
    'data-sid',
    /^b\d+\.s0$/,
  );
});
