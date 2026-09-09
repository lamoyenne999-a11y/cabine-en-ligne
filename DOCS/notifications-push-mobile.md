# Recevoir les notifications sur le téléphone (type WhatsApp)

Vous voulez être alerté **même quand l'app est en veille ou fermée**, comme WhatsApp.
Il y a **deux façons** de le faire, et **toutes deux sont maintenant codées** :

| Option | Principe | État |
|---|---|---|
| **A — Web Push (PWA installée)** | La PWA s'abonne via l'API Web Push (service worker) ; le navigateur reçoit la push et affiche la notification. | ✅ **Implémentée et fonctionnelle** |
| **B — App native (Android/iOS)** | Une vraie app Expo passe par APNs/FCM. | ✅ Code prêt (à construire avec EAS) |

> **Point clé** : pour *votre* cas, **l'Option A est déjà en place**. Sur **Android
> (Chrome/Edge)** elle fonctionne **même app fermée**. Sur **iPhone**, elle fonctionne
> si la PWA est **installée sur l'écran d'accueil** (iOS 16.4+) ; sinon Safari est plus
> limité. Pour un comportement **100 % type WhatsApp sur les deux plateformes**, l'app
> native (Option B) reste la solution la plus fiable.

---

## ✅ Option A — Web Push sur la PWA (choisie) : ce qui est fait

| Élément | État |
|---|---|
| lib `web-push` (VAPID) côté serveur | ✅ `server/src/services/pushService.js` |
| Clés VAPID générées **une fois** puis stockées en base | ✅ (`pushVapid` via `getMeta`/`setMeta`) |
| `GET /api/public/push-key` (clé publique VAPID) | ✅ |
| `POST /api/auth/push-subscription` (enregistre l'abonnement) | ✅ |
| Collection `push_subscriptions` en base | ✅ |
| Abonnement côté navigateur (`src/push.web.js` → `enableNotifications`) | ✅ |
| Service worker `push` + `notificationclick` (`public/sw.js`) | ✅ |
| Bouton « Notifications » activé (`src/components/PushSettings.jsx`) | ✅ |
| `sendWebPushToUser()` appelé à chaque notification (`flowService`) | ✅ |

### ➡️ Pour l'activer chez vous
1. **Installez la PWA** sur votre téléphone :
   - **Android (Chrome)** : ouvrez `https://cabineenligne.com` → menu ⋮ → **« Installer l'application »**.
   - **iPhone (Safari)** : ouvrez `https://cabineenligne.com` → **Partager** → **« Sur l'écran d'accueil »**.
   - *(pour que ça fonctionne, la PWA doit être affichée en plein écran, pas dans l'onglet Safari)*.
2. Connectez-vous, puis **Profil → « Notifications sur le téléphone » → activez**.
3. **Autorisez** la notification quand le navigateur la demande.
4. Faites une demande (ou acceptez/refusez) → le téléphone la reçoit **même app fermée** 🔔.

> ⚠️ Sur iPhone, la première notification du site peut demander une **double
> confirmation** (Autoriser puis relancer). Et remobilisez la PWA depuis l'écran
> d'accueil, pas depuis une recherche.

---

## 📱 Option B — App native (alternative, code déjà prêt)

À faire **une seule fois sur votre machine** (nécessite un compte Expo gratuit) :
```bash
npm i -g eas-cli
eas login
eas init            # crée le projet EAS (noter l'ID)
```
Puis dans **Render → Environment** : `EXPO_PUBLIC_EAS_PROJECT_ID` = votre ID (vous avez déjà `PUSH_ENABLED=true`).
Ensuite :
```bash
eas build --profile preview --platform android   # produit un .apk à installer
```
Le code `src/push.native.js` enregistre le jeton via `/api/auth/push-token`.

---

## ⚠️ À savoir
- Le **Web Push (Option A)** est le plus simple et **suffit sur Android**.
- Pour être **certain** de recevoir les notifs sur **iPhone** même app fermée, l'**app native**
  est la solution 100 % fiable (APNs).
- `PUSH_ENABLED=true` doit être présent sur Render (avec `DATABASE_URL` PostgreSQL pour
  stocker les abonnements) pour que l'envoi fonctionne.
