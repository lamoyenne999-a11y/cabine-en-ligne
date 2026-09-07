# Analyse stratégique — Cabine En Ligne (Côte d'Ivoire)

> Objectif : rendre l'app **rentable** et **sans souci** pour toi, et **indispensable** pour les
> utilisateurs, en tenant compte du marché ivoirien, de la réglementation et des réalités de lancement.
> Version : fondée sur les données du marché disponibles à fin 2025 / début 2026.

---

## 0. La conclusion en une ligne

**Reste sur le modèle « connexion + les gérants se font payer en direct via leur Wave marchand »,
ne touche jamais à l'argent, monétise les GÉRANTS (pas les clients), et ajoute 3 choses qui rendent
l'app irremplaçable : (1) savoir quel opérateur chaque gérant peut servir + le « en ligne »,
(2) un vrai système de confiance (KYC + notes + code de confirmation de service),
(3) des notifications WhatsApp/SMS + mode hors-ligne pour les téléphones simples.**

C'est le chemin le plus rentable ET le moins risqué. Tout ce qui fait transiter l'argent par l'app
(a la façon « Checkout + Payout » décrite dans `WAVE_INTEGRATION.md`) te transforme en établissement
de paiement → agrément BCEAO → capital + conformité lourds. À éviter tant que ce n'est pas une
stratégie délibérée.

---

## 1. Le marché ivoirien en chiffres (à jour fin 2025)

| Indicateur | Valeur | Source |
|---|---|---|
| Abonnements téléphonie mobile | ~60,7 M (185 % de pénétration) | ARTCI 2025 |
| Abonnements internet mobile | ~38,5 M (117,5 %) | ARTCI 2025 |
| Utilisateurs internet | ~13,4 M (≈40,7 % de la population) | DataReportal/GSMA |
| Non connectés | ≈59 % de la population | DataReportal |
| Couverture réseau | 2G/3G quasi totale (≈80 %+), 4G ≈79 % (zones urbaines) | ARTCI 2025 |
| Dépôt/retrait sans frais | **Wave** : envoi 1 %, retrait gratuit | comparateurs 2026 |
| Frais marchand | **Wave ≈1 %** ; Orange/MTN/Moov ≈1,5–2,5 % ; agrégateurs (CinetPay…) ≈2,5–3,5 % | 2026 |

### Parts de marché du mobile money (approximatif, base comptes actifs)
| Opérateur | Part | Rôle |
|---|---|---|
| Orange Money | ≈40 % | leader historique |
| Wave | ≈32 % | perturbateur, le moins cher, retrait gratuit |
| MTN MoMo | ≈20 % | challenger |
| Moov Money | ≈8 % | fort en zones rurales / intérieur |

> **Lecture pour toi :** un Ivoirien a souvent **2+ SIM** (mobile + mobile money) et un smartphone.
> Wave est devenu le réflexe de paiement le moins cher : c'est un bon choix par défaut. Mais
> Orange Money et MTN restent indispensables pour toucher tout le monde, et Moov pour l'intérieur.

---

## 2. LA règle d'or pour éviter les soucis : ne jamais toucher l'argent

### 2.1 Le cadre réglementaire qui pèse
- **BCEAO** (banque centrale UEMOA) régule le mobile money. Depuis le **1ᵉʳ mai 2025**
  (Instruction n°01-01-2024), toute structure qui **fournit des services de paiement** dans l'UEMOA
  doit avoir un **agrément** : Établissement de monnaie électronique (EME, capital élevé ~300 M FCFA),
  Établissement de paiement (EP), ou **partenaire technique agréé**. Les fintech non agréées ont dû cesser.
  Capital requis : de **10 M FCFA** (petite formule) à **100 M FCFA**.
- **ARTCI** (régulateur télécom/TIC) traite : licences/autorisations d'exploitation, homologation
  d'équipements, protection des consommateurs, identification des abonnés SIM. L'ARTCI **ne régule pas**
  la tarification du mobile money.
- **Loi n°2013-450** (protection des données personnelles) : le traitement des **numéros de téléphone**
  est soumis à **autorisation préalable de l'Autorité de protection**, plus **consentement exprès**,
  une politique de confidentialité et les droits (accès/rectification/effacement). Plus une exigence de
  **localisation des données** (stockage en Côte d'Ivoire ; dérogations soumises à autorisation ARTCI).

### 2.2 Les 3 modèles possibles (et leur poids réglementaire)

| Modèle | Ce que fait l'app | Agrément requis ? | Risque |
|---|---|---|---|
| **A. Mise en relation pure** *(recommandé)* | Affiche le numéro Wave marchand du gérant ; le **client paie directement le gérant**. L'app ne détient jamais les fonds. | **Non** (annuaire/mise en relation) | Faible |
| **B. Plateforme qui encaisse** (Checkout + Payout de `WAVE_INTEGRATION.md`) | Le client paie sur le compte business de l'app, qui reverse au gérant. | **Oui** — agrément BCEAO (EP/EME) + AML/LCB-FT + capital | Élevé |
| **C. Distributeur officiel / revendeur de recharge** | L'app achète/vend des recharges via les opérateurs (marge distributeur ≈3 %). | **Oui** — contrat de (sous-)distribution opérateur + documents société + KYC | Moyen |

> **Décision recommandée : Modèle A aujourd'hui.** C'est ton avantage actuel (le README l'affiche déjà :
> « L'app ne stocke JAMAIS d'argent »). Conserve-le. Le Modèle B est une **stratégie délibérée de fintech**
> à ne viser QUE si tu as le capital et l'équipe conformité. Le Modèle C est un **levier de croissance
> à moyen terme** (voir §4-D) qui demande des accords opérateurs, pas un agrément BCEAO de paiement.

---

## 3. Le vrai point de friction du marché : les transferts sont INTRA-RÉSEAU

C'est le point le plus important et le plus mal compris. Les transferts de **crédit / unités / data**
par un opérateur ne fonctionnent **qu'entre numéros du MÊME réseau** (ex. USSD Orange `*116*n°*montant*code#`,
Moov `*102*montant*n°*code#`, MTN `*133#`). Pour un numéro d'un autre opérateur, il faut passer par une
**recharge mobile money** (qui, elle, est inter-réseaux).

### Conséquence pour l'app → **ce qui la rend indispensable**
1. **Chaque gérant doit déclarer les opérateurs qu'il peut servir** (Orange / MTN / Moov).
2. **L'app détecte l'opérateur du numéro saisi** (plage de numéros) et **ne propose que les gérants
   capables de le servir**. Finis les « essais » ratés et les demandes impossibles à traiter.
3. Si le numéro cible est **inter-opérateurs**, propose une **recharge mobile money** ou aiguille vers
   un gérant qui a cet opérateur → **zéro demande inaboutissable**, ce qui est ta raison d'être.

> Ajoute cette notion à l'écran de demande : « Opérateur détecté : Orange » + « Gérants qui peuvent
> vous servir : … ». C'est le genre de détail qui fait qu'on **ne peut plus se passer** de l'app.

---

## 4. Modèle économique recommandé (rentabilité)

### 4.1 La logique : monétise le côté qui gagne de l'argent → les GÉRANTS
- **Les clients sont gratuits.** Ce sont eux qui amènent le volume. Rendre le client payant freinerait
  l'adoption et casserait l'effet réseau.
- **Les gérants paient** parce que l'app leur apporte des clients, une visibilité, une réputation et un
  outil de gestion. C'est la logique des marketplaces (le vendeur paie, pas l'acheteur).

### 4.2 Offre « gérant » en paliers (freemium B2B)
| Palier | Prix (indicatif) | Ce qu'il donne |
|---|---|---|
| **Découverte** | Gratuit / 1ᵉʳ mois essai | Profil public, quelques demandes, 1 opérateur |
| **Standard** | ~100–500 FCFA/mois | Demandes illimitées, plusieurs opérateurs, stats, badge « Vérifié » |
| **Pro** | ~1 000–2 500 FCFA/mois | Priorité de routage, mise en avant géographique, kit de marque, export, support |

> **Levier pricing** : le prix ne doit pas être ton premier argument. Ta valeur = **volume de clients
> qualifiés + confiance + outils**. Commence à ~100 FCFA/mois pour prendre le marché, puis monte le prix
> avec la valeur (badge « Vérifié », « En ligne », priorité, stat). Garde l'essai gratuit (déjà en place).

### 4.3 Sources de revenus complémentaires (sans toucher à l'argent)
- **Frais de mise en relation** (consigne) par commande **aboutie** — facturé au **gérant**, pas au client.
  (Prudence : ne prends **pas un % du montant payé via ton checkout** pour rester hors agrément ; un
  forfait par service est plus sûr.)
- **Visibilité payante** (mise en avant, « Gérant du coin », priorité de routage géographique).
- **Badge « Vérifié »** (payant) après KYC — renforce la confiance ET génère du revenu.
- **Outil de gestion** pour gérants (livre de caisse simple, rappels, factures) — upgrade payant.
- **Publicité / opérations partenaires** locales (écoles, marchés, quartiers) — à maturité.

### 4.4 Le grand levier à moyen terme : partenariats « distributeur / recharge »
Les opérateurs rémunèrent leurs distributeurs (≈3 % de commission) ; les sous-distributeurs en gardent
une part. **Si tu deviens (sous-)distributeur / partenaire d'un ou plusieurs opérateurs**, tu peux :
- proposer la **recharge réelle** (client paie, l'app déclenche la recharge, marge opérateur),
- obtenir de meilleures conditions tarifaires,
- devenir un acteur légitime du secteur (contrats, KYC, RCCM, etc.).

> ⚠️ **Ce n'est PAS la même chose que « toucher l'argent ».** Un contrat de distribution opérateur
> est un **accord commercial**, pas un agrément de paiement BCEAO. Mais ça demande : une **société
> immatriculée** (RCCM), une **déclaration fiscale d'existence**, un **RIB**, et des justificatifs
> récents (< 3 mois). À préparer si tu veux aller chercher cette marge plus tard.

---

## 5. Confiance & sécurité (la #1 cause d'échec des marketplaces)

Le risque n°1 = **« J'ai payé mais le gérant n'a jamais servi »**. Comme l'argent ne passe pas par toi,
**tu ne peux pas rembourser** → il faut construire la confiance AVANT et surtout un mécanisme qui
**prouve** que le service a été fait.

### 5.1 KYC gérants (ton fossé défensif)
À l'inscription d'un gérant : pièce d'identité, **numéro Wave marchand vérifié** (lié à son identité),
opérateurs servis, **quartier/zone** (géoloc), photo de la cabine, nom officiel. Un gérant « Vérifié »
inspire confiance et peut être mis en avant.

### 5.2 Réputation visible
Notes (étoiles) laissées par les clients, nombre de demandes traitées, **taux de réponse**,
**temps moyen**, badge « En ligne ». Montre tout ça sur le profil public (déjà partageable).

### 5.3 Double confirmation du service (anti-arnaque)
1. Le client envoie la demande.
2. Le gérant **accepte**.
3. Le client paie (Wave direct) et appuie « J'ai payé ».
4. Le gérant exécute le transfert, puis clique **« J'ai servi »**.
5. **Le client confirme la réception** (bouton de confirmation / code de confirmation que le gérant
   a fourni pendant le service) → la demande est close et la note se débloque.

> C'est UN point à ajouter : la **clôture doit être confirmée par le client**, sinon un gérant peut
> marquer « servi » sans l'avoir fait. Ajoute aussi un **timeout + signaleur** et un canal de litige
> (WhatsApp/phone) pour trancher.

### 5.4 Anti-fraude
- **1 compte = 1 numéro**, numéro vérifié par **OTP**.
- Vérifier que le **numéro Wave marchand** correspond bien au gérant (pas un numéro personnel repris).
- Afficher au client le **nom exact du gérant** avant paiement (surtout s'il y a un lien Wave).
- Sensibiliser : **aucun motif de payer sur un autre numéro que celui affiché**.

---

## 6. Expérience utilisateur — rendre l'app indispensable

### 6.1 Ce que tu as déjà (bien)
- Formulaire de demande guidé (unités / minutes / internet, montant, bénéficiaire, gérant).
- Validation du formulaire qui **bloque l'envoi tant que ça manque** et **signale ce qui manque**.
- « Pour quelqu'un » = **numéro seul** (pas de nom).
- Paiement direct par le lien/numéro Wave du gérant + « J'ai payé ».
- Historique, totaux, notifications, profil public partageable.
- Bannière d'abonnement retirée de l'accueil client (elle restait en haut et masquait le formulaire).

### 6.2 Ce qui va transformer l'app en « indispensable »

**A. Opérateur + « en ligne » + proximité (la valeur n°1)**
- Détection de l'opérateur du numéro ; filtrage des gérants capables ; affichage « En ligne » /
  « Hors ligne » / temps de réponse ; gérants proches de toi (géoloc) en priorité.

**B. Réduction de la friction (surtout pour les non-technophiles)**
- Grands textes, icônes, **français simple + assistance en langues locales** (nouchi), tutoriel en 3 écrans.
- **PWA déjà installable** : ajoute **mode hors-ligne** (l'essentiel doit marcher sans réseau) et
  **taille / consommation data réduite** pour les connexions 2G/3G lentes.

**C. Notifications qui arrivent vraiment**
- Beaucoup d'Ivoiriens vivent sur **WhatsApp**. Envoie les mises à jour de statut
  (demande → acceptée → payée → servie) par **WhatsApp/SMS en plus des notifications internes**.
  C'est ce qui fait qu'on revient dans l'app.

**D. Transparence et fin de course**
- **Récapitulatif + reçu** à la fin du service ; historique et totaux (déjà là) avec **export**.
- Montrer clairement « Aucun argent n'est stocké sur l'app » pour rassurer.

**E. Pour le gérant (tu le rends productif)**
- **Tableau de bord simple** : demandes en cours, chiffres du jour, taux de complétion.
- **Ordres servis** commandés par priorité + rappel des non-traitées (anti oubli / anti insatisfaction).

---

## 7. Feuille de route par phases

### Phase 1 — MVP adopté (toi, maintenant)
- ✅ gratuit pour les clients ; freemium gérant ; KYC gérant + opérateurs servis ; détection opérateur ;
  « en ligne » + géoloc ; **double confirmation** ; notes/avis ; **WhatsApp/SMS + hors-ligne** ;
  conformité données (voir §8).

### Phase 2 — Croissance
- Monétisation gérant réelle (abonnement + mise en relation + visibilité payante + badge Vérifié).
- Partenariats avec des réseaux de cabines existants ; parrainage ; fidélité ; ouverture par ville.

### Phase 3 — Monétisation élargie
- Accords **distributeur/API recharge** (si société + KYC ok) ; comptes **B2B** (écoles, commerces,
  diaspora, livreurs) ; gérants « Premium » ; agents terrain.

### Phase 4 — Écosystème
- Cas d'usage **diaspora** (recharger/offrir des unités à la famille en CI depuis l'étranger) ;
  **micro-crédit** pour gérants (après traction, et là encore avec les bons partenaires) ;
  expansion **UEMOA** (même cadre BCEAO hébergé régional).

---

## 8. Conformité & démarches légales à boucler (checklist avant de scaler)

1. **Créer la structure** (SARL/SAS), **RCCM**, **déclaration fiscale d'existence**, **attestation
   de régularité fiscale**, **TVA** (vérifie le taux des services), **RIB** société.
2. **Données personnelles (loi 2013-450)** — **priorité** :
   - Nommer un **responsable de traitement**.
   - Obtenir l'**autorisation préalable** de l'Autorité de protection pour traiter des **numéros de
     téléphone** (obligation légale) ; **consentement** explicite à l'inscription.
   - **Politique de confidentialité** + droits des utilisateurs (accès/rectification/effacement).
   - **Hébergement des données** : l'app est aujourd'hui sur Render (étranger). Vérifie l'obligation de
     **localisation en Côte d'Ivoire** et les dérogations (autorisation ARTCI) ; prévois un hébergement
     local ou un partenaire conforme.
3. **Confirmer le modèle « zéro argent »** dans les CGU + mentions légales + politique de litige/remboursement.
4. **KYC gérants** + collecte d'identité cohérente avec l'**identification des abonnés SIM**.
5. **Compte Wave Business** (`wave.com/business`) pour encaisser les **abonnements** (ta propre
   trésorerie, pas un service de paiement à autrui) ; IP allowlist, webhook signé HMAC-SHA256, idempotence.
6. **CGU** claires, **support** (WhatsApp + téléphone), **assurance** responsabilité civile / cyber (bonus).
7. **Registre des traitements** + **DPO** si le volume le justifie.

---

## 9. Tableau des risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Toucher l'argent → agrément BCEAO requis | Blocage / sanction | Rester en **modèle A** (paiement direct au gérant) |
| Gérant encaisse sans servir | Perte de confiance, litiges | **KYC + notes + double confirmation** + canal litige |
| Faux gérants / usurpation | Fraude | **OTP par numéro** + vérif numéro Wave marchand + badge Vérifié |
| Transfert inter-opérateur impossible | Demandes inabouties | **Détection opérateur** + gérants par opérateur + recharge mobile money |
| Données hébergées hors CI | Non-conformité 2013-450 | **Hébergement local** + autorisation/consentement |
| Non-technophiles / petit budget data | Faible usage | **PWA + hors-ligne + WhatsApp/SMS + interface simple** |
| Froid de départ (pas assez de gérants) | Marketplace vide | **Densité par ville** + réseau de cabines + gérants « En ligne » |
| Volatilité des frais mobile money | Marges opérateurs | Assumer Wave par défaut ; négocier taux marchand si volume |

---

## 10. Indicateurs clés (KPIs) à suivre

- **Gérants** : inscriptions, actifs hebdo, % KYC complété, % « En ligne », taux de conversion gratuit→payant.
- **Clients** : inscriptions, actifs mensuels, demandes / client, rétention M1.
- **Demandes** : volume, **taux de complétion** (→gérant a servi), temps moyen de service, % annulées.
- **Qualité** : note moyenne, **taux de litige**, cas de fraude, réclamations/100 demandes.
- **Revenu** : ARPU gérant, MRR, revenu par gérant, coût d'acquisition.

---

## 11. Décisions à prendre (résumé actionnable)

1. **Restez en « zéro argent »** — pas d'agrément BCEAO. Garde le paiement direct au gérant via Wave.
2. **Monétise les gérants, pas les clients** — freemium + mise en relation + visibilité + badge Vérifié.
3. **Ajoute la détection d'opérateur + la capacité des gérants + le « en ligne »** → c'est ton avantage
   concurrentiel et ta promesse « ça marche à coup sûr ».
4. **Construis la confiance** : KYC gérant, notes, **double confirmation client**, canal litige, OTP.
5. **Rends l'app utilisable partout** : PWA hors-ligne, WhatsApp/SMS, interface simple, langues locales.
6. **Boucle la conformité données** (autorisation + hébergement local + consentement) **avant de scale**.
7. **Prépare le levier « distributeur / API recharge »** (société + KYC) pour la marge à moyen terme.

---

## Sources
- ARTCI — Statistiques du marché des télécoms CI 2025 (abonnements mobile, pénétration, couverture, mobile money) : https://www.artci.ci/images/stories/pdf/qualite_service/DEP/RAPPORT_ARTCI_-_Annuel_2025_030426.pdf
- DataReportal / GSMA — connectivité mobile & internet CI (fin 2025) : https://digitalmag.ci/des-chiffres-sur-les-usages-du-mobile-et-de-linternet-en-cote-divoire-datareportal-2026/
- Comparatif frais mobile money CI 2026 (Wave vs Orange/MTN/Moov) : https://momocalc.com/cote-divoire ; https://kolonell.com/en/blog/mobile-money-fees-cote-divoire-comparison-2026
- Parts de marché mobile money CI 2026 : https://blog.iambeezy.app/fr/mobile-money-api-integration-orange-money-wave-ci-2026/
- Transfert d'unités Orange CI (USSD / Max it) : https://www.orange.ci/fr/comment-transfrer-des-units-ou-du-volume-internet-orange.html ; https://www.yeclo.com/orange-cote-divoire-voici-comment-transferer-des-unites-ou-du-volume-internet
- Transfert d'unités intra-réseau (limite) : https://www.recharge.fr/actualites/d-couvrez-comment-envoyer-du-cr-dit-vers-un-autre-t-l-phone-
- ARTCI (régulation, licences, identification SIM) : https://fr.wikipedia.org/wiki/Autorit%C3%A9_de_r%C3%A9gulation_des_t%C3%A9l%C3%A9communications/TIC_de_C%C3%B4te_d%27Ivoire ; https://artci.ci
- BCEAO agréments fintech (Instruction n°01-01-2024, EP/EME, capital) : https://www.bceao.int/fr/content/etablissements-de-monnaie-electronique ; https://digitalmag.ci/instruction-n01-01-2024-la-bceao-attribue-un-agrement-a-11-fintech-de-la-zone-uemoa/
- Loi n°2013-450 protection des données (autorisation préalable, consentement, numéros de téléphone) : https://www.afapdp.org/wp-content/uploads/2018/05/Cote-Ivoire-LOI-SUR-LA-PROTECTION-DES-DONNEES-A-CARACTERE-PERSONNEL.pdf ; https://www.pont-hkb.com/decision-artci-i/
- Devenir sous-distributeur mobile money Orange (documents, ~3 % commission) : https://www.orange.ci/fr/n-devenir-partenaire-om.html ; https://my-tradinghouse.com/sous-distributeur-mobile-money-une-opportunite-daffaire/
