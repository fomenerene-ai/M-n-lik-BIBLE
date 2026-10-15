// Configuration Vite.
//  - base relative : l'application fonctionne à la racine comme dans un sous-dossier (GitHub Pages) ;
//  - index des histoires généré depuis public/histoires/*.json ;
//  - service worker généré avec la liste exacte des fichiers à précacher.

import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const STORIES_DIR = path.resolve('public/histoires');

function storiesIndex() {
  const files = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .sort();
  return files.map((f) => {
    const s = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, f), 'utf8'));
    const id = f.replace(/\.json$/, '');
    if (s.id !== id) throw new Error(`Histoire ${f} : id « ${s.id} » différent du nom de fichier`);
    return { id, nom: s.nom, cle: s.cle, ordre: s.ordre, groupe: s.groupe, periode: s.periode, resume: s.resume.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, r, l) => l || r) };
  });
}

function storiesPlugin() {
  return {
    name: 'histoires-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].endsWith('/histoires/index.json')) {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(storiesIndex()));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'histoires/index.json', source: JSON.stringify(storiesIndex()) });
    },
  };
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function serviceWorkerPlugin() {
  let outDir = 'dist';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('.'));
      const hash = crypto.createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
      const list = files.map((f) => `./${f}`);
      const src = fs
        .readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(list, null, 2));
      fs.writeFileSync(path.join(outDir, 'sw.js'), src);
      console.log(`sw.js : ${list.length} fichiers précachés, version ${version}`);
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Horodatage du build (UTC), affiché dans les réglages pour distinguer les mises à jour
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  plugins: [storiesPlugin(), serviceWorkerPlugin()],
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
