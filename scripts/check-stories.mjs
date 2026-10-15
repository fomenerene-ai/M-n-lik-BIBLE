// Vérifie les fiches d'histoires : champs obligatoires et références analysables.
// Usage : npm run check:stories
import fs from 'node:fs';
import path from 'node:path';
import { parseReference } from '../src/core/reference.js';

const DIR = 'public/histoires';
const REQUIRED = ['id', 'nom', 'cle', 'ordre', 'groupe', 'periode', 'resume', 'recit', 'chronologie'];
let errors = 0;
const fail = (f, msg) => {
  errors++;
  console.error(`✗ ${f} : ${msg}`);
};

// Une référence d'histoire peut couvrir plusieurs chapitres : on contrôle son point de départ.
function checkRef(f, ref) {
  let r = parseReference(ref);
  if (!r.ok || !r.chapter) {
    const parts = ref.split('-');
    r = parseReference(parts[0]);
    const end = parts[1];
    if (r.ok && end && !/^\d+(:\d+)?$/.test(end.trim())) return fail(f, `fin de plage invalide « ${ref} »`);
  }
  if (!r.ok) return fail(f, `référence invalide « ${ref} » (${r.error})`);
  if (!r.chapter) return fail(f, `référence sans chapitre « ${ref} »`);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
const ids = new Set();
for (const f of files) {
  let s;
  try {
    s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  } catch (e) {
    fail(f, `JSON invalide (${e.message})`);
    continue;
  }
  for (const k of REQUIRED) if (s[k] === undefined) fail(f, `champ manquant « ${k} »`);
  if (s.id !== f.replace(/\.json$/, '')) fail(f, 'id différent du nom de fichier');
  if (ids.has(s.id)) fail(f, 'id en double');
  ids.add(s.id);
  const texts = [s.resume, ...(s.recit || []), ...(s.contexte || []), ...(s.chronologie || []).map((c) => c.etape)];
  for (const t of texts) {
    if (/[—–]/.test(t)) fail(f, `tiret long dans « ${t.slice(0, 40)}… »`);
    for (const m of t.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) checkRef(f, m[1].trim());
  }
  for (const c of s.chronologie || []) if (c.ref) checkRef(f, c.ref);
  for (const r of s.references || []) checkRef(f, r);
}
console.log(`${files.length} fiches vérifiées, ${errors} erreur(s).`);
process.exit(errors ? 1 : 0);
