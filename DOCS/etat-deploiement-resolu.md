# ✅ État du déploiement — RÉSOLU (11 septembre 2026)

## Ce qui vient de se passer
- **Ancien problème** : compte GitHub `Yyb5jd6wnw-croquis` flaggé → l'OAuth Render
  (et UptimeRobot) était bloqué → Render ne pouvait plus cloner le dépôt privé
  → tous les déploiements échouaient (`could not read Username for
  'https://github.com'`).
- **Solution appliquée** : nouveau compte GitHub `lamoyenne999-a11y` + dépôt
  **public** `lamoyenne999-a11y/cabine-en-ligne`, et sur Render le service
  utilise l'onglet **« Public Git Repository »** (URL publique) au lieu de
  « Git Provider » (OAuth). → **Plus aucun OAuth/flag ne peut bloquer.**

## État PROD (vérifié le 11/09/2026)
- `https://cabineenligne.com/health` → `{"status":"ok","mode":"mock"}`
- Bundle : **`index-4d910b290110ecef1cd0f793350911fd.js`** (nouveau)
- `sw.js` : **`cabine-en-ligne-v3`**
- Bloc « PAIEMENT WAVE DIRECT » : **retiré** du formulaire (0 occurrence)
- Paiement Wave après envoi (« PAYEZ MAINTENANT ») : présent (1 occurrence)
- Clé publique VAPID servie par `/api/public/push-key` ✅
- Manifest PWA + meta iOS présents ✅
- Commit déployé : `ad7c460` (Figer Node 20 + engines)

## Ce qui reste à faire côté utilisateur (téléphone)
1. **Recharger la PWA** sur le téléphone : fermer complètement l'app
   (Safari / l'app installée) puis la rouvrir, pour récupérer le nouveau
   service worker (`v3`) et le nouveau bundle.
2. **Activer les notifications** dans l'app (écran Profil → notifications).
   - Android : Web Push fonctionne bien.
   - iPhone : Web Push nécessite **iOS 16.4+** ET l'app **ajoutée à l'écran
     d'accueil** (« Ajouter à l'écran d'accueil »).

## Rappels techniques (pour les prochaines mises à jour)
- **Déployer** : pousser sur `lamoyenne999-a11y/cabine-en-ligne` (main), puis
  Render → service `cabine-en-ligne` → **Manual Deploy → Deploy latest commit**.
- **Repo public** : ne pas mettre de secret dans le code (tout est déjà en
  variables d'environnement Render : WAVE_API_KEY, JWT_SECRET, ADMIN_KEY…).
- **Ancien compte flaggé** : ticket GitHub **#4743084** toujours ouvert (réponse
  envoyée à Sophia). Si GitHub lève le flag, l'ancien compte redevient
  utilisable ; sinon le nouveau compte suffit.
- **UptimeRobot** : monitor `cabineenligne.com` (Up 100 %). Si le monitor
  utilisait l'OAuth GitHub de l'ancien compte, le rebrancher via email/mot de
  passe ou nouveau compte.
