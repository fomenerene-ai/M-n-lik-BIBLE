import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateItem, validateManifest, cspHosts, hostAllowed } from '../src/content/manifest-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const good = { id: 'voa-1', tier: 1, title: 'A story', topic: 'work', audioUrl: 'https://av.voanews.com/a.mp3', transcript: 'Hello there.', source: 'https://learningenglish.voanews.com/a/1.html', licenseNote: 'Public domain, VOA', durationSec: 120 };

test('valid item passes', () => {
  assert.deepEqual(validateItem(good, { allowedHosts: ['*.voanews.com'] }), []);
});

test('rejects AP, Reuters and AFP credits', () => {
  for (const credit of ['Reuters contributed to this report.', 'Some information from The Associated Press', 'AFP']) {
    assert.ok(validateItem({ ...good, transcript: `Text. ${credit}` }).length > 0, credit);
  }
});

test('rejects hosts outside the CSP and non-https', () => {
  assert.ok(validateItem({ ...good, audioUrl: 'https://evil.example/a.mp3' }, { allowedHosts: ['*.voanews.com'] }).length);
  assert.ok(validateItem({ ...good, audioUrl: 'http://av.voanews.com/a.mp3' }).length);
});

test('segments must increase', () => {
  assert.ok(validateItem({ ...good, segments: [{ start: 2, end: 1, text: 'x' }] }).length);
  assert.deepEqual(validateItem({ ...good, segments: [{ start: 0, end: 1, text: 'a' }, { start: 1.2, end: 3, text: 'b' }] }), []);
});

test('shipped manifest is valid and CSP hosts parse', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hosts = cspHosts(html, 'media-src');
  assert.ok(hosts.includes('*.voanews.com'));
  assert.ok(hostAllowed('av.voanews.com', hosts));
  const res = validateManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/voa-manifest.json'), 'utf8')), { allowedHosts: hosts });
  assert.equal(res.errors.length, 0, JSON.stringify(res.errors));
});
