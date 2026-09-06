// ============================================================
//  Serviteur de prévisualisation
//  - sert le build web Expo (dist/)
//  - proxifie /api et /health vers le backend Node (server/)
//  → l'app et l'API partagent la même origine, pas de CORS.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DIST = path.join(__dirname, 'dist');
const UPSTREAM = process.env.UPSTREAM || 'http://localhost:4000';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyToUpstream(req, res, urlPath, search) {
  try {
    const target = `${UPSTREAM}${urlPath}${search || ''}`;
    const isBody = !['GET', 'HEAD'].includes(req.method);

    let body;
    let headers = { ...req.headers, host: new URL(UPSTREAM).host };
    if (isBody) {
      body = await readBody(req);
      delete headers['transfer-encoding'];
      headers['content-length'] = body.length;
    }

    const upRes = await fetch(target, {
      method: req.method,
      headers,
      body: isBody ? body : undefined,
      duplex: isBody ? 'half' : undefined,
    });
    res.statusCode = upRes.status;
    const copyHeaders = ['content-type', 'cache-control', 'connection'];
    copyHeaders.forEach((h) => {
      const v = upRes.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    const buffer = Buffer.from(await upRes.arrayBuffer());
    res.end(buffer);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Proxy unreachable', detail: String(e && e.message) }));
  }
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext && MIME[ext] ? MIME[ext] : 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.statusCode = 200;
  res.setHeader('content-type', mime);
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  // API + santé -> backend
  if (p.startsWith('/api') || p === '/health') {
    return proxyToUpstream(req, res, p, url.search);
  }

  // Fichiers statiques
  const rel = p === '/' ? '/index.html' : p;
  let fp = path.join(DIST, decodeURIComponent(rel));
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    return serveStatic(res, fp);
  }

  // Fallback SPA -> index.html (pour les routes clientes)
  const indexHtml = path.join(DIST, 'index.html');
  if (fs.existsSync(indexHtml)) return serveStatic(res, indexHtml);

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n▶  Preview : http://localhost:${PORT}`);
  console.log(`    Dist     : ${DIST}`);
  console.log(`    Upstream : ${UPSTREAM}  (/api et /health proxifiés)\n`);
});
