#!/usr/bin/env node
/**
 * Rewrites VERSION and PRECACHE in parley/sw.js from the app shell files on disk.
 * Run after changing any shell file:  node parley/tools/build-sw.mjs
 * With --check, exits 1 if sw.js is out of date (used by tests).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lists app shell files relative to ROOT, sorted. */
export function shellFiles() {
  const out = ['index.html', 'manifest.webmanifest'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|css|png|svg)$/.test(e.name)) out.push(rel);
    }
  };
  for (const d of ['src', 'styles', 'assets/icons']) walk(d);
  return out.sort();
}

/** Computes the expected sw.js source. */
export function expectedSw() {
  const files = shellFiles();
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  const version = hash.digest('hex').slice(0, 12);
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = JSON.stringify(['./', ...files.map((f) => `./${f}`)], null, 2);
  return src
    .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
    .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${list};`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const swPath = path.join(ROOT, 'sw.js');
  const next = expectedSw();
  const current = fs.readFileSync(swPath, 'utf8');
  if (process.argv.includes('--check')) {
    if (next !== current) { console.error('sw.js is out of date: run node parley/tools/build-sw.mjs'); process.exit(1); }
    console.log('sw.js is up to date');
  } else {
    fs.writeFileSync(swPath, next);
    console.log(`sw.js updated: ${shellFiles().length + 1} entries`);
  }
}
