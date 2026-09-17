# Rapport de réconciliation distante — 16 septembre 2026

## Résumé

La base PostgreSQL 17.2 hébergée sur `db.prisma.io` a été réconciliée avec le schéma Prisma courant au moyen du script one-shot gardé :

`backend/prisma/reconciliation/20260916_reconcile_legacy_prisma_postgres.sql`

La réconciliation legacy a ensuite été complétée par la consolidation one-shot du catalogue et des offres :

`backend/prisma/reconciliation/20260916_consolidate_catalog_offers_and_prices.sql`

Les opérations ont été réalisées après arrêt du backend, sauvegarde complète et validation préalable sur staging. Aucun push Git n'a été effectué.

## Traçabilité

- Commit opératoire local : `52afd74` (`ops: add guarded legacy database reconciliation`).
- SHA-256 du script : `22de3dd8aad82b2170afd44b23605ba7e974b285725fba1863388d6fcfc39118`.
- Sauvegarde immédiatement antérieure à l'opération : `/home/qwerty/.local/share/si-tcha-ai/backups/sitcha-remote-pre-reconcile-20260916.dump`.
- Permissions de la sauvegarde : `0600`.
- Entrées `TABLE DATA` : 26.
- SHA-256 de la sauvegarde : `3f18648453c443edaee64f3c6252f9227ee637988abecae887b6d41e91fc9469`.
- Commit initial de consolidation catalogue : `b404920` (`ops: add guarded catalog consolidation`).
- Commit correctif de l'empreinte stable : `bece5fd` (`fix: stabilize catalog transaction fingerprint`).
- SHA-256 final du script de consolidation : `f3197be9e85afed98ad5e0d7b4306b4c9a69ba4b0dac5cceb522d0b1769d1f10`.
- Sauvegarde pré-consolidation : `/home/qwerty/.local/share/si-tcha-ai/backups/sitcha-remote-pre-catalog-consolidation-20260916.dump`.
- Permissions : `0600` ; taille : `89 488` octets ; entrées `TABLE DATA` : 31.
- SHA-256 de la sauvegarde pré-consolidation : `e6f2028ea608e2fa46212766a1edcc2535ae646e032a84148fc7929fc77d359c`.

## Déroulement distant

1. Les processus et ports du backend SI-TCHA ont été arrêtés et contrôlés.
2. Les connexions visibles restantes étaient trois connexions internes sans état du pooler Prisma, aucune session applicative active.
3. Une nouvelle sauvegarde distante complète a été créée et validée.
4. Le script one-shot a été exécuté avec `psql`, `ON_ERROR_STOP=1`, `lock_timeout=15s` et `statement_timeout=10min`.
5. Les verrous `ACCESS EXCLUSIVE` ont été acquis avant les empreintes.
6. Toutes les empreintes ont correspondu à l'inventaire audité.
7. La transaction s'est terminée par `COMMIT`.
8. Le diff distant contre `prisma/schema.prisma` était vide.
9. Les 17 migrations standard ont été marquées successivement avec `prisma migrate resolve --applied`, sous Node 22.

Après les 17 résolutions réussies, la boucle shell a également présenté `migration_lock.toml` à Prisma. Prisma l'a refusé avec `P3017`. Cette tentative n'a produit aucune entrée et n'a modifié ni le schéma ni les données.

État final de `_prisma_migrations` :

- total : 17 ;
- réussies : 17 ;
- inachevées : 0 ;
- annulées : 0 ;
- script one-shot enregistré comme migration : 0.

`prisma migrate status` indique que la base est à jour. `prisma migrate deploy` indique qu'aucune migration n'est à appliquer.

## Tests HTTP après redémarrage

| Test | Résultat |
|---|---|
| `GET /api/health/ready` | HTTP 200, processus et base `UP` |
| Connexion vendeur technique | HTTP 200, jeton émis, `APPROUVE`, `active` |
| `GET /api/auth/me` | HTTP 200, rôle `seller`, statut `APPROUVE` |
| `GET /api/gic/profile` | HTTP 200 |
| Connexion acheteur technique | HTTP 200 |
| `GET /api/catalog/products` | HTTP 200, catalogue vide |
| Création offre B2B réversible | HTTP 201 |
| Lecture de l'offre créée | HTTP 200, offre retrouvée |

Les comptes et offres techniques ont été supprimés après les tests. Un contrôle final a confirmé zéro donnée technique résiduelle.

Le catalogue est vide parce que les huit produits ont actuellement `prix=NULL`, alors que l'API ne publie que les récoltes dont le produit a un prix strictement positif.

## Audit distant des prix — lecture seule

Toutes les unités actuelles valent `kg`. Aucun prix catalogue n'est renseigné. `RecolteOffre` ne contient pas de colonne de prix ; les seuls prix liés aux offres sont les `TransactionAcheteur.prixConvenu` indiqués ci-dessous.

### Produit 19 — Tomates fraîches

- Prix catalogue actuel : `NULL` FCFA/kg.
- Données marché : quatre lignes identiques, date `2026-07-01`, bassin `Ouest` (ID 1), `prixMoyen=480`, `prixMin=NULL`, `prixMax=NULL`, `source=NULL`.
- Offres : IDs 1, 7, 13 et 21.
- Prix négocié lié : offre 1, transaction 1, `prixConvenu=500`, créée le `2026-09-16`, statut `en_attente`.
- Prix le plus récent : 500 FCFA/kg, issu de la transaction du 16 septembre 2026.
- Proposition non appliquée : **500 FCFA/kg**, car il s'agit du signal transactionnel le plus récent et il reste proche du relevé marché à 480.

### Produit 20 — Maïs jaune

- Prix catalogue actuel : `NULL` FCFA/kg.
- Données marché du `2026-07-01` :
  - quatre lignes Ouest (ID 1), `prixMoyen=350`, autres champs de prix et source `NULL` ;
  - quatre lignes Nord (ID 3), `prixMoyen=320`, autres champs de prix et source `NULL`.
- Offres : IDs 2, 8, 14 et 22 ; aucun prix négocié associé.
- Prix les plus récents : 350 FCFA/kg en Ouest et 320 FCFA/kg au Nord, à égalité de date.
- Proposition non appliquée : **335 FCFA/kg**, moyenne simple des deux valeurs régionales contemporaines. À confirmer si un prix national unique est bien souhaité.

### Produit 21 — Manioc frais

- Prix catalogue actuel : `NULL` FCFA/kg.
- Données marché : quatre lignes identiques, date `2026-07-01`, bassin `Centre` (ID 2), `prixMoyen=200`, `prixMin=NULL`, `prixMax=NULL`, `source=NULL`.
- Offres : IDs 3, 9, 15 et 23 ; aucun prix négocié associé.
- Prix le plus récent : 200 FCFA/kg.
- Proposition non appliquée : **200 FCFA/kg**, seule valeur observée et répétée de façon cohérente.

### Produit 22 — Régimes de Plantains

- Prix catalogue actuel : `NULL` FCFA/kg.
- Donnée marché : aucune.
- Offres : IDs 4, 10, 16 et 24.
- Prix négocié lié : offre 4, transaction 2, `prixConvenu=500`, créée le `2026-09-16`, statut `en_attente`.
- Prix le plus récent : 500 FCFA/kg.
- Proposition non appliquée : **500 FCFA/kg**, seul prix réel observé, provenant d'une transaction récente. Une validation métier reste souhaitable car il n'existe aucun relevé marché.

### Produit 23 — Poivrons rouges

- Prix catalogue actuel : `NULL` FCFA/kg.
- Donnée marché : aucune.
- Offres : IDs 5, 11, 17 et 25 ; aucun prix négocié associé.
- Prix le plus récent : aucun.
- Proposition non appliquée : **conserver `NULL`** jusqu'à obtention d'un relevé marché ou d'une transaction ; aucune valeur chiffrée n'est défendable avec les données présentes.

### Produit 24 — Arachides séchées

- Prix catalogue actuel : `NULL` FCFA/kg.
- Donnée marché : aucune.
- Offres : IDs 6, 12, 18 et 26 ; aucun prix négocié associé.
- Prix le plus récent : aucun.
- Proposition non appliquée : **conserver `NULL`** jusqu'à validation par une source marché ou une transaction.

### Produit 25 — Arachides

- Prix catalogue actuel : `NULL` FCFA/kg.
- Donnée marché : aucune.
- Offre : ID 19 ; aucun prix négocié associé.
- Prix le plus récent : aucun.
- Proposition non appliquée : **conserver `NULL`**. Ne pas recopier automatiquement le prix des arachides séchées, qui constitue un produit distinct et n'a lui-même aucun prix validé.

### Produit 26 — Maïs

- Prix catalogue actuel : `NULL` FCFA/kg.
- Donnée marché : aucune.
- Offre : ID 20 ; aucun prix négocié associé.
- Prix le plus récent : aucun.
- Proposition non appliquée : **conserver `NULL`**. Le prix du maïs jaune peut servir de repère, mais ne suffit pas à établir l'équivalence produit.

## Consolidation distante du catalogue

Une première tentative avec le script du commit `b404920` a été refusée avant toute écriture par l'empreinte complète de `TransactionAcheteur`. L'audit en lecture seule de la base distante et d'une staging restaurée depuis la nouvelle sauvegarde a confirmé que les deux transactions étaient identiques sur tous les champs. L'empreinte a été corrigée dans `bece5fd` pour porter explicitement sur les champs métier stables, hors `createdAt`, sans retirer les contrôles de cardinalité ni les liaisons `1→offre 1` et `2→offre 4`.

La version corrigée a été exécutée avec `psql`, `ON_ERROR_STOP=1`, verrous préalables et transaction unique. Résultat SQL : `BEGIN`, `LOCK TABLE`, quatre blocs `DO`, puis `COMMIT`.

Contrôles directs post-COMMIT :

- offres restantes : `1,4,19,20,22,23,25,26` ;
- transactions : `1→offre 1`, `2→offre 4`, empreintes finales inchangées ;
- FK orphelines vers les offres : 0 ;
- prix : produit 19 = 500, 20 = 335, 21 = 200, 22 = 500 FCFA/kg ;
- produits 23 à 26 : prix `NULL` ;
- catalogue : 4 cartes, volume cumulé `11 050 kg` ;
- diff Prisma distant sous Node 22 : vide.

## Tests HTTP après consolidation

| Test | Résultat |
|---|---|
| `GET /api/health/ready` | HTTP 200, application et base `UP` |
| Connexion acheteur technique | HTTP 200 |
| `GET /api/catalog/products` | HTTP 200, exactement 4 cartes |
| Tomates fraîches | 500 FCFA/kg, 2 400 kg |
| Régimes de Plantains | 500 FCFA/kg, 450 kg |
| Maïs jaune | 335 FCFA/kg, 5 000 kg |
| Manioc frais | 200 FCFA/kg, 3 200 kg |
| Recherche `tomates` | 1 résultat exact |
| Filtre catégorie `Légumes` | 1 résultat |
| Filtre bassin `Centre` | 2 résultats |
| Connexion vendeur technique | HTTP 200 |
| `GET /api/auth/me` vendeur | HTTP 200, rôle `seller`, statut `active` |

Les recherches et filtres du catalogue sont appliqués côté mobile ; ils ont été contrôlés sur la réponse HTTP réelle avec les mêmes prédicats que l'écran acheteur. Les deux comptes techniques vérifiés ont été supprimés après le test. Les transactions existantes ont été ré-empreintées après nettoyage : hash complet `d3403dbca6053aa135462c320313a8b3`, hash stable `689b5a31f5bb10571ec51495d9fd7867`, hash minimal `bbafb1ab7a94972227afca436f62576a`.

## Prochaine action P0

La consolidation distante du catalogue est terminée. Le prochain P0 est le smoke test de l'APK autonome, puis la préparation du nouveau backend Heroku.

## Compte de test vendeur migré

Le fournisseur SMS étant indisponible (`503` lors de l'inscription), le compte de test local `Mlk` a été migré de manière contrôlée vers la base distante. Le numéro a été normalisé en `+237695715021`, le hash PIN existant a été transféré exclusivement en mémoire sans être affiché ni journalisé, et un nouvel ID distant a été généré par la séquence.

État distant validé : ID 7, GIC ID 21 `GIC Agro-Vallée Bafoussam`, leader, téléphone vérifié, compte vérifié et statut `APPROUVE`. Aucun autre compte n'a été modifié. Jimmy a saisi manuellement le PIN sur le téléphone ; la connexion a réussi et l'écran vendeur affiche le GIC attendu avec l'état `En Ligne`.

Le smoke test mobile vendeur a ensuite validé le profil GIC, Terrain SIG, l'accès au Journal de croissance, B2B Trade et la persistance de session après `force-stop`, sans écriture métier. L'archive installée contient toutefois un APK `DEBUGGABLE` avec Expo Dev Client : elle nécessite Metro et ne constitue pas une APK autonome. Après un changement de réseau local, le test a été poursuivi via des tunnels USB ADB temporaires vers les ports 4000 et 8081, sans modifier les fichiers de configuration du projet.
