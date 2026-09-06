# Guide d'intégration Wave — passer du prototype au paiement réel

Dans le prototype, le paiement **Wave** est **simulé** (`WaveModal`). Ce guide explique ce
qu'il faut faire pour le remplacer par de **vrais paiements Wave** quand tu auras un compte
**Wave Business** et tes **clés API**.

> ⚠️ Les données de l'app sont aujourd'hui **locales** (en mémoire). Une intégration réelle
> suppose un **backend** (API + base de données). Les exemples ci-dessous partent du principe
> que l'app mobile appelle **ton serveur**, et que c'est ton serveur qui appelle Wave.

---

## 1. Prérequis

1. Un compte **Wave Business** ([wave.com/business](https://www.wave.com/business)) — c'est
   ce qui donne accès à un **portefeuille business** et aux API.
2. Des **clés API** scopes par API (une clé par API : Checkout, Payout, Balance…). Elles sont
   de la forme `wave_xx_...` (sandbox) / `wave_xx_prod_...` (production).
3. **Autoriser ton IP** (allowlisting) si tu veux, et noter ton **URL de webhook** publique.
4. La **documentation officielle** : [`docs.wave.com`](https://docs.wave.com).

Les comptes et clés de test se gèrent dans le portail Wave Business. C'est **toi** qui obtiens
ces accès — je ne peux pas les créer pour toi.

---

## 2. Les 4 briques de l'API Wave

| API | À quoi ça sert | Endpoint principal |
|-----|----------------|--------------------|
| **Checkout** | Encaisser un client via une session de paiement hébergée (le client confirme dans l'app Wave) | session de paiement + webhook |
| **Payout** | Envoyer de l'argent à un **numéro mobile** (payer le gérant, retraits) | `POST /v1/payout`, `POST /v1/payout-batch` |
| **B2B Payout** | Payer un **autre business** (id `recipient_id`) | `POST /v1/b2b/payout` |
| **Balance & Reconciliation** | Solde du portefeuille + lister les transactions + remboursements | `GET /v1/balance`, `GET /v1/transactions`, `POST /v1/transactions/:id/refund` |

Les **Webhooks** sont signés en **HMAC-SHA256** (à vérifier côté serveur) et vous notifient
en temps réel du résultat d'un paiement.

Points clés :
- **Idempotence** : les `POST` de mutation acceptent une clé `Idempotency-Key` (à fournir). Envoie toujours une clé unique par opération.
- **Devise** : `XOF` (ton portefeuille et le destinataire doivent être dans **le même pays**).
- **Téléphone** : avec **code pays** (ex. `+225` pour la Côte d'Ivoire, `+221` Sénégal…).

Exemple de Payout (source docs.wave.com) :

```bash
curl -X POST \
  --url https://api.wave.com/v1/payout \
  -H "authorization: Bearer wave_ci_prod_YhUNb9d...i4bA6" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: 65f735b4-b44b-429d-b0a8-550701e2393a' \
  -d '{
        "currency": "XOF",
        "receive_amount": "5000",
        "name": "Boutique Amadou",
        "mobile": "+225771234567",
        "client_reference": "demande_12345"
      }'
```

Réponse : `{ "id": "po-xxxxx", "status": "processing|succeeded|failed" }`.

---

## 3. Architecture conseillée

```
App mobile (React Native / Expo)
        │  (API JSON + jeton d'auth de l'utilisateur)
        ▼
Ton backend (Node/Express)  ←  base de données (clients, gérants, demandes, paiements, solde)
        │  (appels API Wave : Checkout, Payout, Balance)
        ▼
Wave Business wallet
        │   webhook signé (HMAC) → résultat du paiement
        ▼
Ton backend (mise à jour du statut + crédit du gérant)
```

**Règle** : tu ne fais **jamais** confiance au montant envoyé par l'app mobile. Le montant
« autorisé » est recalculé côté serveur ; le client **confirme le montant réel** dans l'app Wave.

---

## 4. Mapping des écrans du prototype vers l'API réelle

### A. Abonnement (client paie un forfait)
1. App → `POST /api/subscribe` (montant calculé en base, pas depuis l'app).
2. Serveur → **Checkout** Wave : crée une session de paiement du montant du forfait.
3. Client confirme **dans son app Wave** (ou via l'URL hébergée).
4. Wave envoie un **webhook `payment.succeeded`** (type `api_checkout`).
5. Serveur vérifie la signature HMAC → **active l'abonnement** + journalise la transaction.

### B. Paiement direct au gérant (demande de recharge)
1. App → `POST /api/demandes` (type, montant, bénéficiaire, gérant).
2. Serveur → **Checkout** Wave depuis le client (montant de la demande) **+** prépare le
   `client_reference` (= `demande_id`).
3. Une fois le paiement client confirmé (webhook) → serveur fait un **Payout** au numéro du
   gérant (ou **B2B Payout** si le gérant a un compte business) avec le même `client_reference`.
4. La demande passe à **en attente** ; quand le gérant confirme le traitement, elle est close.

### C. Retrait du gérant
1. App → `POST /api/withdraw` (montant demandé).
2. Serveur vérifie le solde du gérant en base → **Payout** `POST /v1/payout` vers son numéro.
3. Webhook `payout.succeeded` → débit du solde + transaction dans l'historique.

### D. Solde / historique / réconciliation
- `GET /v1/balance` et `GET /v1/transactions` pour rapprocher le portefeuille.
- Les **webhooks** restent la source de vérité temps réel (pas l'interrogation polling).

---

## 5. Exemple backend (Node/Express)

### 5.1 Vérifier un webhook Wave (HMAC-SHA256)

> Vérifie toujours la signature avant de créditer/débiter. (Référence à adapter selon la doc
> officielle de `docs.wave.com` : l'en-tête de signature et le préfixe secret.)

```js
import crypto from 'crypto';

app.post('/webhook/wave', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-wave-signature'];        // adapter l'en-tête réel
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  const body = req.body.toString('utf8');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ ok: false });
  }

  const event = JSON.parse(body);
  // event.type === 'payment.succeeded' | 'payout.succeeded' | 'payout.failed' ...
  handleEvent(event);
  res.json({ ok: true });
});
```

### 5.2 Encaisser un client (Checkout) — schéma

```js
const session = await wave.checkout.create({
  amount: { currency: 'XOF', value: 5000 },
  client_reference: 'demande_12345',        // ce que tu veux rapprocher
  metadata: { userId, demandeId, gerantId },
  redirect_url: 'https://ton.app/validation',
});
// renvoie session.checkout_url -> le client confirme dans Wave
```

### 5.3 Créditer le gérant (Payout) — après encaissement

```js
await wave.payout.create({
  currency: 'XOF',
  receive_amount: 4800,                     // net de frais
  name: gerant.name,
  mobile: `+225${gerant.phone}`,
  client_reference: `demande_${demandeId}`,
}, { idempotencyKey: `payout_${demandeId}` });
```

---

## 6. Sécurité (à appliquer)

- **Vérifier la signature des webhooks** (HMAC) — ne jamais faire confiance à une URL ouverte.
- **Idempotency-Key** sur tous les POST : évite les doubles débits/remboursements.
- Recalcul du montant **côté serveur** ; utilise `client_reference` pour rapprocher.
- Ne stocke pas les clés Wave dans l'app mobile ; elles restent **côté serveur** (variables d'environnement).
- Limite le nombre de demandes par utilisateur, vérifie que le gérant est **en ligne** avant d'envoyer.
- Gère les cas **`failed`** (webhook d'échec) : rembourse/annule la demande et informe l'utilisateur.
- **Bonus** : tu peux brancher la Payout API via un **agrégateur** (`aggregated_merchant_id`) si tu veux gérer plusieurs gérants sous un seul compte.

---

## 7. Étapes pour passer en production

1. Créer le compte **Wave Business** et générer les clés (sandbox puis prod).
2. Mettre en place un **backend** (Node/Express + Postgres) avec les utilisateurs, gérants,
   demandes, abonnements et le journal des paiements.
3. Remplacer chaque `dispatch(...)`/`WaveModal` simulé par un appel à ton backend, qui appelle Wave.
4. Brancher les **webhooks** pour mettre à jour les statuts et créditer les gérants.
5. Tester en **mode sandbox**, puis basculer en production.

---

## 8. Ce qu'il te faut de mon côté pour la suite

Pour que je puisse câbler le **vrai** Wave, il me faudra :

- La **base de l'API Wave** (schéma exact de la session Checkout + l'en-tête de signature des webhooks) — je te ferai l'implémentation exacte à partir de `docs.wave.com` dès que tu auras les accès.
- Ton choix : **portefeuille plateforme** (recommandé) ou **paiement direct P2P**.
- Si tu veux, je peux générer le **backend Node/Express** + le modèle de données maintenant, en gardant Wave **mocké**, prêt à être branché.
