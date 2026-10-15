import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedSw } from '../tools/build-sw.mjs';
import { APP_NAME } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('sw.js precache list and version are up to date', () => {
  assert.equal(read('sw.js'), expectedSw(), 'run: node parley/tools/build-sw.mjs');
});

test('every precached file exists and every relative import resolves', () => {
  const sw = read('sw.js');
  const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  for (const p of list) if (p !== './') assert.ok(fs.existsSync(path.join(ROOT, p)), p);
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of walk('src').filter((x) => x.endsWith('.js'))) {
    const src = read(f);
    for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, path.dirname(f), m[1])), `${f} imports missing ${m[1]}`);
    }
  }
});

test('manifest uses relative scope and the app name', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.name, APP_NAME, 'rename manifest.webmanifest with APP_NAME');
  assert.ok(read('index.html').includes(`<title>${APP_NAME}</title>`), 'rename index.html title with APP_NAME');
});

test('no absolute paths, innerHTML or inline styles in the app shell', () => {
  const html = read('index.html');
  assert.ok(!/(src|href)="\/(?!\/)/.test(html), 'absolute path in index.html');
  assert.ok(!/ style="/.test(html), 'inline style attribute in index.html');
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of walk('src')) {
    const src = read(f);
    assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/.test(src), `${f} uses innerHTML`);
    assert.ok(!/setAttribute\(\s*['"]style['"]/.test(src), `${f} sets a style attribute`);
  }
});

test('no French strings in UI source', () => {
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of [...walk('src'), 'index.html']) {
    assert.ok(!/[éèêàçùâîôû]/i.test(read(f)), `${f} contains accented (likely French) text`);
  }
});
