# Cabine En Ligne — App web + PWA

Application **simple** qui connecte des **clients** (particuliers qui veulent acheter des
**unités**, des **minutes** ou de l'**internet**) et des **gérants de cabines** qui traitent
ces demandes et se font **payer en direct via Wave**.

> ⚠️ **L'app ne stocke JAMAIS d'argent.** Elle ne joue pas le rôle d'un portefeuille mobile
> ni d'une agence. Elle **met en relation** clients et gérants : le client paie avec son
> propre compte **Wave** (numéro normal), le gérant reçoit sur son **Wave marchand**.
> L'app affiche simplement le **numéro** auquel envoyer l'argent. → aucune caisse, aucun solde,
> aucun rechargement, aucun retrait sur l'app.

---

## ✨ Fonctionnalités (v2 — simple)

- **Connexion par numéro de téléphone** (le numéro est l'identifiant).
- **1 mois d'essai gratuit**, puis **abonnement 100 FCFA / mois**.
- Les **clients ajoutent / retirent des gérants librement**.
- Chaque utilisateur a un **lien de profil public** à partager → les autres vous trouvent,
  vous ajoutent et vous envoient des demandes.
- Les **clients créent des demandes** de **unités / minutes / internet** (montant,
  bénéficiaire, gérant).
- Les **gérants reçoivent la demande directement** et **acceptent ou refusent**.
- **Paiement en direct via Wave** : l'app montre le numéro Wave marchand + « J'ai payé ».
  Le gérant indique ensuite qu'il a servi le client.
- **Historique & totaux** : chaque utilisateur a un onglet **Historique**.
  - **Client** : toutes ses transactions + **total dépensé** et statistiques par statut.
  - **Gérant** : toutes les demandes traitées + **total servi** et statistiques par statut.
- **PWA installable** sur iPhone et Android — une seule app web.

---

## 🚀 Lancer en local

```bash
cd cabine-en-ligne
npm install                        # (node_modules non sauvegardé : à refaire après redémarrage)

# 1) Backend (API) — terminal 1
npm run api                        # -> http://localhost:4000

# 2) Application (aperçu façon production) — terminal 2
npm run preview                    # build web + PWA, sert l'app + proxy /api -> http://localhost:8080
```

> En dev interactif tu peux aussi : `npx expo start --web`.
> Le serveur de prévisualisation (`serve.js`) sert `dist/` et proxifie `/api` → `:4000`,
> donc **pas de CORS** (même origine). En mode web l'app appelle l'API en relatif (`/api`).

---

## 👤 Comptes de démonstration

| Rôle | Numéro | Mot de passe | Statut |
|------|--------|--------------|--------|
| **Client** | `0101010101` | `demo123` | ✅ fonctionnel (bouton « Utiliser » sur l'écran de connexion) |

> Il n'y a **pas de compte gérant de démonstration** : seuls les gérants **réellement inscrits**
> (avec un mot de passe) apparaissent dans les listes des clients, pour éviter les faux gérants.
> Pour tester côté gérant, **créez un compte gérant** via « S'inscrire ».

---

## 📝 Créer un compte

Depuis l'écran **Connexion** → **« S'inscrire »**. Renseigne le **nom** (ou nom de cabine
pour un gérant), ton **numéro de téléphone** et un mot de passe (≥ 4 caractères, confirmé).
Tu bénéficies immédiatement de **1 mois d'essai gratuit**.

---

## 🎮 Parcours à tester (bout en bout)

**Côté Client**
1. **Accueil** : vois ton abonnement (essai actif) et crée une **Nouvelle demande**.
2. Choisis **Unités / Minutes / Internet**, saisis un montant, choisis le bénéficiaire
   (`Pour moi` ou `Pour quelqu'un`) et **un gérant**, puis **Envoyer la demande**.
3. **Historique** : la transaction apparaît (En attente → À payer → Payée → Complétée),
   avec le **total dépensé** en tête.
4. **Gérants** : ajoute / retire des gérants (ou via ton **lien de profil** partagé).

**Côté Gérant**
1. Connecte-toi comme **gérant** (ex. `771234567` / `demo123`).
2. **Demandes** : la demande apparaît → **Accepter** ou **Refuser**.
3. Une fois acceptée, le client va « payer » → le gérant voit « Payée » → **J'ai servi le client**.
4. **Historique** : toutes les demandes traitées + **total servi**.

**Paiement** : quand la demande est acceptée, le client ouvre son app **Wave**, envoie le
montant au **numéro Wave marchand** affiché, puis appuie sur **« J'ai payé »**. Le gérant
reçoit l'argent sur son Wave marchand. **Aucun argent ne transite par l'app.**

> 💡 **Lien de partage** : depuis **Profil**, copie ton lien (`https://…/?u=ID`). Quiconque
> l'ouvre voit ta page publique et peut **t'ajouter** et **transacter** avec toi.

---

## 📁 Structure du projet

```
cabine-en-ligne/
├─ App.js                  # racine : Welcome → Login/Signup → Client / Gérant + ?u=ID (profil public)
├─ src/
│  ├─ api.js               # client HTTP (auth, public, client, gérant)
│  ├─ store.jsx            # état global + bascule auto API / démo locale
│  ├─ config.js            # API_URL + buildShareUrl()
│  ├─ theme.js             # palette, espacements, helpers
│  ├─ components/
│  │  ├─ ui.jsx            # T, Card, Btn, Field, Pill, Segmented, ListRow…
│  │  ├─ Shell.jsx         # Header / Page / TabBar
│  │  ├─ WavePay.jsx       # WavePaySheet : montre le numéro marchand + « J'ai payé »
│  │  ├─ modals.jsx        # BottomSheet + Dialog
│  │  ├─ Logo.jsx          # logo officiel (assets/cabine-logo.png)
│  │  └─ ConnectionBadge.jsx
│  └─ screens/
│     ├─ Welcome.jsx / Login.jsx / Signup.jsx / PublicProfile.jsx
│     ├─ client/  (ClientApp, ClientHome, ClientHistory, ClientGerants, ClientProfile)
│     └─ gerant/  (GerantApp, GerantDemandes, GerantHistory, GerantProfile)
└─ server/                 # backend Express + base + passerelle Wave (mock)
```

---

## 🧩 Backend

Backend **Node/Express** dans `server/`, avec base **JSON** (dev) ou **PostgreSQL**
(production, `DATABASE_URL`), et passerelle **Wave** (mock par défaut, prête pour
`api.wave.com`).

```bash
cd server
npm install
npm run test:api            # node test.js — 21 tests v2 (mode Wave mock)
node src/index.js           # API sur http://localhost:4000
```

Le **modèle de données v2** (zéro argent) :

- `users` : `{ id, role: client|gerant, name, phone, email, passwordHash, waveNumber,
  subscription: { status: trial|active|expired, trialEndsAt, subscribedUntil }, createdAt }`
- `gerants` : `{ id, ownerId (client), userId (gérant), name, phone, waveNumber, rating, online }`
- `demandes` : `{ id, ref, clientId, clientName, clientPhone, gerantId, gerantUserId,
  gerantName, gerantPhone, gerantWave, type: unites|minutes|internet, amount, benefName,
  benefPhone, status: pending|accepted|declined|paid|completed, createdAt, acceptedAt, paidAt }`

---

## 📲 Installer comme app (PWA)

Une seule app web, installable sur les deux plateformes :

```bash
npm run build:web           # build web + PWA (manifest, icônes, service worker)
node serve.js               # sert dist/ + proxifie /api -> http://localhost:8080
```

- **iOS (iPhone)** : ouvre le lien dans **Safari** → **Partager** → **« Sur l'écran d'accueil »**.
- **Android** : ouvre le lien → **Installer l'application** (proposé automatiquement).

---

## 🔌 Bascule auto API / démo locale

Quand **l'API est joignable**, l'app travaille avec les vraies données du serveur ; sinon
elle bascule sur la **démo locale** (données en mémoire). La **connexion** et la **création
des comptes** restent donc utilisables même sans API.

---

## Intégration Wave réelle

Voir **`WAVE_INTEGRATION.md`** pour brancher la passerelle sur `api.wave.com`
(Checkout, Payout, Webhooks HMAC-SHA256, pays CI `+225`).
