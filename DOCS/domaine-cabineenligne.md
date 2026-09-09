# 🌐 Mise en service du domaine `cabineenligne.com`

> But : servir l'appli (et la PWA) depuis `https://cabineenligne.com` au lieu de `.onrender.com`,
> **sans rien casser**. Document de suivi — à garder.

---

## ✅ 1) Vérifié : l'appli est PRÊTE pour le domaine

J'ai audité le code. **Aucune URL n'est codée en dur** sur `cabineenligne.onrender.com`.
Tout suit automatiquement le domaine sur lequel l'appli est servie :

| Élément | Mécanisme | Conséquence avec le domaine |
|---|---|---|
| **API** | `API_URL = ''` en web + proxy `/api` (même origine) | `https://cabineenligne.com/api/...` marche direct |
| **Liens de partage** | `window.location.origin/?u=ID` | deviennent `https://cabineenligne.com/?u=ID` |
| **Liens de parrainage** | `window.location.origin/?ref=CODE` | suivent le domaine |
| **PWA manifest** | `/manifest.webmanifest` (relatif) | OK sur le domaine |
| **Service worker** | `/sw.js` (relatif) | OK sur le domaine |
| **Routage SPA** | fallback `index.html` pour toute route non `/api` | `/?u=ID`, `/` OK |
| **SSL** | Render fournit un cert. automatique (Let's Encrypt) | HTTPS OK sans manip |

➡️ **Conclusion : à condition de bien connecter le domaine à Render, rien ne casse.**
Aucune modification de code requise.

---

## 🛒 2) Étape A — Acheter le domaine

1. Choisir un registrar fiable (Namecheap, GoDaddy, OVH, Hostinger…). `cabineenligne.com`
   est un **.com** : pas besoin de présence locale en CI.
2. Vérifier l'**e-mail de vérification** (obligation ICANN) et le confirmer.
3. **Activer le renouvellement automatique** (sinon le domaine expire et le site tombe).
4. **Désactiver le "registrar lock" temporairement** si besoin de transférer les DNS (en général non requis).

> ⏱️ L'activation du transfert de propriété peut prendre de quelques minutes à 24 h.
> La **propagation DNS** (voir Étape C) peut prendre de **30 min à 24 h**.

---

## 🔗 3) Étape B — Ajouter le domaine sur Render

1. Dashboard Render → ton service **cabine-en-ligne** → **Settings** → **Custom Domains**.
2. Clique **Add Domain** et entre `cabineenligne.com`.
3. Render affiche les **enregistrements DNS à créer** chez ton registrar :
   - **Apex** (`cabineenligne.com`) → un **enregistrement A** pointant vers l'IP Render fournie
     (ou l'`ALIAS/ANAME`/`CNAME` que Render indique).
   - **`www`** (optionnel) → un **enregistrement CNAME** vers la cible fournie.
4. **Recommandé** : coche l'option **"Redirect all .onrender.com traffic to custom domain"** pour
   que les anciens liens / liens de partage `.onrender.com` redirigent vers `cabineenligne.com`
   (sinon ceux-là continuent d'afficher l'ancien domaine).

> ⚠️ **Ne supprime pas** le service `.onrender.com` : il sert de repli tant que le DNS propage.
> Tu pourras masquer/rediriger une fois que `cabineenligne.com` répond en HTTPS.

---

## 📡 4) Étape C — Créer les enregistrements DNS chez le registrar

Chez ton registrar (Zone DNS), ajoute exactement ce que Render demande, par exemple :

| Type | Hôte | Valeur |
|---|---|---|
| `A` | `@` | `216.24.57.1` *(IP exemple — prends celle affichée dans Render)* |
| `CNAME` | `www` | `cname.vercel-dns.com` *(ou la cible donnée par Render)* |

- Laisse les enregistrements **par défaut** du registrar pour le mail si tu n'en as pas besoin.
- Si tu as déjà un site sur ce domaine, **retire** le vieil enregistrement qui pointe ailleurs.
- Supprime les vieux `A`/`CNAME` qui pointeraient sur un autre hébergeur.

---

## 🛡️ 5) Étape D — SSL, HTTPS et redirections

- Render **active SSL automatiquement** quand le DNS propage (cert. Let's Encrypt).
- Vérifie que `https://cabineenligne.com` → `https://cabineenligne.com` et que
  `http://` redirige vers `https://` (Render le fait par défaut si activé).
- Vérifie la redirection **non-www ⇄ www** selon ton choix (choisis UN seul, cohérent).

---

## 🧪 6) Vérifications après connexion (à faire soi-même)

- [ ] `https://cabineenligne.com/health` → `{"status":"ok","mode":"mock"}`
- [ ] `https://cabineenligne.com/` → l'appli se charge (pas d'erreur blanche)
- [ ] `https://cabineenligne.com/?u=<idGérant>` → le profil public s'ouvre
- [ ] `https://cabineenligne.com/?ref=<code>` → l'inscription garde le code
- [ ] **Inscription** client + gérant OK
- [ ] **Création de demande** → l'appel `/api` fonctionne (même origine)
- [ ] **Paiement Wave** (copie numéro) OK
- [ ] **Installation PWA** (Ajouter à l'écran d'accueil) + icônes OK
- [ ] **Service worker** : note dans la console "PWA: service worker prêt"

---

## ⚠️ 7) Deux vrais points d'attention (à ne pas sous-estimer)

### ⚠️ A. Plan Render GRATUIT → mise en veille
Le plan **free** de Render met le service **en veille après ~15 min d'inactivité** :
le premier visiteur après une pause doit attendre **~30 s à 1 min** (cold start).
- **Pour un test de 10–15 personnes** : acceptable.
- **Pour de vrais clients en production** : envisage un plan **payant** (Starter ≈ 7 $/mois)
  qui garde le service **toujours actif**.

> 💡 Avec un domaine acheté, les visiteurs s'attendent à un site **immédiatement disponible**.
> La mise en veille est le seul vrai "ça ne marche pas comme il se doit" à anticiper.

### ⚠️ B. Propagation DNS
La connexion du domaine peut prendre de **30 min à 24 h**. Tant qu'elle n'est pas finie,
`cabineenligne.com` peut renvoyer une erreur. **Ce n'est pas une panne** : c'est normal.
Le site `.onrender.com` reste disponible pendant ce temps.

---

## 🆘 En cas de souci

- **Le domaine ne s'ouvre pas après 24 h** → vérifie que les enregistrements DNS sont bien ceux
  indiqués par Render, pas ceux par défaut du registrar.
- **Erreur SSL** → attends la propagation ; sinon re-vérifie les DNS (mauvais enregistrement = SSL en échec).
- **Le site charge mais les données ne vont pas** → vérifie que l'app appelle `/api` en **même origine** (normal en web).
- **L'ancien lien `.onrender.com` ne redirige pas** → active l'option "redirect to custom domain" chez Render.

---

_À faire valider par un professionnel (avocat / ARTCI) pour la partie conformité juridique. Ce document couvre uniquement la partie technique de mise en service du domaine._
