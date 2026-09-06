# Tester Cabine En Ligne

Guide pas-à-pas pour tester l'app **connectée** (front + backend + Wave mocké).

---

## 🔎 Connexion des comptes de démonstration

| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| **Client** | `0101010101` | *(vide / n'importe lequel)* |
| **Gérant** | `0202020202` | *(vide / n'importe lequel)* |

> La pastille en haut à gauche doit être **🟢 « Connecté à l'API »** pour tester le mode
> connecté (données du serveur). Si elle est ⚪ « Mode démo », l'API n'est pas joignable.

---

## ✅ Parcours Gérant

1. Accueil → **Je suis Gérant** → **Se connecter** (`0202020202`).
2. **Tableau de bord** : solde CEL **45 000 XOF** (serveur).
3. **Demandes** : 2 demandes en attente (avec compte à rebours).
4. **Confirmer la demande** → OK.
5. **Tableau de bord** : le solde **augmente** d'un gain.
6. **Historique** : le gain apparaît ; **Retirer via Wave** → le solde diminue.

---

## ✅ Parcours Client

1. Accueil → **Je suis Client** → **Se connecter** (`0101010101`).
2. **Accueil** : type (Unités/Minutes/Internet) + montant + `Pour moi` + un gérant en ligne.
3. **Envoyer la demande** → fenêtre **Wave** → **Confirmer**.
4. **Historique** : la transaction apparaît puis passe à **Réussi**.
5. **Abonnements** → payer un forfait via Wave → activation.

---

## 🧪 Test bout-en-bout (le plus important)

1. **Client** envoie une demande à « Cabine Moussa » (en ligne) et **paie via Wave**.
2. **Déconnexion** → connexion **Gérant** (`0202020202`).
3. **Demandes** → la demande du client est là → **Confirmer**.
4. **Déconnexion** → connexion **Client** → **Historique**.
   - ✅ La transaction est passée à **Réussi**.
   - ✅ Le solde gérant a été crédité (visible si tu te reconnectes en gérant).

C'est la preuve que front et backend partagent la **même base** (`server/data/db.json`).

---

## ⚠️ Ce qui est réel / simulé

| Élément | Statut |
|---|---|
| Comptes, soldes, demandes, abonnements, historique | ✅ Réel (API + base) |
| Login / inscription (JWT + hash bcrypt) | ✅ Réel |
| Paiement **Wave** | ⚙️ Simulé (mock) |

Passer en réel : `WAVE_MODE=live` + clés API → voir `WAVE_INTEGRATION.md`.

---

## 🛠️ Relancer / tester hors aperçu

```bash
npm run api          # backend   -> http://localhost:4000
npx expo start --web # front dev -> http://localhost:8081 (Metro proxifie /api)
npm run preview      # build + serveur app+proxy -> http://localhost:8080
npm run test:api     # 16 tests automatisés de bout en bout
```

> Appareil mobile : `npx expo start`, puis renseigne l'IP de ta machine dans
> `src/config.js` (`detectBaseUrl`) pour que l'app joigne l'API.
