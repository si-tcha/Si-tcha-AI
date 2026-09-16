BEGIN;

-- Operational prerequisite: stop every application instance before running
-- this one-shot legacy reconciliation. These locks make that requirement
-- enforceable and keep the audited snapshot stable through COMMIT.
LOCK TABLE
  "Acheteur",
  "Agriculteur",
  "AgronomeInterne",
  "AlertePhyto",
  "B2BOfferEntry",
  "BassinProduction",
  "BesoinGIC",
  "ChargeFinanciere",
  "DonneeMarche",
  "DonneesMeteo",
  "EchangeB2B",
  "Evaluation",
  "GIC",
  "GicNeedEntry",
  "HistoriqueProduction",
  "JournalCroissance",
  "OtpCode",
  "ParcelEntry",
  "Prefinancement",
  "PrefinancingEntry",
  "ProduitAgricole",
  "ProgrammeAgricole",
  "QuestionAgronomique",
  "RecolteOffre",
  "TransactionAcheteur",
  "TrustRatingEntry"
IN ACCESS EXCLUSIVE MODE;

-- This forward-only reconciliation is intentionally guarded against the exact
-- legacy staging snapshot audited on 2026-09-16. Abort instead of guessing if
-- the source rows have changed.
DO $$
DECLARE
  actual_hash text;
BEGIN
  SELECT md5(string_agg(row_to_json(a)::text, '|' ORDER BY a.id))
    INTO actual_hash
    FROM "Agriculteur" a;
  IF actual_hash IS DISTINCT FROM 'fc08c6829dd587ca2fec65428e76f674' THEN
    RAISE EXCEPTION 'Agriculteur inventory changed (hash=%); explicit status mapping must be reviewed', actual_hash;
  END IF;

  SELECT md5(string_agg(row_to_json(b)::text, '|' ORDER BY b.nom, b.id))
    INTO actual_hash
    FROM "BassinProduction" b
   WHERE b.nom IN (SELECT nom FROM "BassinProduction" GROUP BY nom HAVING count(*) > 1);
  IF actual_hash IS DISTINCT FROM 'd51841566d306e8f6e836f798286ce41' THEN
    RAISE EXCEPTION 'BassinProduction collision inventory changed (hash=%)', actual_hash;
  END IF;

  SELECT md5(string_agg(row_to_json(g)::text, '|' ORDER BY g."identifiantREF", g.id))
    INTO actual_hash
    FROM "GIC" g
   WHERE g."identifiantREF" IN (
     SELECT "identifiantREF" FROM "GIC" GROUP BY "identifiantREF" HAVING count(*) > 1
   );
  IF actual_hash IS DISTINCT FROM 'b66fc73733e89752ff06851afbb5d0a7' THEN
    RAISE EXCEPTION 'GIC collision inventory changed (hash=%)', actual_hash;
  END IF;

  SELECT md5(string_agg(row_to_json(p)::text, '|' ORDER BY p.nom, p.id))
    INTO actual_hash
    FROM "ProduitAgricole" p
   WHERE p.nom IN (SELECT nom FROM "ProduitAgricole" GROUP BY nom HAVING count(*) > 1);
  IF actual_hash IS DISTINCT FROM '4e2f7c9efc415f237e81549056ec9f4a' THEN
    RAISE EXCEPTION 'ProduitAgricole collision inventory changed (hash=%)', actual_hash;
  END IF;
END $$;

-- Explicit test-database business decision: the only two legacy farmers are approved.
CREATE TYPE "StatutAgriculteur" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');
ALTER TABLE "Agriculteur" ADD COLUMN "statut" "StatutAgriculteur";
UPDATE "Agriculteur" SET "statut" = 'APPROUVE' WHERE id IN (1, 2);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Agriculteur" WHERE "statut" IS NULL) THEN
    RAISE EXCEPTION 'Unmapped Agriculteur rows remain; refusing to invent a status';
  END IF;
END $$;
ALTER TABLE "Agriculteur"
  ALTER COLUMN "statut" SET DEFAULT 'EN_ATTENTE',
  ALTER COLUMN "statut" SET NOT NULL;

-- Consolidate functionally identical production basins onto the smallest IDs.
CREATE TEMP TABLE _bassin_map(old_id bigint PRIMARY KEY, canonical_id bigint NOT NULL) ON COMMIT DROP;
INSERT INTO _bassin_map VALUES
  (6,2),(10,2),(14,2),(18,2),(22,2),(26,2),
  (8,4),(12,4),(16,4),(20,4),(24,4),(28,4),
  (7,3),(11,3),(15,3),(19,3),(23,3),(27,3),
  (5,1),(9,1),(13,1),(17,1),(21,1),(25,1);

UPDATE "GIC" t SET "bassinProductionId"=m.canonical_id FROM _bassin_map m WHERE t."bassinProductionId"=m.old_id;
UPDATE "DonneesMeteo" t SET "bassinProductionId"=m.canonical_id FROM _bassin_map m WHERE t."bassinProductionId"=m.old_id;
UPDATE "DonneeMarche" t SET "bassinProductionId"=m.canonical_id FROM _bassin_map m WHERE t."bassinProductionId"=m.old_id;
UPDATE "HistoriqueProduction" t SET "bassinProductionId"=m.canonical_id FROM _bassin_map m WHERE t."bassinProductionId"=m.old_id;
UPDATE "AlertePhyto" t SET "bassinProductionId"=m.canonical_id FROM _bassin_map m WHERE t."bassinProductionId"=m.old_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "GIC" WHERE "bassinProductionId" IN (SELECT old_id FROM _bassin_map))
     OR EXISTS (SELECT 1 FROM "DonneesMeteo" WHERE "bassinProductionId" IN (SELECT old_id FROM _bassin_map))
     OR EXISTS (SELECT 1 FROM "DonneeMarche" WHERE "bassinProductionId" IN (SELECT old_id FROM _bassin_map))
     OR EXISTS (SELECT 1 FROM "HistoriqueProduction" WHERE "bassinProductionId" IN (SELECT old_id FROM _bassin_map))
     OR EXISTS (SELECT 1 FROM "AlertePhyto" WHERE "bassinProductionId" IN (SELECT old_id FROM _bassin_map)) THEN
    RAISE EXCEPTION 'A production-basin FK still references a row scheduled for deletion';
  END IF;
END $$;
DELETE FROM "BassinProduction" WHERE id IN (SELECT old_id FROM _bassin_map);

-- Consolidate GIC rows onto the audited most-recent IDs.
CREATE TEMP TABLE _gic_map(old_id bigint PRIMARY KEY, canonical_id bigint NOT NULL) ON COMMIT DROP;
INSERT INTO _gic_map VALUES
  (2,22),(8,22),(14,22), (4,24),(10,24),(16,24),
  (6,26),(12,26),(18,26), (3,23),(9,23),(15,23),
  (5,25),(11,25),(17,25), (1,21),(7,21),(13,21);

UPDATE "Agriculteur" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "RecolteOffre" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "BesoinGIC" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "ChargeFinanciere" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "EchangeB2B" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "QuestionAgronomique" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "Prefinancement" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "B2BOfferEntry" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "ParcelEntry" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;
UPDATE "GicNeedEntry" t SET "gicId"=m.canonical_id FROM _gic_map m WHERE t."gicId"=m.old_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Agriculteur" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "RecolteOffre" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "BesoinGIC" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "ChargeFinanciere" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "EchangeB2B" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "QuestionAgronomique" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "Prefinancement" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "B2BOfferEntry" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "ParcelEntry" WHERE "gicId" IN (SELECT old_id FROM _gic_map))
     OR EXISTS (SELECT 1 FROM "GicNeedEntry" WHERE "gicId" IN (SELECT old_id FROM _gic_map)) THEN
    RAISE EXCEPTION 'A GIC FK still references a row scheduled for deletion';
  END IF;
END $$;
DELETE FROM "GIC" WHERE id IN (SELECT old_id FROM _gic_map);

-- Consolidate products onto the smallest IDs carrying the enriched image URL.
CREATE TEMP TABLE _product_map(old_id bigint PRIMARY KEY, canonical_id bigint NOT NULL) ON COMMIT DROP;
INSERT INTO _product_map VALUES
  (6,24),(12,24),(18,24),(32,24), (3,21),(9,21),(15,21),(29,21),
  (2,20),(8,20),(14,20),(28,20), (5,23),(11,23),(17,23),(31,23),
  (4,22),(10,22),(16,22),(30,22), (1,19),(7,19),(13,19),(27,19);

UPDATE "RecolteOffre" t SET "produitAgricoleId"=m.canonical_id FROM _product_map m WHERE t."produitAgricoleId"=m.old_id;
UPDATE "DonneeMarche" t SET "produitAgricoleId"=m.canonical_id FROM _product_map m WHERE t."produitAgricoleId"=m.old_id;
UPDATE "HistoriqueProduction" t SET "produitAgricoleId"=m.canonical_id FROM _product_map m WHERE t."produitAgricoleId"=m.old_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RecolteOffre" WHERE "produitAgricoleId" IN (SELECT old_id FROM _product_map))
     OR EXISTS (SELECT 1 FROM "DonneeMarche" WHERE "produitAgricoleId" IN (SELECT old_id FROM _product_map))
     OR EXISTS (SELECT 1 FROM "HistoriqueProduction" WHERE "produitAgricoleId" IN (SELECT old_id FROM _product_map)) THEN
    RAISE EXCEPTION 'A product FK still references a row scheduled for deletion';
  END IF;
END $$;
DELETE FROM "ProduitAgricole" WHERE id IN (SELECT old_id FROM _product_map);

-- Remaining forward-only schema reconciliation generated from the restored snapshot.
ALTER TABLE "Acheteur"
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nom" TEXT,
  ADD COLUMN "nui" TEXT,
  ADD COLUMN "pin" VARCHAR(100),
  ADD COLUMN "preferences" JSONB,
  ADD COLUMN "secteur_activite" TEXT,
  ALTER COLUMN "preferencesAlertes" DROP NOT NULL;

ALTER TABLE "Agriculteur"
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pin" VARCHAR(100),
  ALTER COLUMN "prenom" DROP NOT NULL,
  ALTER COLUMN "estLeader" SET DEFAULT false;

ALTER TABLE "DonneeMarche"
  ADD COLUMN "prixMax" DECIMAL(15,2),
  ADD COLUMN "prixMin" DECIMAL(15,2),
  ADD COLUMN "source" TEXT;

ALTER TABLE "DonneesMeteo" DROP CONSTRAINT "DonneesMeteo_bassinProductionId_fkey";
ALTER TABLE "DonneesMeteo"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "gicId" BIGINT,
  ADD COLUMN "humidite" DECIMAL(5,2),
  ADD COLUMN "probabilitePluie" DECIMAL(5,2),
  ADD COLUMN "vitesseVent" DECIMAL(5,2),
  ALTER COLUMN "temperature" SET DATA TYPE DECIMAL(5,2),
  ALTER COLUMN "pluviometrie" SET DATA TYPE DECIMAL(5,2),
  ALTER COLUMN "timestampMesure" SET DATA TYPE TIMESTAMPTZ,
  ALTER COLUMN "bassinProductionId" DROP NOT NULL;

ALTER TABLE "GIC" ADD COLUMN "polygonId" TEXT, ADD COLUMN "previsionsMeteo" JSONB;
ALTER TABLE "HistoriqueProduction"
  ALTER COLUMN "superficieHa" SET DATA TYPE TEXT,
  ALTER COLUMN "rendementMoyen" SET DATA TYPE TEXT;
ALTER TABLE "ParcelEntry" ADD COLUMN "actualHarvestDate" VARCHAR(50);
ALTER TABLE "ProduitAgricole" ADD COLUMN "prix" DECIMAL(15,2), ADD COLUMN "unite" TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE "ProgrammeAgricole" ALTER COLUMN "urlLien" SET DATA TYPE TEXT;
ALTER TABLE "TransactionAcheteur"
  ADD COLUMN "clientRequestId" VARCHAR(100),
  ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "DonneesSol" (
  "id" BIGSERIAL NOT NULL,
  "temperatureSurface" DECIMAL(5,2) NOT NULL,
  "temperature10cm" DECIMAL(5,2) NOT NULL,
  "humidite" DECIMAL(5,2) NOT NULL,
  "timestampMesure" TIMESTAMPTZ NOT NULL,
  "gicId" BIGINT NOT NULL,
  CONSTRAINT "DonneesSol_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AlerteMeteo" (
  "id" BIGSERIAL NOT NULL,
  "messageCourt" TEXT NOT NULL,
  "detailsTechniques" JSONB NOT NULL,
  "type" TEXT NOT NULL,
  "timestampCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gicId" BIGINT NOT NULL,
  CONSTRAINT "AlerteMeteo_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VerificationCode" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "contact" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Admin" (
  "id" TEXT NOT NULL, "nom" TEXT NOT NULL, "contact" TEXT NOT NULL, "password" TEXT NOT NULL,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- Unique constraints are deliberately created only after consolidation.
CREATE UNIQUE INDEX "VerificationCode_contact_key" ON "VerificationCode"("contact");
CREATE UNIQUE INDEX "Admin_nom_key" ON "Admin"("nom");
CREATE UNIQUE INDEX "Admin_contact_key" ON "Admin"("contact");
CREATE UNIQUE INDEX "Acheteur_nui_key" ON "Acheteur"("nui");
CREATE UNIQUE INDEX "BassinProduction_nom_key" ON "BassinProduction"("nom");
CREATE UNIQUE INDEX "GIC_identifiantREF_key" ON "GIC"("identifiantREF");
CREATE UNIQUE INDEX "GIC_polygonId_key" ON "GIC"("polygonId");
CREATE UNIQUE INDEX "ProduitAgricole_nom_key" ON "ProduitAgricole"("nom");
CREATE INDEX "TransactionAcheteur_acheteurId_clientRequestId_idx" ON "TransactionAcheteur"("acheteurId", "clientRequestId");
CREATE UNIQUE INDEX "TransactionAcheteur_acheteurId_clientRequestId_recolteOffre_key"
  ON "TransactionAcheteur"("acheteurId", "clientRequestId", "recolteOffreId");

ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_gicId_fkey"
  FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_bassinProductionId_fkey"
  FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DonneesSol" ADD CONSTRAINT "DonneesSol_gicId_fkey"
  FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlerteMeteo" ADD CONSTRAINT "AlerteMeteo_gicId_fkey"
  FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Align every serial sequence with the maximum existing key.
DO $$
DECLARE
  r record;
  max_id bigint;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name,
           pg_get_serial_sequence(format('%I.%I', n.nspname, t.relname), a.attname) AS sequence_name
      FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE n.nspname='public' AND t.relkind='r'
       AND pg_get_serial_sequence(format('%I.%I', n.nspname, t.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format('SELECT max(%I)::bigint FROM %I.%I', r.column_name, r.schema_name, r.table_name) INTO max_id;
    PERFORM setval(r.sequence_name, COALESCE(max_id, 1), max_id IS NOT NULL);
  END LOOP;
END $$;

COMMIT;
