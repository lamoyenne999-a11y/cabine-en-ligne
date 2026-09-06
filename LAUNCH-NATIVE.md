# Lancer Cabine En Ligne en NATIF (sur téléphone)

Deux façons de lancer l'app de façon **native** :

- **A. Expo Go** — le plus rapide, idéal pour tester (aucun build, aucune signature).
- **B. Build natif (APK/IPA)** — pour une vraie app installable, via EAS Build.

> ⚠️ Le **paiement Wave** reste **simulé** tant que tu n'as pas tes clés API
> (`WAVE_MODE=live`, voir `WAVE_INTEGRATION.md`). Tout le reste (comptes, soldes,
> demandes, abonnements, historique) fonctionne réellement via le backend.

---

## Prérequis (une seule fois)

Sur **ton ordinateur** (celui qui contient le projet) :

```bash
# Node.js 18+ requis
node -v

# Dans le dossier du projet
cd cabine-en-ligne
npm install                 # installe le front
cd server && npm install    # installe le backend
cd ..
```

Sur ton **téléphone** : installe **Expo Go** (App Store / Play Store).

---

## ⚠️ IMPORTANT : même réseau WiFi

Le téléphone doit être sur le **même réseau WiFi que l'ordinateur** pour joindre l'API.
La config front **détecte automatiquement l'IP** de ton ordinateur (via `hostUri` d'Expo),
donc tu n'as **rien à configurer** à la main.

Si jamais la détection échoue, force l'IP dans `src/config.js` :

```js
function detectBaseUrl() {
  if (Platform.OS === 'web') return '';
  return `http://192.168.1.20:4000`;   // ⬅️ remplace par l'IP LAN de ton PC (ipconfig / ifconfig)
}
```

---

## A. Lancer avec Expo Go (rapide)

### 1. Démarrer le backend (API)
```bash
cd server
npm start            # -> http://0.0.0.0:4000
# Laisse ce terminal ouvert.
```

### 2. Démarrer le front Expo
Dans **un autre terminal**, depuis la racine du projet :
```bash
cd cabine-en-ligne
npx expo start
```

### 3. Ouvrir sur le téléphone
- **Android** : scanner le **QR code** affiché dans le terminal avec **Expo Go**.
- **iOS** : ouvrir **Expo Go** → scanner le QR code avec l'appareil photo (ou via l'onglet « Scanner »).

L'app charge, détecte l'API et affiche **🟢 « Connecté à l'API »** en haut.

> Si le téléphone ne charge pas : vérifie qu'il est sur le **même WiFi**,
> que le **pare-feu** de ton PC autorise les ports 4000 et 8081,
> et qu'aucun VPN ne bloque le réseau local.

### Comptes de démo
| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| Client | `0101010101` | *(vide)* |
| Gérant | `0202020202` | *(vide)* |

---

## B. Construire une vraie app installable (EAS Build)

Pour un **APK Android** ou un dossier **iOS/TestFlight**, utilise le build cloud Expo :

```bash
# 1. Installer l'outil
npm install -g eas-cli

# 2. Se connecter (compte Expo gratuit)
eas login

# 3. Configurer le projet (génère eas.json)
eas build:configure

# 4. Build Android (APK à installer directement)
eas build --platform android --profile preview
#   -> télécharger le .apk depuis le lien renvoyé

# 5. Build iOS (TestFlight, nécessite un compte Apple)
eas build --platform ios --profile production
```

Pour activer la PWA/installable sur le Web, tu peux aussi passer par **EAS** ou un
service de build natif.

---

## 🧪 Tester après le lancement

Le parcours est identique à la version web (voir `TESTING.md`) :

1. **Client** envoie une demande → **paie via Wave** (simulé).
2. **Gérant** confirme la demande → le solde augmente.
3. L'**abonnement** s'active après paiement via Wave.
4. **Retrait via Wave** du gérant → le solde diminue.

---

## 🔌 Réseau : ports à ouvrir

| Port | Usage |
|------|-------|
| `8081` | Serveur de dev Expo (Metro) |
| `4000` | API backend (Wave mock) |

En **production**, le front n'a plus besoin de Metro ; l'app native appelle directement
l'API déployée (côté serveur, vois `WAVE_INTEGRATION.md` pour brancher le vrai Wave).
