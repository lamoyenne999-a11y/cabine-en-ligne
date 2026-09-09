# 🌐 Connecter `cabineenligne.com` à Render (pas-à-pas)

> Après l'achat chez **Porkbun**, voici comment mettre le domaine en ligne sur **Render**
> sans rien casser. Ton appli est déjà prête (tout en chemins relatifs — vérifié plus tôt).

---

## ✅ Prérequis
- [ ] `cabineenligne.com` **acheté** chez Porkbun (11,08 $/an).
- [ ] Email de **vérification ICANN confirmé**.
- [ ] Ton service Render **cabine-en-ligne** existe et tourne (site `.onrender.com` OK).
- [ ] Le domaine est **à ton nom** (tu es le `registrant`).

---

## 1️⃣ Étape A — Chez **Porkbun** : récupérer la config DNS à utiliser

Tu vas laisser les DNS **chez Porkbun** (le plus simple) et juste **pointer vers Render**.

---

## 2️⃣ Étape B — Sur **Render** : déclarer le domaine

1. **Dashboard Render** → ton service **cabine-en-ligne** → menu **Settings**.
2. Section **Networking** → **Custom Domains** → **Add Domain**.
3. Entre `cabineenligne.com` (sans `www`).
4. Render te montre les **enregistrements DNS à créer**. Note-les. Exemple :
   - Un enregistrement **`A`** pour `@` (apex) → une adresse IP type `216.24.57.1`.
   - Un enregistrement **`CNAME`** pour `www` → une cible type `cname.vercel-dns.com`.

> ⚠️ Les IP/cibles exactes sont affichées dans **ton** dashboard Render — prends **celles-là**.

---

## 3️⃣ Étape C — Chez **Porkbun** : créer les enregistrements DNS

1. **Porkbun Dashboard** → **Domains** → clique sur `cabineenligne.com` → **DNS Records**.
2. Crée les enregistrements **exactement** comme indiqués par Render, par exemple :

| Type | Host (Name) | Content / Value | TTL |
|---|---|---|---|
| `A` | `@` | *(l'IP Render donnée)* | 300 |
| `CNAME` | `www` | *(la cible Render donnée)* | 300 |

3. **Supprime** les éventuels enregistrements `A`/`CNAME` qui pointeraient vers un autre hébergeur (si le domaine en avait un).
4. **Enregistre** les changements.

> 💡 Porkbun a une interface très claire pour ça : tu ajoutes un enregistrement, tu choisis le type,
> tu colles la valeur, tu sauvegardes. C'est tout.

---

## 4️⃣ Étape D — Créer le certificat SSL + redirection (vers le domaine)

1. Retourne sur **Render → Settings → Custom Domains**. Le domaine s'affiche **"Pending"**.
2. Dès que le DNS propage, Render **émet le certificat SSL (Let's Encrypt)** automatiquement.
   → Le domaine passe à **"Issued / Active"** avec un cadenas 🔒.

### Redirections conseillées
- **`http://cabineenligne.com` → `https://cabineenligne.com`** : Render le fait si tu actives la redirection HTTPS.
- **`.onrender.com` → `cabineenligne.com`** : coche l'option **"Redirect all .onrender.com traffic to..."**
  chez Render (Settings → Custom Domains) pour que les anciens liens de partage continuent de marcher.

---

## 5️⃣ Étape E — Vérifications finales

- [ ] `https://cabineenligne.com/health` → `{"status":"ok","mode":"mock"}`
- [ ] `https://cabineenligne.com/` → l'appli se charge (pas de page blanche)
- [ ] `https://cabineenligne.com/?u=<idGérant>` → profil public OK
- [ ] `https://cabineenligne.com/?ref=<code>` → inscription avec code OK
- [ ] **Connexion** client + gérant OK
- [ ] **Demande** + **paiement** (copie numéro Wave) OK
- [ ] **PWA** : "Ajouter à l'écran d'accueil" + icônes OK
- [ ] Cadenas 🔒 + `https://` sur toute la page

---

## 🕐 Timeline à anticiper

| Étape | Délai |
|---|---|
| Enregistrement domaine (Porkbun) | **Instantané** une fois payé |
| Confirmation email ICANN | Quelques minutes |
| Création des DNS | 5 min |
| **Propagation DNS** | **30 min à 24 h** |
| **SSL (Let's Encrypt)** | Quelques minutes après propagation |

> ⚠️ Pendant la propagation, `cabineenligne.com` peut afficher une erreur. **C'est normal**, pas une panne.
> Ton site `.onrender.com` reste disponible pendant ce temps.

---

## 🆘 En cas de souci

- **Le domaine ne charge pas après 24 h** → vérifie que les enregistrements `A`/`CNAME` chez Porkbun sont
  bien **ceux affichés par Render**, pas les valeurs par défaut de Porkbun.
- **Erreur SSL** → attends la propagation ; sinon, re-vérifie les DNS (un enregistrement erroné bloque le SSL).
- **L'ancien `.onrender.com` ne redirige pas** → coche l'option de redirection dans Render → Custom Domains.
- **Prends bien l'IP/la cible de TON dashboard Render** (elles varient selon les comptes).

---

## 🛡️ Rappel : plan free temporaire
- Le keep-alive **UptimeRobot** sur `https://cabineenligne.com/health` (5 min) garde le site éveillé
  pour le **test**. Mets à jour l'URL du moniteur vers le domaine une fois connecté.
- Pour les **vrais clients** : passe au plan **Starter (~7 $/mois)** pour éviter la mise en veille ET le plafond d'heures.

---

_Guide technique de mise en service du domaine. À adapter aux valeurs exactes affichées dans ton dashboard Render._
