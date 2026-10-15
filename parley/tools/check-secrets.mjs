#!/usr/bin/env node
/**
 * Fails if a string that looks like an Anthropic API key is found in tracked files.
 * Usage: node parley/tools/check-secrets.mjs   (from anywhere inside the repo)
 * Install as a git pre-commit hook:
 *   printf '#!/bin/sh\nnode parley/tools/check-secrets.mjs\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Built from parts so this file does not match itself.
const PATTERN = new RegExp(['sk', 'ant', ''].join('-') + '[A-Za-z0-9_-]{8,}');

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const hits = [];
for (const f of new Set([...files, ...staged])) {
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (text.includes('\u0000')) continue;
  const lines = text.split('\n');
  lines.forEach((line, i) => { if (PATTERN.test(line)) hits.push(`${f}:${i + 1}`); });
}
if (hits.length) {
  console.error('Possible API key found in:');
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`No API key pattern in ${files.length} tracked files.`);
