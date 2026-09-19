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
    <meta name="description" content="Cabine En Ligne : rechargez vos unités, minutes et internet à distance auprès d'un gérant de cabine, en Côte d'Ivoire. Paiement direct par Wave, sans vous déplacer. Application gratuite à l'essai pour clients et gérants de cabines." />
    <meta name="keywords" content="recharge unités à distance, cabine téléphonique en ligne, crédit téléphonique Abidjan, recharge internet Wave, gérant de cabine, Cabine En Ligne, Côte d'Ivoire" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="author" content="Cabine En Ligne" />
    <meta name="geo.region" content="CI" />
    <meta name="geo.placename" content="Abidjan" />
    <link rel="canonical" href="https://cabineenligne.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Cabine En Ligne" />
    <meta property="og:locale" content="fr_CI" />
    <meta property="og:url" content="https://cabineenligne.com/" />
    <meta property="og:title" content="Cabine En Ligne – Recharge d'unités, minutes et internet à distance" />
    <meta property="og:description" content="Choisissez un gérant de cabine, payez-le directement sur son Wave, recevez vos unités, minutes ou internet sans vous déplacer." />
    <meta property="og:image" content="https://cabineenligne.com/icons/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Cabine En Ligne – recharge mobile à distance par un gérant de cabine" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Cabine En Ligne – Recharge d'unités, minutes et internet à distance" />
    <meta name="twitter:description" content="Choisissez un gérant de cabine, payez-le directement sur son Wave, recevez vos unités, minutes ou internet sans vous déplacer." />
    <meta name="twitter:image" content="https://cabineenligne.com/icons/og-image.png" />
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Organization","@id":"https://cabineenligne.com/#org","name":"Cabine En Ligne","url":"https://cabineenligne.com/","logo":"https://cabineenligne.com/icons/icon-512.png","areaServed":{"@type":"Country","name":"Côte d'Ivoire"}},
      {"@type":"WebSite","@id":"https://cabineenligne.com/#site","url":"https://cabineenligne.com/","name":"Cabine En Ligne","inLanguage":"fr","publisher":{"@id":"https://cabineenligne.com/#org"}},
      {"@type":"WebApplication","name":"Cabine En Ligne","url":"https://cabineenligne.com/","applicationCategory":"FinanceApplication","operatingSystem":"Web, iOS, Android","inLanguage":"fr","description":"Application de recharge mobile à distance : les clients commandent unités, minutes ou internet à un gérant de cabine et le paient directement par Wave.","offers":[{"@type":"Offer","name":"Client","price":"100","priceCurrency":"XOF","description":"100 F CFA par mois ou 1 000 F CFA par an, après 1 mois d'essai gratuit"},{"@type":"Offer","name":"Gérant de cabine","price":"200","priceCurrency":"XOF","description":"200 F CFA par mois ou 2 000 F CFA par an, après 1 mois d'essai gratuit"}]},
      {"@type":"FAQPage","mainEntity":[
        {"@type":"Question","name":"Comment recharger mes unités à distance avec Cabine En Ligne ?","acceptedAnswer":{"@type":"Answer","text":"Créez un compte client, choisissez un gérant de cabine en ligne, envoyez votre demande (unités, minutes ou internet), payez le gérant directement sur son numéro Wave, puis il vous crédite sans que vous ayez à vous déplacer."}},
        {"@type":"Question","name":"L'argent passe-t-il par l'application ?","acceptedAnswer":{"@type":"Answer","text":"Non. Le paiement se fait directement entre le client et le gérant via Wave. Cabine En Ligne met simplement en relation et suit la demande."}},
        {"@type":"Question","name":"Combien coûte Cabine En Ligne ?","acceptedAnswer":{"@type":"Answer","text":"Le premier mois est gratuit. Ensuite l'abonnement est de 100 F CFA par mois (ou 1 000 F par an) pour un client et 200 F CFA par mois (ou 2 000 F par an) pour un gérant de cabine."}},
        {"@type":"Question","name":"Comment un gérant de cabine peut-il rejoindre l'application ?","acceptedAnswer":{"@type":"Answer","text":"Il crée un compte gérant avec son nom et son numéro Wave, puis partage son QR code ou son lien à ses clients. Il reçoit ensuite leurs demandes dans l'application."}}
      ]}
    ]}
    </script>
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Cabine" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
    <title>Cabine En Ligne – Recharge d'unités, minutes et internet à distance en Côte d'Ivoire</title>
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
  html = html.replace(/<html([^>]*)\slang="[^"]*"/, '<html$1 lang="fr"').replace(/<html(?![^>]*lang=)/, '<html lang="fr"');
  html = html.replace(/<title>Cabine En Ligne<\/title>\s*/g, '');
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

  const seo = `\n<div id="seo-static" style="font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#241B35">\n  <h1>Cabine En Ligne – Recharge d'unités, minutes et internet à distance</h1>\n  <p>Cabine En Ligne est une application qui permet de recharger ses unités, minutes et internet à distance auprès d'un gérant de cabine, en Côte d'Ivoire. Le client choisit un gérant en ligne, le paie directement sur son numéro Wave, et le gérant le crédite sans qu'il ait à se déplacer.</p>\n  <h2>Comment ça marche</h2>\n  <ol><li>Choisissez un gérant de cabine en ligne : son nom et son numéro sont visibles.</li><li>Payez-le directement sur son Wave : aucun argent ne passe par l'application.</li><li>Il vous crédite vos unités, minutes ou internet, rapidement.</li></ol>\n  <h2>Pour les gérants de cabines</h2>\n  <p>Recevez les demandes de vos clients, suivez vos paiements et partagez votre QR code pour fidéliser votre clientèle.</p>\n  <h2>Tarifs</h2>\n  <p>Premier mois gratuit, puis 100 F CFA par mois (1 000 F par an) pour un client et 200 F CFA par mois (2 000 F par an) pour un gérant.</p>\n  <p><a href="https://cabineenligne.com/">cabineenligne.com</a></p>\n</div>\n<script>(function(){var r=document.getElementById('root'),e=document.getElementById('seo-static');if(!e)return;var rm=function(){if(e&&e.parentNode)e.parentNode.removeChild(e);e=null;};if(r&&r.childNodes.length){rm();return;}if(window.MutationObserver&&r){new MutationObserver(function(){if(r.childNodes.length)rm();}).observe(r,{childList:true});}setTimeout(rm,4000);})();</script>\n`;
  if (!html.includes('seo-static')) {
    html = html.replace('<div id="root"></div>', '<div id="root"></div>' + seo);
  }

  if (!html.includes('serviceWorker')) {
    html = html.replace('</body>', `${sw}</body>`);
  }

  fs.writeFileSync(index, html);
  console.log('PWA: index.html enrichi (manifest + icônes + service worker).');
}

console.log('PWA: assets copiés dans dist/');
