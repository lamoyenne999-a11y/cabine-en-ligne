# Dépôt de la mise à jour — Web Push (PWA) + bloc Wave compact

> Tout le code est prêt dans le dépôt (worktree), testé en local. Le déploiement
> se déclenche **depuis votre compte Render** (le sandbox n'a ni jeton GitHub, ni
> clé d'API Render). Voici exactement quoi faire.

---

## 🎯 Ce que contient ce lot

| Fichier | Changement |
|---|---|
| `server/src/services/pushService.js` (nouveau) | Service Web Push (`web-push`), clés VAPID auto-générées + persistées. |
| `server/src/routes/public.js`, `auth.js` | `GET /api/public/push-key` + `POST /api/auth/push-subscription`. |
| `server/src/db.js` | Collection `push_subscriptions` + `getMeta`/`setMeta`. |
| `server/src/services/flowService.js` | `notifyPush()` envoie aussi le Web Push. |
| `public/sw.js` | Handlers `push` + `notificationclick` (notif même app fermée). |
| `src/push.web.js`, `src/store.jsx`, `src/api.js` | Abonnement Web Push côté navigateur. |
| `src/components/PushSettings.jsx` | Bouton « Notifications » **actif** (au lieu de « Réservé à l'app mobile »). |
| `src/components/WavePay.jsx`, `src/screens/client/ClientHome.jsx` | **Paiement retiré du formulaire** : il s'affiche **après « Envoyer la demande »** (dialogue de confirmation) et dans l'historique « À payer ». Le bouton « Envoyer la demande » reste donc **fixe**, jamais repoussé. |
| `render.yaml` | `PUSH_ENABLED=true` (déjà `true` dans le dashboard prod). |

---

## 🚀 Déclencher le déploiement (2 possibilités)

### Option A — Push sur le dépôt GitHub connecté à Render (recommandé)
Depuis une machine avec votre compte :
```bash
# depuis la racine du projet
git add -A
git commit -m "Web Push PWA + bloc Wave compact"
git remote add origin git@github.com:<vous>/<repo>.git   # si pas déjà fait
git push -u origin main
```
Render détecte le push → **build automatique** → nouvelle version en ligne.

### Option B — Déploiement manuel depuis le dashboard Render
1. **render.com** → service **cabine-en-ligne**.
2. **Events / Deploys** → **Manual Deploy**.
3. Attendre la fin du build (Render exécute : `npm install && cd server && npm install && cd .. && npm run build:web`, puis `node server/src/combined.js`).
4. Vérifier : `https://cabineenligne.com/health` → `{"status":"ok","mode":"mock"}`, et la page `/` sert un **nouveau** hash `index-…`.

---

## ⚙️ Variables d'environnement (déjà en place, à confirmer)

| Variable | Valeur | Rôle |
|---|---|---|
| `PUSH_ENABLED` | `true` | Active l'envoi des push (Web Push + Expo). |
| `DATABASE_URL` | PostgreSQL | Stocke les **abonnements Web Push** (pas texte, sinon perdus au redémarrage). |
| `WAVE_MODE` | `mock` | Paiement simulé. |

> ⚠️ `DATABASE_URL` (PostgreSQL) est important : les abonnements de navigateur et
> les clés VAPID sont persistés en base. Sur un service qui repart de zéro (fichier
> JSON local), il faut ré-activer la notification sur le téléphone.

> 🔄 **Après le déploiement, le navigateur peut garder l'ancienne version en cache.**
> La version du service worker a été **incrémentée** (`cabine-en-ligne-v3`) pour
> forcer le rechargement du nouveau code. Si le bloc « Paiement Wave Direct »
> réapparaît dans le formulaire, c'est que **la version n'est PAS encore déployée**
> (la prod sert encore l'ancien bundle). Rechargez la page / réinstallez la PWA
> après déploiement.

---

## 📱 Une fois en ligne (sur votre téléphone)

1. **Mettre à jour la PWA** : sur le téléphone, **videz le cache / rechargez** le site
   (ou, plus simple, re-installez la PWA si l'ancienne est ouverte — sur Android,
   fermez et rouvrez l'app ; sur iOS, refaites « Sur l'écran d'accueil »). Le code
   JS est versionné (nouveau hash), le SW se met à jour automatiquement.
2. **Profil → « Notifications sur le téléphone »** : le libellé devient
   « Soyez alerté immédiatement… » (plus « Réservé à l'app mobile »). **Activez**
   → **Autorisez** la notification.
3. **Installez la PWA** pour un rendu plein écran :
   - **Android** : `cabineenligne.com` → menu ⋮ → **Installer l'application**.
   - **iPhone (iOS 16.4+)** : Partager → **Sur l'écran d'accueil**.
4. **Test** : envoyez/acceptez/refusez une demande → le téléphone sonne **même app fermée** 🔔.

> Le **Web Push** fonctionne bien app fermée sur **Android**. Sur **iPhone**, il
> fonctionne sur la **PWA installée** (iOS 16.4+) ; pour du 100 % WhatsApp sur
> iPhone, l'app native (déjà prête, à construire avec EAS) reste la plus fiable.

---

## ✅ Vérification rapide (après déploiement)

```bash
curl https://cabineenligne.com/api/public/push-key   # doit renvoyer {"publicKey":"BM…"}
curl https://cabineenligne.com/health                 # {"status":"ok","mode":"mock"}
```
