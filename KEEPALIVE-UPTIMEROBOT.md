# Garder Cabine En Ligne toujours éveillée — guide UptimeRobot

> **But :** le plan gratuit de Render met le service en veille après ~15 min sans visite.
> Résultat : le premier visiteur voit la page « Welcome to Render » (10-40 s) avant que
> l'app charge. Ce guide évite ça **gratuitement**, sans quitter Render ni rien payer.

---

## 1. L'URL de garde (à utiliser)

```
https://cabine-en-ligne.onrender.com/health
```

Cet endpoint existe déjà et répond `{ "status": "ok", "mode": "mock" }`. On va
lui envoyer une petite requête toutes les 5 min pour empêcher le service de dormir.

---

## 2. Créer un compte UptimeRobot (gratuit)

1. Va sur **https://uptimerobot.com** et clique **« Sign up »** (ou « Get Started »).
2. Inscris-toi avec **une adresse email** (utilise ton email pro/perso de confiance).
3. Viens déjà un compte gratuit (50 moniteurs) : c'est largement suffisant.

> Astuce : tu peux aussi t'inscrire avec ton compte Google pour aller plus vite.

---

## 3. Créer le moniteur

1. Une fois connecté, clique **« + New Monitor »** (ou « Add New Monitor »).
2. Remplis :
   - **Monitor Type** : `HTTP(s)`
   - **Friendly Name** : `Cabine En Ligne - keep-alive`
   - **URL** : `https://cabine-en-ligne.onrender.com/health`
   - **Monitoring Interval** : `5 min` (le plus petit en gratuit)
3. **Déroule « Advanced »** (important) :
   - **Timeout** : laisse 30 s.
   - **Retries / Retry Interval** : laisse par défaut.
   - **Alert Contacts** : **décoche tout** (on NE veut PAS être notifié à chaque panne ;
     on veut juste maintenir l'app réveillée — sinon tu recevras des alertes inutiles).
4. Clique **« Create Monitor »**.

---

## 4. Vérifier que ça marche

1. Sur l'onglet **« Monitors »**, tu dois voir ton moniteur **« Up »** (vert) au bout de
   1-2 minutes. Le fait qu'il soit en **Up** signifie que Render répond → donc l'app
   ne dort plus.
2. **Test final** : attends que le moniteur reste vert quelques minutes. Normalement,
   si tu ouvres maintenant ton lien, il doit répondre **immédiatement** (sans l'écran
   « Welcome to Render »).

---

## 5. Pourquoi ça suffit ?

- Le keep-alive envoie une requête **toutes les 5 min** sur `/health`.
- Render considère le service comme **« actif »** → il **ne le met plus en veille**.
- Ça coûte **0 F** et ça ne touche à **aucun code**.

---

## 6. Rappels importants

- Le keep-alive **évite l'écran de veille mais ne change pas l'URL** : tu restes sur
  `cabine-en-ligne.onrender.com` pour l'instant (c'est ce que tu veux pour le test).
- Quand tu brancheras un jour ton **domaine** (`cabineenligne.com`), il faudra **mettre à
  jour l'URL du moniteur** vers `https://cabineenligne.com/health` (ou en créer un nouveau).
- Un **domaine** rend l'URL jolie mais ne remplace PAS le keep-alive : les deux sont
  complémentaires.

---

## 7. En résumé (les 4 actions)

1. Créer un compte UptimeRobot (gratuit).
2. Ajouter un moniteur `HTTP(s)` → `https://cabine-en-ligne.onrender.com/health`.
3. Intervalle **5 min** + **décocher les alertes**.
4. Vérifier qu'il est **vert / Up** → l'app ne dort plus.

> ⏱️ **Temps total : ~5 minutes.** C'est le geste qui fait le plus pour la bonne
> première impression de tes testeurs.

---

## ⚠️ 8. Le piège à connaître : les 750 h/mois du plan gratuit

Le keep-alive **empêche bien la mise en veille** (donc plus de page « Welcome to Render »).
MAIS il a une conséquence cachée :

- Le plan gratuit de Render donne **750 h d'instance par mois** (par workspace).
- Un keep-alive qui tourne **24h/24** fait que le service reste **allumé en continu** :
  - **~730 à 744 h** par mois (soit presque tout le quota de 750 h).
- Quand le quota est atteint, Render **suspends** les services gratuits du workspace
  **jusqu'au 1ᵉʳ du mois suivant** (le site devient injoignable).

### Donc :
| Situation | Keep-alive nécessaire ? | Risque |
|---|---|---|
| **Test 10–15 personnes** (1 à 3 semaines) | ✅ Oui | **Aucun** — tu consommes ~300 h, loin du plafond. |
| **Production continue 24/7** | ⚠️ Non idéal | Tu atteins le plafond de **750 h en ~1 mois** → suspension. |

### La solution durable
Le **plan payant (Starter ≈ 7 $/mois)** supprime **à la fois** :
- la **mise en veille** (plus de cold start), **et**
- le **plafond d'heures** (le service reste actif sans suspension).

➡️ Donc : **keep-alive = parfait pour le lancement test** (gratuit). Pour les vrais clients,
passe au plan payant — c'est ce qui évite BOTH le cold start ET le plafond horaire.
