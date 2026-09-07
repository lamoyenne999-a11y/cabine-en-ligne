# Plan de montée en charge — Cabine En Ligne

> **But de ce document** : savoir *combien d'utilisateurs* l'appli peut contenir
> au stade actuel, et *quoi faire* pour passer à l'échelle quand on approche du plafond.
> Ce n'est pas une action à faire maintenant — c'est la feuille de route à ouvrir
> quand les chiffres montent.

---

## 1. Architecture actuelle (le point de départ)

### Couches
- **Front** : PWA React Native (Expo) — statique, servi par Render.
- **API** : Express (Node), un seul service, sur Render.
- **Base** : PostgreSQL (Render), mais *utilisée comme un simple conteneur de stockage*.

### Le point structurant ⚠️
Toute la base est gardée **en RAM dans un seul objet JavaScript** et **réécrite en un
seul enregistrement PostgreSQL** à chaque action :

```js
// db.js — persistToPg()
INSERT INTO app_state (key, data) VALUES ('app', JSON.stringify(db))  // TOUTE la base
```

Conséquence : **chaque action** (lire une notification, payer, créer une demande)
réécrit **100 % des données**. Le coût grandit linéairement avec la taille totale,
pas avec la ligne concernée. Et parce que `JSON.stringify` est **synchrone**, il
**bloque le serveur entier** quelques dizaines/centaines de millisecondes par écriture.

---

## 2. Capacité mesurée (benchmark réel sur des données réalistes)

Simulation réaliste : chaque utilisateur génère ~20-50 demandes, quelques notifications,
un abonnement, des événements de journal.

| Nb d'utilisateurs | Taille DB | Coût d'**1** écriture | Verdict |
|---|---|---|---|
| 1 000 | 8,1 Mo | ~24 ms | 🟢 Excellent |
| 2 500 | ~30 Mo | ~130 ms | 🟢 Bien |
| 5 000 | 59,5 Mo | ~256 ms | 🟡 Moyen (à-coups) |
| 10 000 | 119 Mo | ~561 ms | 🔴 Lent / blocages |
| 25 000+ | — | — | 🔴 **OOM / crash** |

> Le benchmark a réellement fait un **"JavaScript heap out of memory"** vers ~25 000 users.

### Le cap à retenir
- **Zone de confort total** : **≈ 1 500 à 2 000 utilisateurs actifs**.
- **Plafond de cette architecture** : **≈ 8 000 à 10 000 utilisateurs en activité**.

Ce n'est **pas** un problème de **stockage** (Postgres gratuit = ~1 Go = ~50-60 000 users).
C'est un problème de **mémoire** + **amplification d'écriture**.

### Second facteur : le front
Les écrans *Historique* et *Journal* renvoient **toutes** les lignes (pas de pagination).
Un gros historique devient lourd à charger et à chercher côté appareil.

---

## 3. Quand agir ?

| Objectif business | À faire |
|---|---|
| Lancer à Abidjan (100 → 1 500 users) | **Rien.** L'app est largement en deçà de ses limites. |
| Croissance (2 000 → 5 000 users) | Prévoir la refonte base **+** pagination. |
| Place de marché sérieuse (10 000 → 50 000+ users) | Refonte base **obligatoire** + montée d'infrastructure. |

**Règle simple** : tant que tu vises des centaines / quelques milliers d'utilisateurs,
ne touche à rien. Ouvre ce plan quand le compteur **Base de données** (Espace propriétaire)
dépasse ~2 500 lignes.

---

## 4. La refonte : passage en vraies tables PostgreSQL

Le changement décisif : **abandonner l'objet JSON unique** pour de **vraies tables + index**.

### Modèle cible (exemple)
```sql
CREATE TABLE users (
  id text PRIMARY KEY, name text, phone text UNIQUE, role text,
  password_hash text, referral_code text, referred_by text, country text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE demandes (
  id text PRIMARY KEY, client_id text REFERENCES users(id),
  gerant_user_id text, type text, amount int, benef_name text, benef_phone text,
  status text, created_at timestamptz, expires_at timestamptz
);
CREATE TABLE notifications (
  id text PRIMARY KEY, user_id text REFERENCES users(id), title text,
  body text, read boolean DEFAULT false, created_at timestamptz
);
CREATE TABLE subscriptions (
  id text PRIMARY KEY, user_id text, plan text, amount int, reference text,
  paid_at timestamptz, subscribed_until timestamptz
);
CREATE TABLE events (
  id text PRIMARY KEY, type text, name text, phone text, role text,
  amount int, plan text, reference text, created_at timestamptz
);
CREATE INDEX idx_demandes_client ON demandes(client_id);
CREATE INDEX idx_demandes_created ON demandes(created_at DESC);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id);
```

### Pourquoi c'est gagnant
- **Écriture ciblée** : `INSERT` / `UPDATE ... WHERE id = $1` — on ne réécrit **plus** toute la base.
- **Index** : lecture de l'historique d'un seul utilisateur en quelques ms, même avec 50 000 users.
- **Mémoire** : plus de gros objet en RAM → plus de risque OOM.
- **Concurrence** : PostgreSQL gère les écritures simultanées proprement (perte de l'isolation JSON).

### Stratégie de migration (sans casser la prod)
1. Créer les tables via `ensureSchema` (idempotent, `CREATE TABLE IF NOT EXISTS`).
2. Garder l'objet JSON **en lecture seule** pendant la transition, écrire dans les tables.
3. Migration par lots : copier `users`, puis `demandes`, etc. (une table à la fois).
4. Basculer les fonctions de `flowService` sur les nouvelles requêtes PostgreSQL.
5. Tester en local (JSON) + CI, puis déployer.

> Astuce : les collections actuellement dans `db.js` (`users, gerants, demandes,
> notifications, subscriptions, referrals, events`) correspondent **1 pour 1** aux tables
> à créer — la migration est mécanique.

---

## 5. Pagination (front + API)

Remplacer le renvoi de **tout** l'historique/journal par des pages.

- **API** : `GET /api/client/history?offset=0&limit=20` → `{ items, total, hasMore }`.
- **Front** : liste + bouton « Charger plus » (ou scroll infini).
- Avantage immédiat : même **sans** la refonte base, ça allège le chargement et la
  recherche côté appareil.

Combiner avec la recherche déjà ajoutée : filtre côté serveur (`WHERE client_id=$1
AND (name ILIKE '%q%' OR ...)`) pour ne remonter que les lignes utiles.

---

## 6. Infrastructure (quand on dépasse ~10 000 users)

| Étape | Action |
|---|---|
| Base | Passage du plan Postgres gratuit (~1 Go) à un plan payant (plus de RAM + connexions). |
| Service | Montée du Web Service Render (mémoire dédiée), ou 2 instances derrière un load-balancer. |
| Async | Déplacer l'envoi de notifications / le traitement hors du chemin de requête (queue). |
| Cache | Cache Redis pour les lectures fréquentes (référentiel gérants, profils publics). |
| Observabilité | Logs structurés + monitoring de la latence (ex. UptimeRobot, Sentry, Grafana). |

---

## 7. Ce qui est déjà en place (bonnes nouvelles)

- ✅ **Zéro argent stocké** sur l'app (modèle "mise en relation") — la base reste légère.
- ✅ **Base vide** au départ : le premier utilisateur ne partage aucune donnée.
- ✅ **Compteur de base** ajouté à l'Espace propriétaire pour suivre la charge en direct.
- ✅ **Recherche** dans les historiques (client + gérant), insensible aux accents/casse.
- ✅ **Journal d'activité** pour suivre entrées/sorties, paiements, parrainages.

---

## 8. En une phrase

> **Vous pouvez lancer et croître jusqu'à quelques milliers d'utilisateurs sans rien changer.
> Le vrai plafond de l'architecture actuelle est d'environ 8 000 à 10 000 utilisateurs en
> activité, levé par une migration vers de vraies tables PostgreSQL + une pagination —
> soit environ une journée de travail à planifier, pas une urgence à gérer maintenant.**
