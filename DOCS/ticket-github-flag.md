# Ticket GitHub Support — compte flaggé (blocage autorisations d'apps tierces)

## Où le soumettre
- Formulaire : https://support.github.com/contact
- Chemin : **Account Recovery** → **Flagged Account** (ou « account is restricted, suspended or flagged »)
- Alternative : https://support.github.com/contact/account

## Pré-requis avant d'ouvrir le ticket
- ✅ **2FA activée** : GitHub → Settings → Password and authentication → Two-factor authentication
- ✅ Vérifié le **Security log** (Settings → Security) : aucune connexion / clé / app inconnue
- ✅ Aucun **OAuth App** ni **Personal Access Token** suspect (Settings → Applications)

---

## Message à copier

> **Objet :** Compte GitHub flaggé — impossible d'autoriser les applications tierces (OAuth) pour mes services
>
> Bonjour,
>
> Mon compte GitHub est marqué comme « flagged » et affiche le bandeau rouge :
> « This account is flagged, and therefore cannot authorize a third party application. »
>
> Conséquence directe : je ne peux plus autoriser les applications tierces, ce qui bloque mon
> site de production et mon outil de supervision (Render.com pour le déploiement, UptimeRobot
> pour l'alerte, tous deux connectés via GitHub).
>
> Détails de mon compte :
> - Nom d'utilisateur : **Yyb5jd6wnw-croquis**
> - Dépôt principal : **Yyb5jd6wnw-croquis/cabine-en-ligne** (privé)
> - Dernier accès réussi : je me connecte normalement au dashboard GitHub (lecture OK)
>
> Ce qui est bloqué précisément :
> - Autorisation OAuth d'applications tierces (Render, UptimeRobot)
> - Render ne peut donc plus cloner mon dépôt → tous les redéploiements échouent en quelques secondes
>
> Je confirme :
> - J'ai activé l'authentification à deux facteurs (2FA) sur mon compte.
> - J'ai vérifié le journal de sécurité : aucune activité suspecte, aucune clé SSH ou
>   application non reconnue.
> - Ce compte est utilisé pour un projet personnel légitime (application Cabine En Ligne,
>   https://cabineenligne.com), qui fonctionne actuellement mais ne peut pas être mis à jour
>   à cause de ce blocage.
>
> Pouvez-vous, s'il vous plaît, examiner et lever ce flag afin que je puisse de nouveau
> autoriser les applications tierces et redéployer mon site ?
>
> Merci beaucoup pour votre aide.

---

## Après le déflag (dès que GitHub Support confirme)
1. Re-connectez **Render** (par email ou « continue with GitHub »).
2. Sur le service **cabine-en-ligne** → **Manual Deploy → Deploy latest commit**.
3. Le build repart (avec le fix Node 20 déjà poussé). Comptez 5–15 min.
4. Vérifiez : `https://cabineenligne.com/sw.js` contient `cabine-en-ligne-v3` et la page sert un nouveau bundle.
