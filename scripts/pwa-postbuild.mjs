// ============================================================
//  Post-build PWA
//  Appelé après `expo export` :
//   1) copie le contenu de public/ (manifest + icônes + sw.js) dans dist/
//   2) injecte les balises PWA (manifest, apple-touch-icon, theme-color,
//      apple-mobile-web-app, service worker) dans dist/index.html
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const pub = path.join(root, 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir(pub, dist);

const index = path.join(dist, 'index.html');
if (fs.existsSync(index)) {
  let html = fs.readFileSync(index, 'utf8');

  const meta = `
    <meta name="theme-color" content="#7B1FA2" />
    <meta name="description" content="Recharge mobile : unités, minutes, internet — clients et gérants de cabines." />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Cabine" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
    <title>Cabine En Ligne</title>`;

  // Insert after </head>
  if (!html.includes('manifest.webmanifest')) {
    html = html.replace('</head>', `  ${meta}\n</head>`);
  }

  // Register the service worker (skip in dev to avoid caching stale bundles)
  const sw = `\n<script>\n  if ('serviceWorker' in navigator && location.protocol === 'https:') {\n    window.addEventListener('load', function() {\n      navigator.serviceWorker.register('/sw.js').then(function(r) {\n        console.log('PWA: service worker prêt', r.scope);\n      }).catch(function(e) { console.warn('PWA: SW non enregistré', e); });\n    });\n  }\n</script>\n`;

  if (!html.includes('serviceWorker')) {
    html = html.replace('</body>', `${sw}</body>`);
  }

  fs.writeFileSync(index, html);
  console.log('PWA: index.html enrichi (manifest + icônes + service worker).');
}

console.log('PWA: assets copiés dans dist/');
