# Déployer Cabine En Ligne en ligne de façon DURABLE

Le **sandbox de preview se met en veille** quand il est inactif → le lien « meurt » de temps
en temps. Pour un lien **permanent**, il faut héberger l'app sur un service externe.

> ⚠️ Honnêteté : ces services exigent **ton compte** (gratuit). Je ne peux pas le créer à ta
> place, mais tout est **préparé** pour que ce soit presque automatique. Cet environnement
> (celui que tu vois ici) reste une **preview interactive** ; la mise en ligne durable se fait
> via l'un des points ci-dessous.

---

## ✌️ Deux façons de déployer

| | **A. Tout-en-un (recommandé)** | **B. Front seul (PWA / démo)** |
|---|---|---|
| Ce qui tourne | Front PWA + API + base | Front PWA uniquement |
| Fonctionnalités | ✅ complètes (comptes, demandes, abonnement, Wave mock) | ⚠️ mode **démo** (données locales, réinitialisées au rechargement) |
| Hébergeur | **Render** (ou Fly/Railway/VPS) | **Netlify** / **Vercel** |
| Fichier | `render.yaml` ou `Dockerfile` | `netlify.toml` / `vercel.json` |

La **méthode A** garde toutes les fonctionnalités réelles (comptes partagés, demandes entre
client et gérant). La **méthode B** est plus simple mais retombe en démo locale.

---

## 🟢 Méthode A — Tout-en-un sur Render (recommandé)

1. Va sur **[render.com](https://render.com)** → compte gratuit.
2. **New → Blueprint** → connecte ton dépôt GitHub (y pousse le projet).
3. Render lit `render.yaml` → crée la base Postgres + le service **cabine-en-ligne**.
4. Render te donne une URL `https://cabine-en-ligne.onrender.com`.

Render exécute `npm run build:web` puis démarre **`node server/src/combined.js`**, qui sert le
front **dist/ + l'API** sur le même port (même origine, zéro CORS).

### Variables (dashboard Render → ton service → Environment)
- `JWT_SECRET` : généré automatiquement (laisse tel quel).
- `WAVE_MODE=mock` : garde-le pour la démo. Passe à `live` + `WAVE_API_KEY` +
  `WAVE_WEBHOOK_SECRET` quand tu as ton compte Wave Business.
- `PHONE_PREFIX=+225` (Côte d'Ivoire).

---

## 🔵 Méthode B — Front seul sur Netlify (ou Vercel)

1. **[netlify.com](https://netlify.com)** → compte gratuit.
2. **Add new site → Import from Git** (ou drag & drop du dossier).
3. Netlify lit `netlify.toml` → `npm run build:web` → publie `dist/`.

L'app est une **PWA installable** (HTTPS ✅) et fonctionne en **mode démo** tant qu'aucune API
n'est branchée.

**Pour brancher l'API** : héberge l'API ailleurs (ex. Render) puis définis la variable
d'environnement **`EXPO_PUBLIC_API_URL`** = `https://ton-api.onrender.com` dans Netlify →
redeploy (CORS déjà activé côté API).

- **Vercel** : même principe, Vercel lit `vercel.json`.

---

## 🐳 Alternative : n'importe quel hébergeur Docker

Un `Dockerfile` est fourni (front PWA + API en un conteneur). Fonctionne sur : **Fly.io**,
**Railway**, **Koyeb**, un **VPS** (DigitalOcean, Hetzner…).

```bash
docker build -t cabine-en-ligne .
docker run -p 4000:4000 -e PORT=4000 cabine-en-ligne
```

---

## 📲 Rendre l'app installable (PWA) une fois en ligne

- **iOS (Safari)** : Partager → **« Sur l'écran d'accueil »**.
- **Android (Chrome)** : bandeau **« Installer l'application »** / **Ajouter à l'écran d'accueil**.

---

## ✅ Vérifier après déploiement

```bash
curl -I https://TON-URL.onrender.com            # la page se charge ?
curl https://TON-URL.onrender.com/health        # santé de l'API
curl -X POST https://TON-URL.onrender.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"phone":"0101010101","password":"demo123"}'   # connexion démo
curl https://TON-URL.onrender.com/?u=u_amadou   # lien de partage (profil public)
```

---

## 💡 Ce que je peux faire pour toi maintenant

Dis-moi **laquelle** tu veux et **quel compte** tu peux créer (Render, Netlify, Vercel…). Je peux :
1. **vérifier** que les fichiers de déploiement sont prêts et te guider pas à pas.
2. **préparer le dépôt / la commande** exacte pour envoyer le code (git).
3. si tu préfères un **hébergement sur ton propre VPS**, te donner la commande `docker`/`node`.
