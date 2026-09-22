# Rapport de réconciliation PostgreSQL staging

Date : 16 septembre 2026 (Africa/Douala)

## Périmètre et sécurité

- Source : sauvegarde de `db.prisma.io`, copiée sans écriture sur la source.
- Copie durable : `/home/qwerty/.local/share/si-tcha-ai/backups/sitcha-remote-pre-migrate-20260916.dump`.
- Permissions : `0600`, répertoire parent `0700`.
- SHA-256 du dump : `244f754e1413233ab44c3e0a369db9ad2e95cf5837710f803c0c91d4cd6e7474`.
- Format : archive PostgreSQL custom, 200 entrées, dont 26 entrées `TABLE DATA`.
- PostgreSQL source : 17.2 ; `pg_dump` : 17.11.
- Staging isolée : conteneur local `sitcha-reconcile-staging`, base de test `sitcha_stage_test`, port lié uniquement à `127.0.0.1:25432`.
- L'extension d'hébergement `prisma_postgres`, absente de PostgreSQL standard, a été la seule entrée fournisseur exclue de la restauration. Toutes les tables, données, séquences, contraintes et tous les index applicatifs ont été restaurés.
- Aucune écriture, migration ou opération de baselining n'a été exécutée sur `db.prisma.io`.

## Script opératoire one-shot

Fichier : `backend/prisma/reconciliation/20260916_reconcile_legacy_prisma_postgres.sql`

Ce fichier n'est pas une migration Prisma standard. Il est volontairement placé hors de `backend/prisma/migrations` et ne peut donc pas être découvert ou exécuté par `prisma migrate deploy`. Il sert une seule fois à réconcilier la base legacy issue de Prisma Postgres avant de reprendre le cycle normal des migrations.

Prérequis opératoire obligatoire : arrêter toutes les instances de l'application avant son exécution distante. Le script prend des verrous `ACCESS EXCLUSIVE` sur toutes les tables legacy lues, modifiées ou référencées, avant le calcul des empreintes et les conserve jusqu'au `COMMIT`.

- Transaction explicite `BEGIN` / `COMMIT` et exécution avec `ON_ERROR_STOP=1`.
- 286 lignes.
- SHA-256 : `22de3dd8aad82b2170afd44b23605ba7e974b285725fba1863388d6fcfc39118`.
- Précontrôles par empreinte exacte des agriculteurs et des groupes en collision.
- Décision métier propre à cette base de test : agriculteurs 1 et 2 affectés à `APPROUVE`.
- Échec explicite si un agriculteur n'est pas couvert par le mapping.
- Vérification des FK avant chaque suppression.
- Aucune suppression de ligne métier dépendante ; uniquement des réaffectations de FK.
- Contraintes uniques créées après consolidation.
- Toutes les séquences sérialisées réalignées sur la valeur maximale existante.

### Consolidations appliquées

- Bassins : 24 FK `GIC`, 12 FK `DonneesMeteo`, 16 FK `DonneeMarche` et 8 FK `AlertePhyto` réaffectées ; 24 doublons supprimés.
- GIC : 18 FK `RecolteOffre` réaffectées ; 18 doublons supprimés.
- Produits : 18 FK `RecolteOffre` et 12 FK `DonneeMarche` réaffectées ; 24 doublons supprimés.

## Comptages avant et après

| Table | Avant | Après |
|---|---:|---:|
| Acheteur | 5 | 5 |
| Admin | absente | 0 |
| Agriculteur | 2 | 2 |
| AgronomeInterne | 0 | 0 |
| AlerteMeteo | absente | 0 |
| AlertePhyto | 8 | 8 |
| B2BOfferEntry | 0 | 0 |
| BassinProduction | 28 | 4 |
| BesoinGIC | 0 | 0 |
| ChargeFinanciere | 1 | 1 |
| DonneeMarche | 16 | 16 |
| DonneesMeteo | 12 | 12 |
| DonneesSol | absente | 0 |
| EchangeB2B | 0 | 0 |
| Evaluation | 0 | 0 |
| GIC | 26 | 8 |
| GicNeedEntry | 1 | 1 |
| HistoriqueProduction | 0 | 0 |
| JournalCroissance | 0 | 0 |
| OtpCode | 2 | 2 |
| ParcelEntry | 0 | 0 |
| Prefinancement | 0 | 0 |
| PrefinancingEntry | 4 | 4 |
| ProduitAgricole | 32 | 8 |
| ProgrammeAgricole | 8 | 8 |
| QuestionAgronomique | 0 | 0 |
| RecolteOffre | 26 | 26 |
| TransactionAcheteur | 2 | 2 |
| TrustRatingEntry | 1 | 1 |
| VerificationCode | absente | 0 |

Le vendeur technique éphémère utilisé pour les tests a été supprimé. Le compte final `Agriculteur` reste à 2 lignes.

## Intégrité après migration

- 27 FK présentes, 27 validées, 0 `NOT VALID`.
- Contrôle anti-jointure dynamique sur chaque FK simple : aucune ligne orpheline.
- Groupes dupliqués restants :
  - `BassinProduction.nom` : 0 ;
  - `GIC.identifiantREF` : 0 ;
  - `ProduitAgricole.nom` : 0 ;
  - `Acheteur.nui` non nul : 0 ;
  - `GIC.polygonId` non nul : 0.
- `Agriculteur.id=1` : `APPROUVE`.
- `Agriculteur.id=2` : `APPROUVE`.

## Diff Prisma final

Commande exécutée contre `sitcha_stage_test` avec Prisma 7 et Node 22 :

```text
-- This is an empty migration.
```

Code de sortie avec `--exit-code` : `0`.

## Validations indépendantes finales

### Parcours A — PostgreSQL 17 vide

- Base locale indépendante : `sitcha_standard_17_test`.
- `prisma migrate deploy` a découvert exactement 17 migrations.
- 17 migrations appliquées et terminées.
- 0 migration ou script contenant `legacy` ou `reconcile_restored` enregistré dans `_prisma_migrations`.
- Le script one-shot, placé hors de `prisma/migrations`, n'a pas été découvert ni exécuté.
- Diff final contre `prisma/schema.prisma` : `-- This is an empty migration.`
- Code de sortie du diff : `0`.

### Parcours B — dump legacy restauré

- Base locale indépendante : `sitcha_legacy_oneshot_test`.
- Dump restauré intégralement, à l'exception documentée de l'extension fournisseur `prisma_postgres` indisponible dans PostgreSQL standard.
- Script one-shot exécuté directement avec `ON_ERROR_STOP=1`.
- Verrous `ACCESS EXCLUSIVE` acquis avant les contrôles d'empreinte.
- Transaction terminée par `COMMIT`.
- Diff final contre `prisma/schema.prisma` : `-- This is an empty migration.`
- Code de sortie du diff : `0`.

## Tests backend sur staging

Backend lancé sur `127.0.0.1:4001`, exclusivement avec la `DATABASE_URL` staging.

| Contrôle | Résultat |
|---|---|
| `GET /api/health/ready` | HTTP 200, `status=UP`, `database=UP` |
| `POST /api/auth/login` vendeur | HTTP 200, jeton émis, `statut=APPROUVE`, `status=active` |
| `GET /api/auth/me` avec le jeton | HTTP 200, rôle `seller`, `statut=APPROUVE`, `status=active` |

Le compte technique de test a été supprimé après les contrôles et le backend a été arrêté proprement.
