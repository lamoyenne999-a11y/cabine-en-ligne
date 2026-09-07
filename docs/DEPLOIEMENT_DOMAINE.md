# Sortir de `.onrender` : domaine officiel + fin de l'écran « WELCOME TO RENDER »

> Ce doc répond à ta demande : **l'app doit se lancer sur un lien officiel, pas sur
> `… .onrender.com`**, et les nouveaux utilisateurs ne doivent **jamais** voir l'écran de
> chargement « WELCOME TO RENDER » (ta pièce jointe `IMG_6589.png`).

---

## 1. Pourquoi tu vois « WELCOME TO RENDER » ?

L'app est hébergée sur le **plan gratuit de Render**, qui **met le service en veille** après une
période d'inactivité. Quand un utilisateur ouvre le lien, Render « réveille » le service : pendant
ce réveil (10 à 40 s), Render affiche sa **page de chargement ASCII** (« Welcome to Render ») à la
place de l'app. C'est **de l'infrastructure Render**, pas un bug de l'app.

**Deux façons de s'en débarrasser :**
1. **Ne plus laisser le service dormir** → soit héberger ailleurs, soit payer un palier « toujours actif ».
2. **Mettre un domaine officiel** → l'URL est propre (`app.mondomaine.ci`) mais **l'écran de réveil
   Render reste** tant que le service dort.

> ⚠️ Important : un **domaine personnalisé** rend l'URL jolie mais **ne supprime pas** l'écran de réveil.
> Pour supprimer **le réveil**, il faut **soit** un hébergement qui ne dort pas, **soit** quitter Render.

---

## 2. Bonne nouvelle : l'app est déjà « indépendante du domaine »

Aucun code ne référence `onrender`. Le front est prêt pour n'importe quel domaine :
- **`buildShareUrl()`** (dans `src/config.js`) utilise `window.location.origin` → le lien de partage
  est **automatiquement celui du domaine d'ouverture** (officiel ou non). ✅
- **`API_URL`** est `""` (même origine) + le serveur proxifie `/api`. Donc si tu déplaces l'ensemble,
  rien à changer. ✅
- La fonction **`buildShareUrl`** et le **service worker PWA** (mode hors-ligne) fonctionnent sur tout
  domaine HTTPS. ✅

**Conclusion : tu peux brancher un domaine ou changer d'hébergeur sans modifier le code.**

---

## 3. Les 3 options (avec coût et résultat)

| Option | Coût | `.onrender` dans l'URL ? | Écran « WELCOME TO RENDER » ? | Effort |
|---|---|---|---|---|
| **A. Domaine officiel sur Render** (recommandé pour démarrer) | ~0–10 €/an (le domaine) | ❌ Non (domaine propre) | ⚠️ **Oui** si le service dort | Faible |
| **B. Render « toujours actif »** (payant) + domaine | ~7–25 $/mois | ❌ Non | ❌ **Non** (ne dort plus) | Faible |
| **C. Quitter Render** (Netlify/Vercel pour le front + API ailleurs, ou VPS) | ~0–15 $/mois | ❌ Non | ❌ **Non** (hébergeur sans veille) | Moyen |

---

## 4. Solution recommandée (phase par phase)

### Étape 1 — un domaine officiel (à faire en premier, simple)
1. Achète un nom de domaine (ex. **`cabineenligne.ci`**, **`cabine.ci`**, **`cabineenligne.com`**).
   Registres locaux : `.ci` (via opérateurs agréés) ou un registrar international.
2. Dans **Render → ton service → Settings → Custom Domains** → ajoute ton domaine.
3. Suis les instructions DNS (Ajoute un enregistrement **CNAME** ou **ALIAS** chez ton registrar).
4. **Certificat SSL** : Render le gère automatiquement (HTTPS ✅).

> Résultat : les utilisateurs voient **un lien officiel**, et l'écran Render ne gêne plus **l'image** de
> l'app. Le réveil peut encore survenir, mais plus sous une URL `.onrender`.

### Étape 2 — supprimer le « réveil » (recommandé)
- **Option rapide** : passer le service Render sur un **palier payant** (« toujours actif ») → plus de
  veille, l'app répond instantanément. C'est ce qui **élimine** l'écran « WELCOME TO RENDER ».
- **Option gratuite durable** : **quitter Render** (voir §5) → hébergeur sans veille.

### Étape 3 — réduire l'attente de toute façon (déjà fait)
Le **mode hors-ligne PWA** (+ service worker `v2`) : une fois l'app chargée, elle **s'ouvre
instantanément** même sans réseau. La bannière **« Connexion au service, un instant… »** rassure
pendant le réveil au lieu d'un écran vide.

---

## 5. Quitter Render (option gratuite durable) — comment

L'app = **front PWA** + **API Node** + **base de données**. Chaque brique a une alternative sans veille :

| Brique | Alternative (gratuite / peu chère) | Fonctionne sans veille ? |
|---|---|---|
| Front PWA (statique, `dist/`) | **Netlify** ou **Vercel** (free tier) | ✅ (CDN, toujours actif) |
| API + base | **Render/Flux** pour l'API (dort) OU **VPS** (Hetzner, DO, Contabo) toujours actif | VPS ✅ |
| Base de données | **Neon** / **Supabase** / **Railway** (Postgres) ou Sqlite sur VPS | ✅ |

**Le plus simple sans VPS :**
- **Netlify** (ou **Vercel**) pour le **front** (`netlify.toml` / `vercel.json` déjà fournis).
- **Neon** (Postgres gratuit) + un petit service API (Render ou un VPS) derrière `EXPO_PUBLIC_API_URL`.

**Le plus robuste (contrôle total) :**
- Un **VPS** (Hetzner ≈ 4–6 €/mois) : lance `node server/src/combined.js` (front + API + base SQLite).
  → **aucune veille**, domaine officiel, données sous ton contrôle. Le `Dockerfile` est fourni.

---

## 6. Ce que je te conseille de faire MAINTENANT

1. **Domaine officiel** (étape 1) — c'est le plus simple et ça t'enlève `.onrender` de l'URL.
2. **Vise un hébergement sans veille** (VPS ou Netlify+API) pour **éliminer définitivement**
   l'écran « WELCOME TO RENDER » et offrir un lancement instantané.
3. En attendant, **l'app est déjà prête** : domaine-agnostique, PWA hors-ligne, bannière de
   connexion qui rassure pendant le réveil.

> Tu n'as pas besoin de modifier le code pour changer de domaine / d'hébergeur. Dis-moi **quel
> domaine** tu comptes prendre et **quel hébergeur** tu préfères (Render payant, Netlify+Neon, ou VPS)
> et je te prépare la config exacte (DNS, variables d'environnement, commande de lancement).
