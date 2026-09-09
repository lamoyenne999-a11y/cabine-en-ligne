# Mettre à jour `cabineenligne.com` — guide pas à pas

> **Préparé à la main.** Tout le code des nouveautés est **commité** en local
> (`main`, commit `30ce2f1`). Le déploiement réel se déclenche **depuis votre
> compte Render** (le sandbox n'a ni clé d'API Render, ni dépôt GitHub connecté,
> ni accès au dashboard).

---

## ✅ Ce qui a été ajouté dans ce lot (et vérifié)

| Fonction | État |
|---|---|
| Gérant **suspendu** : ne reçoit plus de demandes, n'apparaît plus chez le client | ✅ testé (API 403, liste vide) |
| Gérant **supprimé** : ne peut plus se connecter ; s'il était connecté → retour à l'accueil au 401 | ✅ testé (401) |
| **Notifications push** sur téléphone (option dans le profil + serveur Expo) | ✅ câblé (voir limite §) |
| **Historiques** triés en familles (En attente / Traitées / Refusées / Annulées) | ✅ testé (build OK) |

**Compatibilité / non-disruption** :
- `expo-notifications` + `expo-device` ajoutés au `package.json`. La build web
  (PWA) les **ignore** (module séparé par plateforme `push.web.js`/`push.native.js`)
  → le site web ne casse pas. Vérifié : la build web passe.
- La collection `push_tokens` est **créée automatiquement** au démarrage (même sur
  la base PostgreSQL existante via `normalize()`).
- La logique est **rétro-compatible** : un gérant non suspendu et non supprimé se
  comporte exactement comme avant.

---

## 🚀 Comment déclencher le déploiement (2 possibilités)

### Option A — Push sur le dépôt GitHub connecté à Render (recommandé)
Render sur est branché en **Blueprint** (`render.yaml`) et se redéploie à chaque
push sur la branche `main`. Depuis une machine avec votre compte :
```bash
git remote add origin git@github.com:<vous>/<repo>.git   # si pas déjà fait
git push -u origin main
```
Render détecte le push → **build automatique** → le nouveau bundle est en ligne.

### Option B — Déploiement manuel depuis le dashboard Render
1. **render.com** → votre service **cabine-en-ligne**.
2. Onglet **Events / Deploys** → bouton **Manual Deploy** (ou **Sync** selon la source).
3. Attendre la fin de la build (≈ quelques minutes) → le site sert alors la
   nouvelle version (`index-<nouveauHash>`).
4. Vérifier : `https://cabineenligne.com/health` → `{"status":"ok","mode":"mock"}`.

Render exécute exactement :
```bash
npm install && cd server && npm install && cd .. && npm run build:web
node server/src/combined.js
```

---

## ⚙️ Variables d'environnement à vérifier dans Render (Service → Environment)

| Variable | Valeur conseillée | Rôle |
|---|---|---|
| `WAVE_MODE` | `mock` | Reste simulé (mettre `live` + clés plus tard) |
| `JWT_SECRET` | auto | ne pas toucher |
| `PHONE_PREFIX` | `+225` | Côte d'Ivoire |
| `ADMIN_KEY` | **votre clé** | Accès à l'espace propriétaire |
| `PUSH_ENABLED` | `false` d'abord | Passez à `true` pour envoyer les push |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | vide / l'ID EAS | requis seulement pour les push sur build native |
| `EXPO_PUBLIC_API_URL` | `""` | même origine (serveur proxyfie /api) |

> `PUSH_ENABLED` et `EXPO_PUBLIC_EAS_PROJECT_ID` ont été ajoutés à `render.yaml`
> pour figurer automatiquement si vous recréez le Blueprint. Sur un service déjà
> existant, ajoutez-les à la main dans le dashboard.

---

## 📱 Notifications push — limites (honnêteté)
- Les push **ne fonctionnent que sur l'app mobile** (Expo Go / build EAS), pas sur
  le PWA web ni en mode `mock`.
- Pour les activer : `PUSH_ENABLED=true` côté serveur + l'app buildée avec un
  `EXPO_PUBLIC_EAS_PROJECT_ID` valide, et l'utilisateur **active l'option** dans
  son profil (Permission activée + jeton enregistré).
- Tant que ce n'est pas fait, les **notifications in-app** (cloche) continuent de
  fonctionner normalement → rien n'est cassé.

---

## 🔍 Vérifier la mise à jour en ligne
```bash
curl -s https://cabineenligne.com/health
curl -s https://cabineenligne.com/ | grep -oE 'index-[a-f0-9]+\.js' | head -1
```
Si le hash `index-...` change par rapport à `index-61e5c1a6…`, c'est que la
nouvelle version est bien servie.
