# Validation du script one-shot de consolidation du catalogue

Date : 16 septembre 2026 (Africa/Douala)

## Périmètre

Le script testé est :

`backend/prisma/reconciliation/20260916_consolidate_catalog_offers_and_prices.sql`

Il est volontairement placé hors de `backend/prisma/migrations`. Il ne peut pas être découvert ni exécuté par `prisma migrate deploy`.

- Taille : 171 lignes.
- SHA-256 : `6143c7715bdae30b0448016ed0f8b53c3f93445b92df3af52fd5979fac97ff41`.
- Aucune exécution n'a été faite sur `db.prisma.io` pendant cette étape.

## Préparation de la staging propre

1. Création de la base PostgreSQL 17 locale `sitcha_catalog_oneshot_test`.
2. Restauration de la dernière sauvegarde distante pré-opération :
   `/home/qwerty/.local/share/si-tcha-ai/backups/sitcha-remote-pre-reconcile-20260916.dump`.
3. SHA-256 de la sauvegarde : `3f18648453c443edaee64f3c6252f9227ee637988abecae887b6d41e91fc9469`.
4. Exclusion uniquement de l'extension d'hébergement `prisma_postgres`, indisponible dans PostgreSQL standard.
5. Exécution locale du script legacy déjà validé afin de reproduire exactement l'état distant réconcilié et audité.

## Empreintes préalables

| Ensemble | Nombre | MD5 exact |
|---|---:|---|
| Produits 19 à 26 | 8 | `917e046b57388449d488b09bbb5a08da` |
| RecolteOffre | 26 | `cf8f7753901414e44f5f6254d244c91b` |
| TransactionAcheteur | 2 | `689b5a31f5bb10571ec51495d9fd7867` (champs métier stables explicites, hors `createdAt`) |
| JournalCroissance | 0 | contrôle de cardinalité à zéro |

Le script prend des verrous `ACCESS EXCLUSIVE` sur `ProduitAgricole`, `RecolteOffre`, `TransactionAcheteur` et `JournalCroissance` avant de recalculer ces empreintes.

L'empreinte des transactions porte explicitement sur `id`, `type`, `quantite`, `prixConvenu`, `statut`, `recolteOffreId`, `acheteurId` et `clientRequestId`. Le champ technique `createdAt`, attribué lors de la réconciliation legacy, est volontairement exclu. La cardinalité exacte de deux transactions et les liaisons `1 → offre 1` et `2 → offre 4` restent contrôlées avant et après la consolidation.

## Correction de l'empreinte des transactions

Après le refus contrôlé de la première exécution distante, la base distante et une staging propre restaurée depuis `sitcha-remote-pre-catalog-consolidation-20260916.dump` ont été comparées champ par champ. Les deux transactions sont identiques sur tous les champs audités, y compris `createdAt`.

Empreintes communes aux deux bases :

- JSON complet : `d3403dbca6053aa135462c320313a8b3` ;
- champs métier stables hors `createdAt` : `689b5a31f5bb10571ec51495d9fd7867` ;
- triplet minimal `id`, `recolteOffreId`, `acheteurId` : `bbafb1ab7a94972227afca436f62576a`.

L'ancienne empreinte complète provenait de la staging historique où `createdAt` avait été créé par la réconciliation legacy avec `DEFAULT CURRENT_TIMESTAMP`. La correction n'affaiblit aucun invariant métier : elle rend seulement l'empreinte indépendante de ce timestamp technique.

La version corrigée a été rejouée sur une staging PostgreSQL 17 propre restaurée depuis le dump pré-opération : première exécution complète avec `COMMIT`, deuxième exécution refusée par les préconditions, huit offres finales (`1,4,19,20,22,23,25,26`), transactions `1→1` et `2→4`, aucune FK orpheline, quatre cartes, volume total `11 050 kg`, prix validés et diff Prisma vide sous Node 22.

## Consolidation encodée

Canoniques conservés : `1, 4, 19, 20, 22, 23, 25, 26`.

Doublons explicitement supprimés :

`2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 24`.

Avant la suppression, le script refuse de continuer si l'un de ces 18 IDs est référencé par une transaction ou un journal de croissance. Le nombre de suppressions doit être exactement 18.

Prix encodés avec précondition `prix IS NULL`, ID et nom exacts :

| ID | Produit | Prix |
|---:|---|---:|
| 19 | Tomates fraîches | 500 FCFA/kg |
| 20 | Maïs jaune | 335 FCFA/kg |
| 21 | Manioc frais | 200 FCFA/kg |
| 22 | Régimes de Plantains | 500 FCFA/kg |

Les produits 23 à 26 doivent rester à `prix=NULL`.

## Résultat du test positif

L'exécution transactionnelle avec `ON_ERROR_STOP=1` a produit :

```text
BEGIN
LOCK TABLE
DO
DO
DO
DO
COMMIT
```

Contrôles après COMMIT :

- offres restantes : 8 ;
- IDs : `{1,4,19,20,22,23,25,26}` ;
- transaction 1 toujours reliée à l'offre 1 ;
- transaction 2 toujours reliée à l'offre 4 ;
- FK orphelines transaction → offre : 0 ;
- FK orphelines journal → offre : 0 ;
- FK orphelines offre → produit : 0 ;
- FK orphelines offre → GIC : 0 ;
- produits 19 à 22 aux prix exacts validés ;
- produits 23 à 26 toujours à `NULL` ;
- cartes catalogue simulées : 4 ;
- volume catalogue total : 11 050 kg ;
- diff Prisma contre `schema.prisma` : vide.

## Test négatif et rollback

Le même script a été rejoué sur la staging déjà consolidée. Il s'est arrêté sur la première empreinte avant toute mutation :

```text
ERROR: Product inventory changed (count=8, hash=40196656b989f1791ff66a9422f6e1ab)
```

Code de sortie `psql` : 3. La connexion a été fermée avec la transaction en erreur, entraînant son rollback. Les contrôles suivants sont restés inchangés :

- 8 offres `{1,4,19,20,22,23,25,26}` ;
- 4 cartes catalogue ;
- 11 050 kg.

Le script est donc non rejouable par accident et s'arrête automatiquement à la moindre divergence d'inventaire.
