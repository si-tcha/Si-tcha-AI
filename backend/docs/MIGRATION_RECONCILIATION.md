# Documentation de Réconciliation et Migration du Schéma Prisma

Ce document détaille l'état du schéma de base de données suite à la réconciliation des branches `origin/main` et `elsonkjimmy`, les dérives constatées (schema drift), la gestion des duplications temporaires, et le plan de migration pour la production.

---

## 1. Contexte de Réconciliation

La branche `elsonkjimmy` a apporté des enrichissements majeurs côté mobile et backend (système d'OTP sécurisé, gestion des parcelles, offres B2B, préfinancements, évaluations de confiance et besoins GIC).
La réconciliation a fusionné ces ajouts avec le socle existant d'`origin/main` sans altérer les tables socles ni casser les relations existantes.

Toute l'analyse a été menée hors-ligne (`npx prisma migrate diff`), sans connexion ni altération de bases de données distantes.

---

## 2. Dérive du Schéma (Schema Drift)

### 2.1 Nouvelles Tables Ajoutées

| Table | Description | Clé Primaire / Relations |
| :--- | :--- | :--- |
| `OtpCode` | Stockage sécurisé des codes OTP numériques (6 chiffres) avec expiration | `id` (BigInt autoincrement), `phone` unique |
| `B2BOfferEntry` | Offres et demandes du marché B2B inter-coopératives | `id` (String), relation `gicId -> GIC(id)` |
| `ParcelEntry` | Suivi parcellaire et journal de croissance agronomique | `id` (String), relation `gicId -> GIC(id)` |
| `PrefinancingEntry` | Demandes et offres de préfinancement de campagne | `id` (String), relation `gicId -> GIC(id)` |
| `TrustRatingEntry` | Évaluations et avis de confiance entre acteurs | `id` (String), `targetId`, `targetType` |
| `GicNeedEntry` | Besoins déclarés par les GICs (semences, intrants, main-d'œuvre) | `id` (String), relation `gicId -> GIC(id)` |

### 2.2 Nouveaux Champs sur les Tables Existantes

- **`Acheteur`** :
  - `pinHash` (`String? @db.VarChar(100)`) : hash bcrypt sécurisé du code PIN.
  - `phoneVerified` (`Boolean @default(false)`) : état vérifié du téléphone par OTP.
- **`Agriculteur`** :
  - `pinHash` (`String? @db.VarChar(100)`) : hash bcrypt sécurisé du code PIN.
  - `phoneVerified` (`Boolean @default(false)`) : état vérifié du téléphone par OTP.

---

## 3. Duplications Temporaires et Dépréciations

Afin de garantir une rétrocompatibilité absolue pendant la période de transition :

1. **`pin` vs `pinHash`** :
   - `pinHash` est le champ canonique utilisé par le contrôleur d'authentification unifié.
   - `pin` est conservé pour les enregistrements antérieurs n'ayant pas encore transité.
   - Annoté `/// @deprecated Utiliser pinHash` dans `schema.prisma`.

2. **`isVerified` vs `phoneVerified`** :
   - `phoneVerified` est le booléen canonique standardisé sur toute l'API.
   - `isVerified` est maintenu en lecture de repli (`phoneVerified || isVerified`).
   - Annoté `/// @deprecated Utiliser phoneVerified` dans `schema.prisma`.

3. **`VerificationCode` vs `OtpCode`** :
   - `OtpCode` utilise un modèle optimisé avec index unique sur `phone` et gestion par `defaultOtpProvider`.
   - `VerificationCode` est l'ancienne table de vérification par SMS.
   - Le modèle `VerificationCode` est annoté `/// @deprecated Remplacé par la table OtpCode`.

---

## 4. Plan de Déploiement en Production

La migration en production s'effectuera en 3 étapes sans coupure de service :

### Étape 1 : Phase Actuelle (Dual-Read / Dual-Write)
- Le backend unifié écrit sur `pinHash` et `phoneVerified`, tout en tolérant `pin` et `isVerified` en lecture.
- Déploiement de l'API sans impact sur les utilisateurs existants.

### Étape 2 : Rétro-alimentation des données (Data Backfill)
Exécution du script SQL d'alignement sur la base PostgreSQL de production :

```sql
-- Remplir pinHash à partir de pin si absent
UPDATE "Acheteur"
SET "pinHash" = pin
WHERE "pinHash" IS NULL AND pin IS NOT NULL;

UPDATE "Agriculteur"
SET "pinHash" = pin
WHERE "pinHash" IS NULL AND pin IS NOT NULL;

-- Aligner phoneVerified avec isVerified
UPDATE "Acheteur"
SET "phoneVerified" = TRUE
WHERE "phoneVerified" = FALSE AND "isVerified" = TRUE;

UPDATE "Agriculteur"
SET "phoneVerified" = TRUE
WHERE "phoneVerified" = FALSE AND "isVerified" = TRUE;
```

### Étape 3 : Nettoyage et Suppression des Colonnes Héritées
Après migration complète des clients mobiles vers les versions consommant le contrat canonique :
- Suppression des colonnes `pin` et `isVerified` des tables `Acheteur` et `Agriculteur`.
- Suppression de la table `VerificationCode`.
- Génération d'une migration Prisma propre : `npx prisma migrate dev --name drop_deprecated_auth_fields`.
