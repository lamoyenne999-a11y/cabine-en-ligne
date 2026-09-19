# Référencement Google — Cabine En Ligne

## Déjà en place (dans le code)
- `lang="fr"`, titre et description optimisés, balise canonical, robots `index, follow`.
- Open Graph / Twitter (aperçu WhatsApp, Facebook avec image `/icons/og-image.png`).
- Données structurées JSON-LD : Organisation, Site web, Application, FAQ.
- `/robots.txt` (autorise tout sauf `/api/`, `?u=`, `?ref=`) et `/sitemap.xml`.
- Texte de présentation lisible par les robots (bloc HTML statique, retiré dès que l'app démarre) + bloc visible sur l'accueil.

## À faire une seule fois par le propriétaire (5 min, gratuit)
1. Aller sur https://search.google.com/search-console et se connecter avec un compte Google.
2. « Ajouter une propriété » → type **Préfixe d'URL** → `https://cabineenligne.com/`.
3. Méthode de vérification **Balise HTML** : copier le code (`content="xxxxxxxx"`) et l'envoyer au développeur,
   qui l'ajoute dans `scripts/pwa-postbuild.mjs` (balise `google-site-verification`) puis déploie.
   Ensuite cliquer « Vérifier ».
4. Menu **Sitemaps** → saisir `sitemap.xml` → Envoyer.
5. Menu **Inspection de l'URL** → `https://cabineenligne.com/` → « Demander une indexation ».

Résultats : le nom « Cabine En Ligne » remonte en général en 1 à 3 semaines ; les recherches génériques
(« recharge unités à distance ») prennent plusieurs mois.

## Optionnel
- Fiche **Google Business Profile** (Maps) si une adresse physique existe.
- Google Ads : décision reportée (voir avec le propriétaire plus tard).
