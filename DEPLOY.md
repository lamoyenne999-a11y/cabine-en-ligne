# Déployer Cabine En Ligne en ligne de façon DURABLE

Le **sandbox de preview se met en veille** quand il est inactif → le lien « meurt » de temps
en temps. Pour un lien **permanent**, il faut héberger l'app sur un service externe.

> ⚠️ Un point honnête : ces services exigent **ton compte** (gratuit). Je ne peux pas créer
> le compte à ta place, mais tout est **préparé** pour que ce soit presque automatique.

---

## ✌️ Deux façons de déployer

| | **A. Tout-en-un (recommandé)** | **B. Front seul** |
|---|---|---|
| Ce qui tourne | Front PWA + API + base | Front PWA uniquement |
| Fonctionnalités | ✅ complètes (soldes, demandes, connexion, Wave mock) | ⚠️ mode **démo** (données locales, réinitialisées à chaque rechargement) |
| Hébergeur | **Render** (ou Fly/Railway) | **Netlify** / **Vercel** |
| Fichier à utiliser | `render.yaml` ou Dockerfile | `netlify.toml` / `vercel.json` |

La **méthode A** garde **toutes** les fonctionnalités réelles (comptes, soldes, historique).
La **méthode B** est plus simple mais l'app retombe en démo locale (chaque visiteur a ses
propres données, réinitialisées à chaque rechargement).

---

## 🟢 Méthode A — Tout-en-un sur Render (recommandé)

1. Va sur **[render.com](https://render.com)** et crée un compte gratuit.
2. **New → Blueprint** → connecte ton dépôt GitHub (y pousse le dossier du projet).
3. Render lit `render.yaml` et crée le service **cabine-en-ligne** (Web Service).
4. Render te donne une URL du type `https://cabine-en-ligne.onrender.com`.

**C'est tout.** Render *(buildCommand)* exécute `npm run build:web` puis démarre
`node server/src/combined.js`, qui sert le front + l'API sur le même port.

> **Astuce** : tu peux aussi déployer sans GitHub en cliquant « Deploy » sur le dossier
> (drag & drop) — mais le plus simple est de brancher le dépôt.

### Variables (à remplir dans le dashboard Render → ton service → Environment)
- `JWT_SECRET` : généré automatiquement (laisse tel quel).
- `WAVE_MODE=mock` : garde `mock` pour la démo. Passe à `live` + renseigne `WAVE_API_KEY`
  et `WAVE_WEBHOOK_SECRET` quand tu as ton compte Wave Business.

---

## 🔵 Méthode B — Front seul sur Netlify (ou Vercel)

1. **[netlify.com](https://netlify.com)** → compte gratuit.
2. **Add new site → Import from Git** (ou **Deploy manually** / drag & drop du dossier).
3. Netlify lit `netlify.toml` → exécute `npm run build:web` → publie `dist/`.

L'app se comporte en **PWA installable** (https requis ✅) et est accessible en permanence.
Elle fonctionne en **mode démo** (données locales) tant qu'aucune API n'est branchée.

**Pour avoir l'API sur ce mode** : héberge l'API ailleurs (ex. Render) puis renseigne la
variable d'environnement **`EXPO_PUBLIC_API_URL`** = `https://ton-api.onrender.com` dans
Netlify → redeploy.

- **Vercel** : même principe, Vercel lit `vercel.json`.

---

## 🐳 Alternative : n'importe quel hébergeur Docker

Un `Dockerfile` est fourni (front + API en un conteneur). Fonctionne sur :
**Fly.io**, **Railway**, **Koyeb**, un **VPS** (DigitalOcean, Hetzner…), etc.

```bash
docker build -t cabine-en-ligne .
docker run -p 4000:4000 -e PORT=4000 cabine-en-ligne
```

---

## 3. Rendre l'app installable (PWA) une fois en ligne

Une fois déployée (URL HTTPS) :
- **iOS (Safari)** : Partager → **« Sur l'écran d'accueil »**.
- **Android (Chrome)** : bandeau **« Installer l'application »** / **Ajouter à l'écran d'accueil**.

---

## ✅ Vérifier après déploiement

```bash
# La page de l'app se charge ?
curl -I https://TON-URL.onrender.com
# La santé de l'API ?
curl https://TON-URL.onrender.com/health
# Connexion ?
curl -X POST https://TON-URL.onrender.com/api/auth/login \
  -H 'content-type: application/json' -d '{"phone":"0202020202","password":""}'
```

---

## 💡 Le point clé à décider

- **Veux-tu garder les vraies données partagées** (chaque client voit SA demande, le gérant
  voit SES gains) → **Méthode A** (tout-en-un). C'est ce qui correspond à ta vision produit.
- **Tu veux juste un lien permanent simple** qui démontre l'app à d'autres personnes sans
  backend → **Méthode B** (PWA, mode démo).

---

## Ce que je peux faire pour toi maintenant

Dis-moi **laquelle** tu veux et **quel compte** tu peux créer (Render, Netlify, Vercel…).
Je peux :
1. **Vérifier** que les fichiers de déploiement sont parfaits et te guider pas à pas sur le
   tableau de bord de l'hébergeur.
2. **Préparer le dépôt / la commande** exacte pour envoyer le code (git).
3. Si tu préfères **un hébergement unique côté Serveur** (ton propre VPS), je te donne la
   commande `docker`/`node` pour le faire tourner.
