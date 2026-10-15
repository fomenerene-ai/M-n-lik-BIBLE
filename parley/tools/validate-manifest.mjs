#!/usr/bin/env node
/**
 * Validates parley/content/voa-manifest.json: schema, VOA-only credits, audio hosts allowed by the CSP.
 * Usage: node parley/tools/validate-manifest.mjs [--check-urls]
 * --check-urls also sends a HEAD request to each audioUrl (needs network access).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, cspHosts } from '../src/content/manifest-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/voa-manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const allowedHosts = cspHosts(html, 'media-src');

const res = validateManifest(manifest, { allowedHosts });
for (const e of res.errors) {
  console.error(`x ${e.id}`);
  for (const m of e.errors) console.error(`    ${m}`);
}
console.log(`${res.valid.length} valid item(s), ${res.placeholders} placeholder(s), ${res.errors.length} invalid.`);
if (res.placeholders) console.log('Placeholders are ignored by the app. See README, "Add VOA items".');

if (process.argv.includes('--check-urls')) {
  for (const item of res.valid) {
    try {
      const r = await fetch(item.audioUrl, { method: 'HEAD' });
      console.log(`${r.ok ? 'ok ' : 'ERR'} ${r.status} ${item.id}`);
      if (!r.ok) process.exitCode = 1;
    } catch (e) {
      console.log(`ERR ${item.id}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}
if (res.errors.length) process.exit(1);
