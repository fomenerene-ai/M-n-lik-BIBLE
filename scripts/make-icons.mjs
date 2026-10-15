// Génère les icônes PNG de l'application à partir d'un dessin SVG original.
// Usage : npm run icons (nécessite Playwright/Chromium, utilisé seulement en développement).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

// Livre ouvert couleur parchemin, croix cuivrée, sur fond ardoise.
function art(scale) {
  const t = (1 - scale) * 256;
  return `<g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M256 150c-52-34-118-44-196-36v258c78-8 144 2 196 36 52-34 118-44 196-36V114c-78-8-144 2-196 36z" fill="#f3e2bd" stroke="#d9b878" stroke-width="10" stroke-linejoin="round"/>
    <path d="M256 150v258" stroke="#b98a4a" stroke-width="10"/>
    <path d="M100 180c50-4 96 4 128 22M100 230c50-4 96 4 128 22M100 280c50-4 96 4 128 22M412 180c-50-4-96 4-128 22M412 230c-50-4-96 4-128 22M412 280c-50-4-96 4-128 22" stroke="#c9a46a" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M256 40v92M222 74h68" stroke="#e0a066" stroke-width="22" stroke-linecap="round"/>
  </g>`;
}

const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#454f50"/>${art(0.92)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#454f50"/>${art(0.68)}</svg>`;

fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon.svg', any);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg, size] of [
  ['icon-192.png', any, 192],
  ['icon-512.png', any, 512],
  ['icon-maskable-192.png', maskable, 192],
  ['icon-maskable-512.png', maskable, 512],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator('svg').screenshot({ path: `public/icons/${name}`, omitBackground: true });
  console.log('écrit', name);
}
await browser.close();
