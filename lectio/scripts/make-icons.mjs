// Génère les icônes PNG de la PWA à partir d'un SVG, rendu par Chromium (Playwright).
// Relancer : node scripts/make-icons.mjs

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const svg = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#141414"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - 2 * padding) / 512})">
    <path d="M256 150c-38-30-90-38-152-38v262c62 0 114 8 152 38 38-30 90-38 152-38V112c-62 0-114 8-152 38z"
      fill="none" stroke="#ecebe8" stroke-width="22" stroke-linejoin="round"/>
    <path d="M256 150v262" stroke="#ecebe8" stroke-width="22"/>
    <rect x="290" y="226" width="84" height="40" rx="10" fill="#e9b949"/>
  </g>
</svg>`;

const out = new URL('../public/icons/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage();
for (const [name, size, padding] of [
  ['icon-192.png', 192, 40],
  ['icon-512.png', 512, 40],
  ['icon-maskable-512.png', 512, 100],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg(padding)}`,
  );
  await page.screenshot({ path: new URL(name, out).pathname });
}
await browser.close();
console.log('Icônes générées dans public/icons/');
