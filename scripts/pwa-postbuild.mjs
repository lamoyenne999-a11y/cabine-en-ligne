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
    <title>Cabine En Ligne</title>
    <style id="ios-pwa-fixes">
      /* iOS « app installée » (mode standalone) : garantit que les champs de
         saisie sont focusables et ouvrent le clavier. Sans ces règles, iOS peut
         ignorer le toucher sur un input (user-select hérité, touch-callout). */
      input, textarea, select, [contenteditable="true"] {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
        touch-action: manipulation;
        pointer-events: auto !important;
        font-size: 16px; /* évite le zoom automatique iOS au focus */
      }
      html, body, #root { -webkit-tap-highlight-color: transparent; }
      /* App installée : la barre d'onglets descend de la hauteur de la barre d'accueil (~0,6 cm). */
      @media (display-mode: standalone) {
        [data-tabbar] { bottom: 0 !important; padding-top: 10px !important; padding-bottom: 12px !important; }
        html, body { background: #FFFFFF; }
      }
    </style>`;

  // Insert after </head>
  // Viewport adapté au clavier (interactive-widget) et aux encoches iOS (viewport-fit).
  html = html.replace(
    /<meta name="viewport" content="[^"]*"\s*\/?>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content" />',
  );
  if (!html.includes('manifest.webmanifest')) {
    html = html.replace('</head>', `  ${meta}\n</head>`);
  }

  // Register the service worker (skip in dev to avoid caching stale bundles)
  const sw = `\n<script>\n  if ('serviceWorker' in navigator && location.protocol === 'https:') {\n    window.addEventListener('load', function() {\n      navigator.serviceWorker.register('/sw.js').then(function(r) {\n        console.log('PWA: service worker prêt', r.scope);\n      }).catch(function(e) { console.warn('PWA: SW non enregistré', e); });\n    });\n  }\n</script>\n`;

  // iOS standalone : parfois le « touchend » sur un input n'ouvre pas le clavier
  // (le focus est posé puis perdu). On re-force le focus juste après le toucher.
  const iosFocus = `\n<script>\n  (function(){\n    var standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;\n    if (!standalone) return;\n    document.addEventListener('touchend', function(e){\n      var t = e.target && e.target.closest ? e.target.closest('input,textarea,select') : null;\n      if (!t || t.disabled || t.readOnly) return;\n      setTimeout(function(){ if (document.activeElement !== t) { try { t.focus({ preventScroll: true }); } catch(_) { t.focus(); } } }, 0);\n    }, { passive: true });\n  })();\n</script>\n`;
  if (!html.includes('iosFocusFix') && !html.includes('navigator.standalone')) {
    html = html.replace('</body>', `${iosFocus}</body>`);
  }

  if (!html.includes('serviceWorker')) {
    html = html.replace('</body>', `${sw}</body>`);
  }

  fs.writeFileSync(index, html);
  console.log('PWA: index.html enrichi (manifest + icônes + service worker).');
}

console.log('PWA: assets copiés dans dist/');
