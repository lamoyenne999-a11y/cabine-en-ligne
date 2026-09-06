# Installer Cabine En Ligne comme une app native (iPhone + Android)

Cabine En Ligne est une **PWA** : une app web qui **s'installe et se lance comme une app
native** sur iPhone ET Android, avec logo, plein écran et lancement hors navigateur.

> Une seule app. Aucun store, aucune signature Apple/Google requis.
> Le **paiement Wave** reste simulé tant que tu n'as pas tes clés API
> (`WAVE_MODE=live` — voir `WAVE_INTEGRATION.md`).

---

## 📱 Sur iPhone (iOS Safari)

1. Ouvre le lien de l'app **dans Safari**.
2. Touche le bouton **Partager** (carré + flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**.
4. **Ajouter** → l'icône apparaît sur l'écran d'accueil.

Dès lors, la touche ouvre l'app en **plein écran**, sans barre d'adresse, comme une app native.

---

## 🤖 Sur Android (Chrome / Edge)

1. Ouvre le lien dans **Chrome**.
2. Un bandeau **« Installer l'application »** apparaît (Chrome détecte le manifest PWA).
   → **Installer**.
3. (Sinon) menu ⋮ → **« Ajouter à l'écran d'accueil »** → **Installer**.

L'app s'ajoute à l'écran d'accueil avec son icône et se lance en **mode standalone**.

---

## 🔎 Critères remplis pour une PWA installable

- **`manifest.webmanifest`** (nom, icônes 192/512 + maskable, `display: standalone`).
- **Icône Apple Touch** (iOS).
- **`theme-color`** et **`apple-mobile-web-app-capable`**.
- **Service worker** (`sw.js`) : démarrage rapide, lancement hors ligne du shell.
  Les appels `/api` ne sont **jamais** mis en cache (le mode « connecté » reste fiable).

---

## 🛠️ Reconstruire / servir

```bash
npm run build:web     # build web + copie PWA (manifest, icônes, sw.js) dans dist/
node serve.js         # sert dist/ + proxifie /api -> le backend (port 4000)
```

Les fichiers PWA sont dans :
- `public/manifest.webmanifest`
- `public/icons/*.png` (icônes + apple-touch-icon)
- `public/sw.js`
- `scripts/pwa-postbuild.mjs` (injecte les balises dans `index.html`)

---

## ⚠️ Notes

- Le **service worker** ne s'active que sur **HTTPS** (ou localhost). Sur une IP en HTTP
  local, l'installation peut être bloquée par le navigateur — utilise le lien d'aperçu
  (HTTPS) ou un domaine en HTTPS.
- Sur iOS, la PWA utilise un **WebView** : les capacités de paiement Wave réelles
  (deep-link vers l'app Wave) devront être testées. Le vrai paiement se fait côté serveur.
