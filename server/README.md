# Cabine En Ligne — Backend API (Node/Express)

API REST qui fait tourner **Cabine En Ligne** : comptes clients/gérants, demandes de
recharge, abonnements, soldes et **paiements Wave**.

> Le paiement Wave est **mocké** par défaut (`WAVE_MODE=mock`) : la simulation reproduit
> fidèlement le cycle *Checkout → webhook → Payout* sans toucher au réseau. Pour passer au
> vrai Wave, mets **`WAVE_MODE=live`** et tes clés API (voir `WAVE_INTEGRATION.md`).

---

## 🚀 Lancer

```bash
cd server
npm install
node src/index.js          # ou : npm run dev
```

Par défaut l'API écoute sur **`http://localhost:4000`**. La base est un **fichier JSON**
(`server/data/db.json`), recréée automatiquement si absente.

### Lancer les tests de bout en bout
```bash
node test.js        # 16 vérifications, mode Wave mock
```

---

## 🔌 Routes

### Santé
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | État + mode Wave |

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Créer un compte `{ role, name, phone, email?, password }` |
| POST | `/api/auth/login` | Connexion `{ phone, password }` |
| GET | `/api/auth/me` | Profil courant (JWT) |

### Côté Client (`/api/client`, jeton client requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/gerants` | Gérants disponibles |
| POST | `/gerants` | Ajouter un gérant |
| DELETE | `/gerants/:id` | Supprimer un gérant |
| POST | `/demandes` | **Nouvelle demande** → déclenche un **Checkout Wave** (paiement direct au gérant) |
| POST | `/subscribe` | **S'abonner** via Wave |
| GET | `/subscription` | Abonnement actif |
| GET | `/history` | Transactions du client |
| GET | `/balance` | Solde client |

### Côté Gérant (`/api/gerant`, jeton gérant requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/dashboard` | Solde + stats + revenus |
| GET | `/demandes` | Demandes à traiter |
| POST | `/demandes/:id/confirm` | **Confirmer** → crédite le solde du gérant |
| GET | `/clients` | Clients du gérant |
| POST | `/clients` | Ajouter un client |
| DELETE | `/clients/:id` | Supprimer un client |
| GET | `/history` | Transactions du gérant |
| GET | `/balance` | Solde CEL du gérant |
| POST | `/withdraw` | **Retirer via Wave** (vérifie le solde + Payout) |

### Webhooks Wave
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/webhooks/wave` | Reçoit les événements Wave réels (signature HMAC vérifiée) |

---

## 💰 Flux de paiement (mock == réel)

```
CLIENT paie (Checkout)  →  webhook "payment.succeeded"
   ├─ demande de recharge : la demande passe à "payée", la transaction client à "réussie"
   └─ abonnement          : l'abonnement est activé

GÉRANT confirme le traitement  →  son solde CEL est crédité du montant de la demande

GÉRANT retire  →  vérif du solde + Payout Wave
   ├─ "payout.succeeded" : transaction "réussie"
   └─ "payout.failed"    : transaction "annulée" + solde remboursé
```

---

## 🛠️ Structure

```
server/
├─ src/
│  ├─ index.js           # démarrage
│  ├─ app.js             # assemble l'app Express + branche les webhooks Wave
│  ├─ config.js          # variables d'environnement (.env)
│  ├─ db.js              # persistance (JSON) — remplaçable par Postgres
│  ├─ middleware/
│  │  ├─ auth.js         # JWT + rôles + hash de mot de passe
│  │  └─ error.js
│  ├─ routes/            # auth, client, gerant, webhooks
│  └─ services/
│     ├─ waveService.js  # ⭐ passerelle Wave (mock / live) + HMAC
│     └─ flowService.js  # logique métier des événements Wave
├─ test.js               # tests de bout en bout
├─ .env.example
└─ package.json
```

---

## 🔐 Config (`.env`)

Copie `.env.example` vers `.env` et adapte :
- `JWT_SECRET` : **à changer** en production.
- `WAVE_MODE=mock` (démo) ou `live` (réel).
- `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` : en mode live.
- `PHONE_PREFIX=+225` (Côte d'Ivoire) ou `+221` (Sénégal), etc.

---

## 🗄️ Passer en base de données réelle

Le module `db.js` stocke tout dans un fichier JSON pour la simplicité. Pour la production,
remplace son contenu par un client SQL (Postgres) en exposant les **mêmes fonctions** :
`getDb`, `save`, `insert`, `find`, `findOne`, `update`, `remove`. Le reste du backend n'a
pas à changer.
