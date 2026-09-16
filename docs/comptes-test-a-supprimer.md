# Comptes de test créés pendant les audits (à supprimer)

Ces comptes ont été créés automatiquement pour vérifier la sécurité en production.
Ils n'ont aucune valeur et doivent être supprimés (Espace propriétaire → Utilisateurs
→ rechercher le numéro → Supprimer).

| Numéro      | Nom          | Rôle    | Créé le  |
|-------------|--------------|---------|----------|
| 099560106   | Test Audit   | client  | 16 sept. |
| 098560697   | Audit A      | client  | 16 sept. |
| 097560697   | Audit B      | client  | 16 sept. |
| 096560697   | Audit G      | gérant  | 16 sept. |  ← apparaît dans « Autres gérants inscrits »
| 095560697   | <script>…    | client  | 16 sept. |
| 094561611   | Audit Abo    | client  | 16 sept. |  ← a une déclaration d'abonnement « À vérifier » : cliquer « Rien reçu » d'abord

## Alternative en ligne de commande (remplacer VOTRE_CLE)

```bash
for p in 099560106 098560697 097560697 096560697 095560697 094561611; do
  curl -s -X POST https://cabine-en-ligne.onrender.com/api/admin/delete-account \
    -H "x-admin-key: VOTRE_CLE" -H "content-type: application/json" \
    -d "{\"phone\":\"$p\"}"; echo;
done
```

À l'avenir, les vérifications en production se feront sans créer de comptes visibles
(ou avec des comptes supprimés immédiatement après le test).
