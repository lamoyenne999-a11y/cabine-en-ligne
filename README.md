# Cabine En Ligne — Prototype React Native (Expo)

Application **mobile** deux-en-un qui connecte des **clients** (particuliers qui veulent
recharger leurs unités / minutes / internet) et des **gérants de cabines** qui traitent
ces demandes et sont payés en direct.

> Cette version est un **prototype cliquable et fonctionnel** (`React Native` + `Expo`).
> Le paiement **Wave** y est **simulé** (aucune clé API nécessaire). Le guide pour brancher
> le vrai Wave se trouve dans [`WAVE_INTEGRATION.md`](./WAVE_INTEGRATION.md).

---

## 🧭 Le nouveau modèle Wave

Par rapport à l'idée de départ, **plus de « rechargement du solde CEL »**. Wave sert à :

1. **Payer le gérant directement** — quand un client envoie une demande, il paie le gérant
   de la cabine via Wave (paiement direct, pas de pré-chargement d'un solde).
2. **Souscrire à un abonnement** — le client paie un forfait mensuel (Unités, Minutes,
   Internet) via Wave.

Le **gérant**, lui, garde un solde (ses gains) qu'il peut **retirer via Wave**.

---

## 🚀 Lancer le projet

```bash
cd cabine-en-ligne
npm install          # (node_modules n'est pas sauvegardé : à refaire après redémarrage)
npx expo start
```

Puis :

- **Web** : appuyer sur `w` (ou `npm run web`) — le plus simple pour la démo.
- **Android** : `npm run android` (exige un émulateur / appareil avec Expo Go).
- **iOS** : `npm run ios` (exige un Mac + simulateur).

> Le raccourci `npm run web` lance le serveur web sur `http://localhost:8081`.
> L'aperçu préparé pour toi utilise un build web statique servi sur le port `8080`.

---

## 👤 Comptes de démonstration

| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| **Client** | `0101010101` | *(n'importe lequel — ou vide)* |
| **Gérant** | `0202020202` | *(idem)* |

Le champ téléphone est **pré-rempli** selon le profil choisi. Il suffit d'appuyer sur
**« Se connecter »**.

## 📝 Créer un compte (S'inscrire)

Depuis l'écran **Connexion**, appuie sur **« S'inscrire »** pour créer un nouveau compte
Client ou Gérant. Renseigne ton nom, ton numéro, (un email optionnel) et un mot de passe
(au moins 4 caractères, à confirmer). La validation vérifie les champs et la concordance
des mots de passe, puis te connecte directement avec ton profil.

---

## 🎮 Parcours à tester

### Côté Client
1. **Accueil** : voir son abonnement actif, choisir une demande.
2. **Nouvelle demande** : choisir `Unités / Minutes / Internet`, saisir un montant, choisir
   `Pour moi` ou `Pour quelqu'un` (+ numéro), **choisir un gérant**, puis **Envoyer la demande**.
   → Le client est **payé via Wave au gérant** (modale Wave simulée) → la demande part au gérant.
3. **Abonnements** : choisir un forfait et le **payer via Wave** (active l'abonnement).
4. **Historique** : voir les transactions (+/−) et leur statut.
5. **Gérants** : ajouter / supprimer des gérants.
6. **Profil** : préférences (masquer le solde, notifications), déconnexion.

### Côté Gérant
1. **Tableau de bord** : solde CEL, statistiques, revenus, **Retirer via Wave**.
2. **Demandes** : la demande envoyée par le client apparaît avec un **compte à rebours**,
   puis **Confirmer la demande** → la somme est créditée au solde du gérant.
3. **Statistique** : taux de réussite, clients servis, graphique des revenus de la semaine.
4. **Historique** : gains et retraits, filtres par catégorie / statut.
5. **Clients** : gérer la liste des clients.
6. **Profil** : retirer les gains, déconnexion.

> 💡 Pour voir le fonctionnement **bout-en-bout** : en tant que **client**, envoyez une
> demande à un gérant *en ligne*. Puis connectez-vous en **gérant** et confirmez-la.
> Le client verra alors sa transaction passer à « Réussi ».

---

## 📁 Structure du projet

```
cabine-en-ligne/
├─ App.js                      # racine : Welcome → Login → Client / Gérant
├─ src/
│  ├─ theme.js                 # palette violette + helpers (xof, ombres…)
│  ├─ store.jsx                # état global (useReducer) + données de démo
│  ├─ components/
│  │  ├─ ui.jsx                # boutons, champs, tuiles, pastilles…
│  │  ├─ Shell.jsx             # en-tête violet + barre d'onglets mobile
│  │  ├─ Logo.jsx              # logo « A la cabine EN LIGNE » (dessiné)
│  │  └─ modals.jsx            # BottomSheet + Dialog + WaveModal (simulation)
│  └─ screens/
│     ├─ Welcome.jsx
│     ├─ Login.jsx
│     ├─ client/               # Accueil, Abonnements, Historique, Gérants, Profil
│     └─ gerant/               # Tableau, Demandes, Stat., Historique, Clients, Profil
└─ WAVE_INTEGRATION.md         # guide pour passer à un paiement Wave réel
```

---

## 🛠️ Notes techniques

- **Framework** : Expo SDK 57 (React Native 0.86 + React 19).
- **Web** : l'app se rend aussi sur navigateur via `react-native-web` (aucun module natif requis).
- **Paiement Wave** : `WaveModal` simule les étapes *Vérification → Traitement → Succès*.
  C'est le point de remplacement par l'API réelle (voir le guide).
- **Compte à rebours** des demandes : calcul en direct, se met à jour chaque seconde.
- Les données sont **en mémoire** (rechargées à chaque redémarrage de la page).

---

### En production (app installable — PWA)

L'app est aussi **installable** comme une app native sur mobile (iOS et Android) :

```bash
npm run build:web    # build web + PWA (manifest, icônes, service worker)
node serve.js        # sert l'app (dist/) + proxifie /api -> http://localhost:8080
```

- **iOS (iPhone)** : ouvrir le lien dans Safari → **Partager** → **« Sur l'écran d'accueil »**.
  L'app se lance alors **plein écran**, avec son logo, comme une vraie app.
- **Android** : ouvrir le lien → **Installer l'application** (proposé automatiquement),
  ou via le menu du navigateur. Elle s'ajoute à l'écran d'accueil.

Une seule app (web) qui **se comporte comme une app native** sur les deux plateformes.

## 🧩 Backend (paiement Wave + base de données)

Un **backend Node/Express complet** est inclus dans `server/`, avec une **base de données**
et une **passerelle Wave** (mockée par défaut, prête à être branchée sur `api.wave.com`).
Il expose toute l'API : comptes, demandes, abonnements, soldes et retraits.

```bash
cd server
npm install
node src/index.js        # API sur http://localhost:4000
node test.js             # 16 tests de bout en bout (mode Wave mock)
```

Voir **`server/README.md`** pour le détail des routes et `WAVE_INTEGRATION.md` pour brancher
le vrai Wave.

---

## 🔌 Front-end connecté à l'API

Le prototype est maintenant **relié au backend** : quand **l'API est joignable**, l'app joue
avec les vraies données du serveur ; sinon, elle bascule automatiquement sur la **démo locale**
(les données en mémoire). Une pastille en haut à gauche de chaque espace indique le mode :
🟢 **Connecté à l'API** / ⚪ **Mode démo**.

### Lancer tout l'ensemble
```bash
# 1) Backend (dans un terminal)
npm run api                 # -> http://localhost:4000

# 2) Front (dans un autre terminal)
npx expo start --web        # serveur de dev Expo (avec le proxy API intégré par Metro)
#  ou, pour un aperçu façon production :
npm run preview             # build web + serveur (app + proxy /api) -> http://localhost:8080
```

En web dev (`expo start --web`), Metro proxyfie déjà `/api` vers le backend. En production,
`serve.js` fait la même chose sur un seul port. Il n'y a donc **pas de problème de CORS**.

> Pour tester sur téléphone avec `expo start`, renseigne l'IP de ta machine dans
> `src/config.js` (`detectBaseUrl`) pour que l'API soit joignable depuis l'appareil.

---

## Prochaines étapes (production)

1. ✔️ Relier l'app mobile au backend — **fait** (bascule auto API / démo).
2. Authentification réelle (téléphone + mot de passe / OTP) — déjà côté API.
3. Intégration **Wave Business API** pour les paiements réels (voir guide).
4. Notifications push pour signaler les demandes au gérant.
5. Passer la base JSON à **Postgres** (module `db.js` prêt à être remplacé).
6. **Persister la session** (garder le JWT au redémarrage pour rester connecté).
