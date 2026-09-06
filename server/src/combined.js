import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { config } from './config.js';

// ============================================================
//  Serveur combiné (pour l'hébergement durable)
//  - sert l'app web PWA (dist/) en statique
//  - monte l'API Express sur /api et /health (même port, pas de CORS)
//  - repli SPA -> index.html pour les routes clientes
//  → une seule app, un seul port, déployable sur Render/Fly/Railway…
// ============================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', '..', 'dist'); // racine du projet /dist
const app = await createApp(); // Express (routes /api/* + /health + webhook)

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  // L'API et la santé sont gérées par Express.
  if (p.startsWith('/api') || p === '/health') {
    app(req, res);
    return;
  }

  // Fichiers statiques.
  const rel = p === '/' ? '/index.html' : p;
  let fp = path.join(DIST, decodeURIComponent(rel));
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const ext = path.extname(fp).toLowerCase();
    res.statusCode = 200;
    res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
    res.end(fs.readFileSync(fp));
    return;
  }

  // Repli SPA (les balises manifest/sw sont dans index.html).
  const indexHtml = path.join(DIST, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html');
    res.end(fs.readFileSync(indexHtml));
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

const port = Number(process.env.PORT || config.port || 4000);
server.listen(port, '0.0.0.0', () => {
  console.log(`\n🟣  Cabine En Ligne — serveur combiné démarré`);
  console.log(`    Port        : ${port}`);
  console.log(`    Mode Wave   : ${config.waveMode}`);
  console.log(`    Front (dist): ${fs.existsSync(DIST) ? 'OK' : 'ABSENT (lancez npm run build:web)'}`);
  console.log(`    URL         : http://localhost:${port}\n`);
});
