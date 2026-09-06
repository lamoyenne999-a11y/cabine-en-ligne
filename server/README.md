# Cabine En Ligne — Backend API (Node/Express)

API REST qui fait tourner **Cabine En Ligne** : comptes clients/gérants, demandes de
service (unités / minutes / internet), abonnements, et **liens de profil publics**.

> ⚠️ **Modèle v2 — zéro argent stocké sur l'app.** Le backend n'a **ni solde, ni caisse,
> ni rechargement, ni retrait**. Les paiements se font **en direct via Wave** entre le
> client (compte Wave normal) et le gérant (Wave marchand). L'app ne fait que montrer le
> numéro Wave marchand. La passerelle Wave est **mockée** par défaut (`WAVE_MODE=mock`) ;
> pour le réel, voir `WAVE_INTEGRATION.md`.

---

## 🚀 Lancer

```bash
cd server
npm install
node src/index.js          # ou : npm run dev
```

Par défaut l'API écoute sur **`http://localhost:4000`**. La base est un **fichier JSON**
(`server/data/db.json`), recréée automatiquement si absente.

### Lancer les tests de bout en bout (21 tests v2)
```bash
node test.js        # API par défaut : http://localhost:4000
```

---

## 🔌 Routes

### Santé
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | État + mode Wave |

### Authentification (identifiant = téléphone)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Créer un compte `{ role, name, phone, email?, password }` → essai gratuit 30 j |
| POST | `/api/auth/login` | Connexion `{ phone, password }` |
| GET | `/api/auth/me` | Profil courant (JWT) |

### Profil public (liens de partage, **sans authentification**)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/public/u/:id` | Profil public d'un utilisateur (nom, téléphone, Wave marchand, rôle) |

### Côté Client (`/api/client`, jeton client requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/gerants` | Gérants ajoutés par le client |
| POST | `/gerants` | Ajouter un gérant `{ phone, name }` |
| DELETE | `/gerants/:id` | Retirer un gérant |
| POST | `/demandes` | **Nouvelle demande** `{ gerantId, type, amount, benefName?, benefPhone? }` |
| GET | `/demandes` | Demandes du client (+ `summary`) |
| GET | `/history` | **Historique** : demandes + `summary` (`totalSpent`, comptages par statut) |
| POST | `/demandes/:id/paid` | Le client a payé via Wave (paiement direct) |
| GET | `/subscription` | Abonnement (essai actif restant) |
| POST | `/subscribe` | Activer l'abonnement (100 FCFA / mois) |

### Côté Gérant (`/api/gerant`, jeton gérant requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/demandes` | Demandes reçues (en attente) + `summary` |
| GET | `/history` | **Historique** : demandes + `summary` (`totalServed`, comptages par statut) |
| POST | `/demandes/:id/accept` | **Accepter** |
| POST | `/demandes/:id/decline` | **Refuser** |
| POST | `/demandes/:id/complete` | **J'ai servi le client** (crédité) |
| GET | `/profile` | Nom + téléphone + Wave marchand |
| GET | `/subscription` | Abonnement |
| POST | `/subscribe` | Activer l'abonnement |
| GET | `/public/:id` | Profil public (même API que /api/public/u/:id) |

---

## 💰 Cycle d'une demande (zéro argent sur l'app)

```
CLIENT crée une demande (pending)
   └─ GÉRANT voit la demande en attente → ACCEPTE (accepted) ou REFUSE (declined)

CLIENT accepté → paie EN DIRECT via son app Wave au numéro Wave marchand du gérant
   └─ CLIENT appuie sur « J'ai payé »  →  demande : paid

GÉRANT a crédité le client → « J'ai servi le client »  →  demande : completed
```

Le montant ne transite jamais par `cabine-en-ligne` : le client paie son propre compte
Wave, le gérant reçoit sur son **Wave marchand**.

---

## 🗄️ Persistance

- **JSON** (dev/tests) : `server/data/db.json`.
- **PostgreSQL** (production) : définis `DATABASE_URL`. Le module `db.js` propose les mêmes
  opérations (`getDb`, `save`, `insert`, `find`, `findOne`, `update`, `remove`) et expose
  les collections `users`, `gerants`, `demandes`.

```js
// users   : { id, role: client|gerant, name, phone, email, passwordHash, waveNumber,
//            subscription: { status: trial|active|expired, trialEndsAt, subscribedUntil }, createdAt }
// gerants : { id, ownerId (client), userId (gérant), name, phone, waveNumber, rating, online }
// demandes: { id, ref, clientId, clientName, clientPhone, gerantId, gerantUserId,
//            gerantName, gerantPhone, gerantWave, type: unites|minutes|internet, amount,
//            benefName, benefPhone, status: pending|accepted|declined|paid|completed,
//            createdAt, acceptedAt, paidAt }
```

---

## 🔐 Config (`.env`)

Copie `.env.example` vers `.env` et adapte :
- `JWT_SECRET` : **à changer** en production.
- `WAVE_MODE=mock` (démo) ou `live` (réel).
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` : en mode live.
- `PHONE_PREFIX=+225` (Côte d'Ivoire) ou `+221` (Sénégal), etc.
