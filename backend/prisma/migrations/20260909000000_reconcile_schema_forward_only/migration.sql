-- Migration: 20260909000000_reconcile_schema_forward_only

-- Step 1: Explicit verification of numeric data before TEXT -> BIGINT conversion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Acheteur' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "Acheteur" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Acheteur.id';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Agriculteur' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "Agriculteur" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Agriculteur.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "Agriculteur" WHERE "gicId" IS NOT NULL AND "gicId"::text !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Agriculteur.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AgronomeInterne' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "AgronomeInterne" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in AgronomeInterne.id';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AlerteMeteo' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "AlerteMeteo" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in AlerteMeteo.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "AlerteMeteo" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in AlerteMeteo.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AlertePhyto' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "AlertePhyto" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in AlertePhyto.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "AlertePhyto" WHERE "bassinProductionId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in AlertePhyto.bassinProductionId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BassinProduction' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "BassinProduction" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in BassinProduction.id';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BesoinGIC' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "BesoinGIC" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in BesoinGIC.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "BesoinGIC" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in BesoinGIC.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ChargeFinanciere' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "ChargeFinanciere" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in ChargeFinanciere.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "ChargeFinanciere" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in ChargeFinanciere.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DonneeMarche' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "DonneeMarche" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneeMarche.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "DonneeMarche" WHERE "produitAgricoleId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneeMarche.produitAgricoleId';
    END IF;
    IF EXISTS (SELECT 1 FROM "DonneeMarche" WHERE "bassinProductionId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneeMarche.bassinProductionId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DonneesMeteo' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "DonneesMeteo" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneesMeteo.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "DonneesMeteo" WHERE "gicId" IS NOT NULL AND "gicId"::text !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneesMeteo.gicId';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DonneesMeteo' AND column_name = 'bassinProductionId' AND data_type = 'text') THEN
      IF EXISTS (SELECT 1 FROM "DonneesMeteo" WHERE "bassinProductionId" IS NOT NULL AND "bassinProductionId"::text !~ '^[0-9]+$') THEN
        RAISE EXCEPTION 'Non-numeric data found in DonneesMeteo.bassinProductionId';
      END IF;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DonneesSol' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "DonneesSol" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneesSol.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "DonneesSol" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in DonneesSol.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'EchangeB2B' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "EchangeB2B" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in EchangeB2B.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "EchangeB2B" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in EchangeB2B.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Evaluation' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "Evaluation" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Evaluation.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "Evaluation" WHERE "transactionAcheteurId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Evaluation.transactionAcheteurId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GIC' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "GIC" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in GIC.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "GIC" WHERE "bassinProductionId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in GIC.bassinProductionId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'HistoriqueProduction' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "HistoriqueProduction" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in HistoriqueProduction.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "HistoriqueProduction" WHERE "produitAgricoleId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in HistoriqueProduction.produitAgricoleId';
    END IF;
    IF EXISTS (SELECT 1 FROM "HistoriqueProduction" WHERE "bassinProductionId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in HistoriqueProduction.bassinProductionId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'JournalCroissance' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "JournalCroissance" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in JournalCroissance.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "JournalCroissance" WHERE "recolteOffreId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in JournalCroissance.recolteOffreId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Prefinancement' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "Prefinancement" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Prefinancement.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "Prefinancement" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Prefinancement.gicId';
    END IF;
    IF EXISTS (SELECT 1 FROM "Prefinancement" WHERE "acheteurId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in Prefinancement.acheteurId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProduitAgricole' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in ProduitAgricole.id';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProgrammeAgricole' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "ProgrammeAgricole" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in ProgrammeAgricole.id';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'QuestionAgronomique' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "QuestionAgronomique" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in QuestionAgronomique.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "QuestionAgronomique" WHERE "agronomeInterneId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in QuestionAgronomique.agronomeInterneId';
    END IF;
    IF EXISTS (SELECT 1 FROM "QuestionAgronomique" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in QuestionAgronomique.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RecolteOffre' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "RecolteOffre" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in RecolteOffre.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "RecolteOffre" WHERE "produitAgricoleId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in RecolteOffre.produitAgricoleId';
    END IF;
    IF EXISTS (SELECT 1 FROM "RecolteOffre" WHERE "gicId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in RecolteOffre.gicId';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TransactionAcheteur' AND column_name = 'id' AND data_type = 'text') THEN
    IF EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE "id" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in TransactionAcheteur.id';
    END IF;
    IF EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE "recolteOffreId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in TransactionAcheteur.recolteOffreId';
    END IF;
    IF EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE "acheteurId" !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Non-numeric data found in TransactionAcheteur.acheteurId';
    END IF;
  END IF;
END $$;

-- Step 2: Drop old foreign keys
ALTER TABLE "Agriculteur" DROP CONSTRAINT IF EXISTS "Agriculteur_gicId_fkey";
ALTER TABLE "AlerteMeteo" DROP CONSTRAINT IF EXISTS "AlerteMeteo_gicId_fkey";
ALTER TABLE "AlertePhyto" DROP CONSTRAINT IF EXISTS "AlertePhyto_bassinProductionId_fkey";
ALTER TABLE "BesoinGIC" DROP CONSTRAINT IF EXISTS "BesoinGIC_gicId_fkey";
ALTER TABLE "ChargeFinanciere" DROP CONSTRAINT IF EXISTS "ChargeFinanciere_gicId_fkey";
ALTER TABLE "DonneeMarche" DROP CONSTRAINT IF EXISTS "DonneeMarche_bassinProductionId_fkey";
ALTER TABLE "DonneeMarche" DROP CONSTRAINT IF EXISTS "DonneeMarche_produitAgricoleId_fkey";
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT IF EXISTS "DonneesMeteo_bassinProductionId_fkey";
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT IF EXISTS "DonneesMeteo_gicId_fkey";
ALTER TABLE "DonneesSol" DROP CONSTRAINT IF EXISTS "DonneesSol_gicId_fkey";
ALTER TABLE "EchangeB2B" DROP CONSTRAINT IF EXISTS "EchangeB2B_gicId_fkey";
ALTER TABLE "Evaluation" DROP CONSTRAINT IF EXISTS "Evaluation_transactionAcheteurId_fkey";
ALTER TABLE "GIC" DROP CONSTRAINT IF EXISTS "GIC_bassinProductionId_fkey";
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT IF EXISTS "HistoriqueProduction_bassinProductionId_fkey";
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT IF EXISTS "HistoriqueProduction_produitAgricoleId_fkey";
ALTER TABLE "JournalCroissance" DROP CONSTRAINT IF EXISTS "JournalCroissance_recolteOffreId_fkey";
ALTER TABLE "Prefinancement" DROP CONSTRAINT IF EXISTS "Prefinancement_acheteurId_fkey";
ALTER TABLE "Prefinancement" DROP CONSTRAINT IF EXISTS "Prefinancement_gicId_fkey";
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT IF EXISTS "QuestionAgronomique_agronomeInterneId_fkey";
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT IF EXISTS "QuestionAgronomique_gicId_fkey";
ALTER TABLE "RecolteOffre" DROP CONSTRAINT IF EXISTS "RecolteOffre_gicId_fkey";
ALTER TABLE "RecolteOffre" DROP CONSTRAINT IF EXISTS "RecolteOffre_produitAgricoleId_fkey";
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT IF EXISTS "TransactionAcheteur_acheteurId_fkey";
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT IF EXISTS "TransactionAcheteur_recolteOffreId_fkey";

-- Step 3: Convert columns, sequences and primary keys

-- Acheteur
ALTER TABLE "Acheteur" DROP CONSTRAINT IF EXISTS "Acheteur_pkey";
ALTER TABLE "Acheteur" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "Acheteur_id_seq" AS BIGINT;
ALTER TABLE "Acheteur" ALTER COLUMN "id" SET DEFAULT nextval('"Acheteur_id_seq"'::regclass);
ALTER SEQUENCE "Acheteur_id_seq" OWNED BY "Acheteur"."id";
SELECT setval('"Acheteur_id_seq"', COALESCE((SELECT MAX("id") FROM "Acheteur"), 0) + 1, false);
ALTER TABLE "Acheteur" ADD CONSTRAINT "Acheteur_pkey" PRIMARY KEY ("id");

ALTER TABLE "Acheteur" ADD COLUMN IF NOT EXISTS "adresse" TEXT;
ALTER TABLE "Acheteur" ADD COLUMN IF NOT EXISTS "preferencesAlertes" TEXT;
ALTER TABLE "Acheteur" ADD COLUMN IF NOT EXISTS "pinHash" VARCHAR(100);
ALTER TABLE "Acheteur" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Acheteur' AND column_name = 'isVerified') THEN
    UPDATE "Acheteur" SET "phoneVerified" = "isVerified" WHERE "isVerified" = true AND "phoneVerified" = false;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Acheteur' AND column_name = 'pin') THEN
    UPDATE "Acheteur" SET "pinHash" = "pin" WHERE "pin" IS NOT NULL AND "pinHash" IS NULL;
  END IF;
END $$;

ALTER TABLE "Acheteur" ALTER COLUMN "nomEntreprise" TYPE VARCHAR(100);
ALTER TABLE "Acheteur" ALTER COLUMN "contact" TYPE VARCHAR(50);
ALTER TABLE "Acheteur" ALTER COLUMN "nom" DROP NOT NULL;
ALTER TABLE "Acheteur" ALTER COLUMN "nui" DROP NOT NULL;
ALTER TABLE "Acheteur" ALTER COLUMN "secteur_activite" DROP NOT NULL;
ALTER TABLE "Acheteur" ALTER COLUMN "pin" TYPE VARCHAR(100);

-- Agriculteur
ALTER TABLE "Agriculteur" DROP CONSTRAINT IF EXISTS "Agriculteur_pkey";
ALTER TABLE "Agriculteur" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "Agriculteur_id_seq" AS BIGINT;
ALTER TABLE "Agriculteur" ALTER COLUMN "id" SET DEFAULT nextval('"Agriculteur_id_seq"'::regclass);
ALTER SEQUENCE "Agriculteur_id_seq" OWNED BY "Agriculteur"."id";
SELECT setval('"Agriculteur_id_seq"', COALESCE((SELECT MAX("id") FROM "Agriculteur"), 0) + 1, false);
ALTER TABLE "Agriculteur" ADD CONSTRAINT "Agriculteur_pkey" PRIMARY KEY ("id");

ALTER TABLE "Agriculteur" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agriculteur" ADD COLUMN IF NOT EXISTS "pinHash" VARCHAR(100);
ALTER TABLE "Agriculteur" ADD COLUMN IF NOT EXISTS "prenom" VARCHAR(100);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Agriculteur' AND column_name = 'isVerified') THEN
    UPDATE "Agriculteur" SET "phoneVerified" = "isVerified" WHERE "isVerified" = true AND "phoneVerified" = false;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Agriculteur' AND column_name = 'pin') THEN
    UPDATE "Agriculteur" SET "pinHash" = "pin" WHERE "pin" IS NOT NULL AND "pinHash" IS NULL;
  END IF;
END $$;

ALTER TABLE "Agriculteur" ALTER COLUMN "nom" TYPE VARCHAR(100);
ALTER TABLE "Agriculteur" ALTER COLUMN "contact" TYPE VARCHAR(50);
ALTER TABLE "Agriculteur" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);
ALTER TABLE "Agriculteur" ALTER COLUMN "pin" TYPE VARCHAR(100);

-- AgronomeInterne
ALTER TABLE "AgronomeInterne" DROP CONSTRAINT IF EXISTS "AgronomeInterne_pkey";
ALTER TABLE "AgronomeInterne" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "AgronomeInterne_id_seq" AS BIGINT;
ALTER TABLE "AgronomeInterne" ALTER COLUMN "id" SET DEFAULT nextval('"AgronomeInterne_id_seq"'::regclass);
ALTER SEQUENCE "AgronomeInterne_id_seq" OWNED BY "AgronomeInterne"."id";
SELECT setval('"AgronomeInterne_id_seq"', COALESCE((SELECT MAX("id") FROM "AgronomeInterne"), 0) + 1, false);
ALTER TABLE "AgronomeInterne" ADD CONSTRAINT "AgronomeInterne_pkey" PRIMARY KEY ("id");
ALTER TABLE "AgronomeInterne" ALTER COLUMN "specialite" TYPE VARCHAR(50);
ALTER TABLE "AgronomeInterne" ALTER COLUMN "nom" TYPE VARCHAR(50);

-- AlerteMeteo
ALTER TABLE "AlerteMeteo" DROP CONSTRAINT IF EXISTS "AlerteMeteo_pkey";
ALTER TABLE "AlerteMeteo" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "AlerteMeteo_id_seq" AS BIGINT;
ALTER TABLE "AlerteMeteo" ALTER COLUMN "id" SET DEFAULT nextval('"AlerteMeteo_id_seq"'::regclass);
ALTER SEQUENCE "AlerteMeteo_id_seq" OWNED BY "AlerteMeteo"."id";
SELECT setval('"AlerteMeteo_id_seq"', COALESCE((SELECT MAX("id") FROM "AlerteMeteo"), 0) + 1, false);
ALTER TABLE "AlerteMeteo" ADD CONSTRAINT "AlerteMeteo_pkey" PRIMARY KEY ("id");
ALTER TABLE "AlerteMeteo" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- AlertePhyto
ALTER TABLE "AlertePhyto" DROP CONSTRAINT IF EXISTS "AlertePhyto_pkey";
ALTER TABLE "AlertePhyto" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "AlertePhyto_id_seq" AS BIGINT;
ALTER TABLE "AlertePhyto" ALTER COLUMN "id" SET DEFAULT nextval('"AlertePhyto_id_seq"'::regclass);
ALTER SEQUENCE "AlertePhyto_id_seq" OWNED BY "AlertePhyto"."id";
SELECT setval('"AlertePhyto_id_seq"', COALESCE((SELECT MAX("id") FROM "AlertePhyto"), 0) + 1, false);
ALTER TABLE "AlertePhyto" ADD CONSTRAINT "AlertePhyto_pkey" PRIMARY KEY ("id");
ALTER TABLE "AlertePhyto" ALTER COLUMN "ravageurMaladie" TYPE VARCHAR(50);
ALTER TABLE "AlertePhyto" ALTER COLUMN "protocoleUrgence" TYPE VARCHAR(250);
ALTER TABLE "AlertePhyto" ALTER COLUMN "bassinProductionId" TYPE BIGINT USING ("bassinProductionId"::bigint);

-- BassinProduction
ALTER TABLE "BassinProduction" DROP CONSTRAINT IF EXISTS "BassinProduction_pkey";
ALTER TABLE "BassinProduction" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "BassinProduction_id_seq" AS BIGINT;
ALTER TABLE "BassinProduction" ALTER COLUMN "id" SET DEFAULT nextval('"BassinProduction_id_seq"'::regclass);
ALTER SEQUENCE "BassinProduction_id_seq" OWNED BY "BassinProduction"."id";
SELECT setval('"BassinProduction_id_seq"', COALESCE((SELECT MAX("id") FROM "BassinProduction"), 0) + 1, false);
ALTER TABLE "BassinProduction" ADD CONSTRAINT "BassinProduction_pkey" PRIMARY KEY ("id");
ALTER TABLE "BassinProduction" ALTER COLUMN "nom" TYPE VARCHAR(50);
ALTER TABLE "BassinProduction" ALTER COLUMN "region" TYPE VARCHAR(50);

-- BesoinGIC
ALTER TABLE "BesoinGIC" DROP CONSTRAINT IF EXISTS "BesoinGIC_pkey";
ALTER TABLE "BesoinGIC" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "BesoinGIC_id_seq" AS BIGINT;
ALTER TABLE "BesoinGIC" ALTER COLUMN "id" SET DEFAULT nextval('"BesoinGIC_id_seq"'::regclass);
ALTER SEQUENCE "BesoinGIC_id_seq" OWNED BY "BesoinGIC"."id";
SELECT setval('"BesoinGIC_id_seq"', COALESCE((SELECT MAX("id") FROM "BesoinGIC"), 0) + 1, false);
ALTER TABLE "BesoinGIC" ADD CONSTRAINT "BesoinGIC_pkey" PRIMARY KEY ("id");
ALTER TABLE "BesoinGIC" ALTER COLUMN "categorieBesoin" TYPE VARCHAR(50);
ALTER TABLE "BesoinGIC" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- ChargeFinanciere
ALTER TABLE "ChargeFinanciere" DROP CONSTRAINT IF EXISTS "ChargeFinanciere_pkey";
ALTER TABLE "ChargeFinanciere" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "ChargeFinanciere_id_seq" AS BIGINT;
ALTER TABLE "ChargeFinanciere" ALTER COLUMN "id" SET DEFAULT nextval('"ChargeFinanciere_id_seq"'::regclass);
ALTER SEQUENCE "ChargeFinanciere_id_seq" OWNED BY "ChargeFinanciere"."id";
SELECT setval('"ChargeFinanciere_id_seq"', COALESCE((SELECT MAX("id") FROM "ChargeFinanciere"), 0) + 1, false);
ALTER TABLE "ChargeFinanciere" ADD CONSTRAINT "ChargeFinanciere_pkey" PRIMARY KEY ("id");
ALTER TABLE "ChargeFinanciere" ALTER COLUMN "typeCharge" TYPE VARCHAR(50);
ALTER TABLE "ChargeFinanciere" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- DonneeMarche
ALTER TABLE "DonneeMarche" DROP CONSTRAINT IF EXISTS "DonneeMarche_pkey";
ALTER TABLE "DonneeMarche" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "DonneeMarche_id_seq" AS BIGINT;
ALTER TABLE "DonneeMarche" ALTER COLUMN "id" SET DEFAULT nextval('"DonneeMarche_id_seq"'::regclass);
ALTER SEQUENCE "DonneeMarche_id_seq" OWNED BY "DonneeMarche"."id";
SELECT setval('"DonneeMarche_id_seq"', COALESCE((SELECT MAX("id") FROM "DonneeMarche"), 0) + 1, false);
ALTER TABLE "DonneeMarche" ADD CONSTRAINT "DonneeMarche_pkey" PRIMARY KEY ("id");
ALTER TABLE "DonneeMarche" ALTER COLUMN "produitAgricoleId" TYPE BIGINT USING ("produitAgricoleId"::bigint);
ALTER TABLE "DonneeMarche" ALTER COLUMN "bassinProductionId" TYPE BIGINT USING ("bassinProductionId"::bigint);

-- DonneesMeteo
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT IF EXISTS "DonneesMeteo_pkey";
ALTER TABLE "DonneesMeteo" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "DonneesMeteo_id_seq" AS BIGINT;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "id" SET DEFAULT nextval('"DonneesMeteo_id_seq"'::regclass);
ALTER SEQUENCE "DonneesMeteo_id_seq" OWNED BY "DonneesMeteo"."id";
SELECT setval('"DonneesMeteo_id_seq"', COALESCE((SELECT MAX("id") FROM "DonneesMeteo"), 0) + 1, false);
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_pkey" PRIMARY KEY ("id");
ALTER TABLE "DonneesMeteo" ADD COLUMN IF NOT EXISTS "bassinProductionId" BIGINT;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "gicId" DROP NOT NULL;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);
ALTER TABLE "DonneesMeteo" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "humidite" DROP NOT NULL;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "probabilitePluie" DROP NOT NULL;
ALTER TABLE "DonneesMeteo" ALTER COLUMN "vitesseVent" DROP NOT NULL;

-- DonneesSol
ALTER TABLE "DonneesSol" DROP CONSTRAINT IF EXISTS "DonneesSol_pkey";
ALTER TABLE "DonneesSol" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "DonneesSol_id_seq" AS BIGINT;
ALTER TABLE "DonneesSol" ALTER COLUMN "id" SET DEFAULT nextval('"DonneesSol_id_seq"'::regclass);
ALTER SEQUENCE "DonneesSol_id_seq" OWNED BY "DonneesSol"."id";
SELECT setval('"DonneesSol_id_seq"', COALESCE((SELECT MAX("id") FROM "DonneesSol"), 0) + 1, false);
ALTER TABLE "DonneesSol" ADD CONSTRAINT "DonneesSol_pkey" PRIMARY KEY ("id");
ALTER TABLE "DonneesSol" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- EchangeB2B
ALTER TABLE "EchangeB2B" DROP CONSTRAINT IF EXISTS "EchangeB2B_pkey";
ALTER TABLE "EchangeB2B" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "EchangeB2B_id_seq" AS BIGINT;
ALTER TABLE "EchangeB2B" ALTER COLUMN "id" SET DEFAULT nextval('"EchangeB2B_id_seq"'::regclass);
ALTER SEQUENCE "EchangeB2B_id_seq" OWNED BY "EchangeB2B"."id";
SELECT setval('"EchangeB2B_id_seq"', COALESCE((SELECT MAX("id") FROM "EchangeB2B"), 0) + 1, false);
ALTER TABLE "EchangeB2B" ADD CONSTRAINT "EchangeB2B_pkey" PRIMARY KEY ("id");
ALTER TABLE "EchangeB2B" ALTER COLUMN "typeEchange" TYPE VARCHAR(50);
ALTER TABLE "EchangeB2B" ALTER COLUMN "statut" TYPE VARCHAR(50);
ALTER TABLE "EchangeB2B" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- Evaluation
ALTER TABLE "Evaluation" DROP CONSTRAINT IF EXISTS "Evaluation_pkey";
ALTER TABLE "Evaluation" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "Evaluation_id_seq" AS BIGINT;
ALTER TABLE "Evaluation" ALTER COLUMN "id" SET DEFAULT nextval('"Evaluation_id_seq"'::regclass);
ALTER SEQUENCE "Evaluation_id_seq" OWNED BY "Evaluation"."id";
SELECT setval('"Evaluation_id_seq"', COALESCE((SELECT MAX("id") FROM "Evaluation"), 0) + 1, false);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id");
ALTER TABLE "Evaluation" ALTER COLUMN "roleAuteur" TYPE VARCHAR(50);
ALTER TABLE "Evaluation" ALTER COLUMN "transactionAcheteurId" TYPE BIGINT USING ("transactionAcheteurId"::bigint);

-- GIC
ALTER TABLE "GIC" DROP CONSTRAINT IF EXISTS "GIC_pkey";
ALTER TABLE "GIC" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "GIC_id_seq" AS BIGINT;
ALTER TABLE "GIC" ALTER COLUMN "id" SET DEFAULT nextval('"GIC_id_seq"'::regclass);
ALTER SEQUENCE "GIC_id_seq" OWNED BY "GIC"."id";
SELECT setval('"GIC_id_seq"', COALESCE((SELECT MAX("id") FROM "GIC"), 0) + 1, false);
ALTER TABLE "GIC" ADD CONSTRAINT "GIC_pkey" PRIMARY KEY ("id");
ALTER TABLE "GIC" ALTER COLUMN "nom" TYPE VARCHAR(100);
ALTER TABLE "GIC" ALTER COLUMN "logoURL" TYPE VARCHAR(250);
ALTER TABLE "GIC" ALTER COLUMN "identifiantREF" TYPE VARCHAR(50);
ALTER TABLE "GIC" ALTER COLUMN "statutLegalisation" TYPE VARCHAR(50);
ALTER TABLE "GIC" ALTER COLUMN "bassinProductionId" TYPE BIGINT USING ("bassinProductionId"::bigint);

-- HistoriqueProduction
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT IF EXISTS "HistoriqueProduction_pkey";
ALTER TABLE "HistoriqueProduction" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "HistoriqueProduction_id_seq" AS BIGINT;
ALTER TABLE "HistoriqueProduction" ALTER COLUMN "id" SET DEFAULT nextval('"HistoriqueProduction_id_seq"'::regclass);
ALTER SEQUENCE "HistoriqueProduction_id_seq" OWNED BY "HistoriqueProduction"."id";
SELECT setval('"HistoriqueProduction_id_seq"', COALESCE((SELECT MAX("id") FROM "HistoriqueProduction"), 0) + 1, false);
ALTER TABLE "HistoriqueProduction" ADD CONSTRAINT "HistoriqueProduction_pkey" PRIMARY KEY ("id");
ALTER TABLE "HistoriqueProduction" ALTER COLUMN "produitAgricoleId" TYPE BIGINT USING ("produitAgricoleId"::bigint);
ALTER TABLE "HistoriqueProduction" ALTER COLUMN "bassinProductionId" TYPE BIGINT USING ("bassinProductionId"::bigint);

-- JournalCroissance
ALTER TABLE "JournalCroissance" DROP CONSTRAINT IF EXISTS "JournalCroissance_pkey";
ALTER TABLE "JournalCroissance" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "JournalCroissance_id_seq" AS BIGINT;
ALTER TABLE "JournalCroissance" ALTER COLUMN "id" SET DEFAULT nextval('"JournalCroissance_id_seq"'::regclass);
ALTER SEQUENCE "JournalCroissance_id_seq" OWNED BY "JournalCroissance"."id";
SELECT setval('"JournalCroissance_id_seq"', COALESCE((SELECT MAX("id") FROM "JournalCroissance"), 0) + 1, false);
ALTER TABLE "JournalCroissance" ADD CONSTRAINT "JournalCroissance_pkey" PRIMARY KEY ("id");
ALTER TABLE "JournalCroissance" ALTER COLUMN "etatLevee" TYPE VARCHAR(50);
ALTER TABLE "JournalCroissance" ALTER COLUMN "recolteOffreId" TYPE BIGINT USING ("recolteOffreId"::bigint);

-- Prefinancement
ALTER TABLE "Prefinancement" DROP CONSTRAINT IF EXISTS "Prefinancement_pkey";
ALTER TABLE "Prefinancement" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "Prefinancement_id_seq" AS BIGINT;
ALTER TABLE "Prefinancement" ALTER COLUMN "id" SET DEFAULT nextval('"Prefinancement_id_seq"'::regclass);
ALTER SEQUENCE "Prefinancement_id_seq" OWNED BY "Prefinancement"."id";
SELECT setval('"Prefinancement_id_seq"', COALESCE((SELECT MAX("id") FROM "Prefinancement"), 0) + 1, false);
ALTER TABLE "Prefinancement" ADD CONSTRAINT "Prefinancement_pkey" PRIMARY KEY ("id");
ALTER TABLE "Prefinancement" ALTER COLUMN "type" TYPE VARCHAR(50);
ALTER TABLE "Prefinancement" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);
ALTER TABLE "Prefinancement" ALTER COLUMN "acheteurId" TYPE BIGINT USING ("acheteurId"::bigint);

-- ProduitAgricole
ALTER TABLE "ProduitAgricole" DROP CONSTRAINT IF EXISTS "ProduitAgricole_pkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProduitAgricole' AND column_name = 'imageUrl') THEN
    ALTER TABLE "ProduitAgricole" RENAME COLUMN "imageUrl" TO "imageURL";
  ELSE
    ALTER TABLE "ProduitAgricole" ADD COLUMN IF NOT EXISTS "imageURL" VARCHAR(250);
  END IF;
END $$;
ALTER TABLE "ProduitAgricole" ALTER COLUMN "imageURL" TYPE VARCHAR(250);
ALTER TABLE "ProduitAgricole" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "ProduitAgricole_id_seq" AS BIGINT;
ALTER TABLE "ProduitAgricole" ALTER COLUMN "id" SET DEFAULT nextval('"ProduitAgricole_id_seq"'::regclass);
ALTER SEQUENCE "ProduitAgricole_id_seq" OWNED BY "ProduitAgricole"."id";
SELECT setval('"ProduitAgricole_id_seq"', COALESCE((SELECT MAX("id") FROM "ProduitAgricole"), 0) + 1, false);
ALTER TABLE "ProduitAgricole" ADD CONSTRAINT "ProduitAgricole_pkey" PRIMARY KEY ("id");
ALTER TABLE "ProduitAgricole" ALTER COLUMN "nom" TYPE VARCHAR(50);
ALTER TABLE "ProduitAgricole" ALTER COLUMN "categorie" TYPE VARCHAR(50);

-- ProgrammeAgricole
ALTER TABLE "ProgrammeAgricole" DROP CONSTRAINT IF EXISTS "ProgrammeAgricole_pkey";
ALTER TABLE "ProgrammeAgricole" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "ProgrammeAgricole_id_seq" AS BIGINT;
ALTER TABLE "ProgrammeAgricole" ALTER COLUMN "id" SET DEFAULT nextval('"ProgrammeAgricole_id_seq"'::regclass);
ALTER SEQUENCE "ProgrammeAgricole_id_seq" OWNED BY "ProgrammeAgricole"."id";
SELECT setval('"ProgrammeAgricole_id_seq"', COALESCE((SELECT MAX("id") FROM "ProgrammeAgricole"), 0) + 1, false);
ALTER TABLE "ProgrammeAgricole" ADD CONSTRAINT "ProgrammeAgricole_pkey" PRIMARY KEY ("id");
ALTER TABLE "ProgrammeAgricole" ALTER COLUMN "nom" TYPE VARCHAR(100);

-- QuestionAgronomique
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT IF EXISTS "QuestionAgronomique_pkey";
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "QuestionAgronomique_id_seq" AS BIGINT;
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "id" SET DEFAULT nextval('"QuestionAgronomique_id_seq"'::regclass);
ALTER SEQUENCE "QuestionAgronomique_id_seq" OWNED BY "QuestionAgronomique"."id";
SELECT setval('"QuestionAgronomique_id_seq"', COALESCE((SELECT MAX("id") FROM "QuestionAgronomique"), 0) + 1, false);
ALTER TABLE "QuestionAgronomique" ADD CONSTRAINT "QuestionAgronomique_pkey" PRIMARY KEY ("id");
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "mediaUrl" TYPE VARCHAR(250);
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "statut" TYPE VARCHAR(50);
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "agronomeInterneId" TYPE BIGINT USING ("agronomeInterneId"::bigint);
ALTER TABLE "QuestionAgronomique" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- RecolteOffre
ALTER TABLE "RecolteOffre" DROP CONSTRAINT IF EXISTS "RecolteOffre_pkey";
ALTER TABLE "RecolteOffre" ADD COLUMN IF NOT EXISTS "photoURL" VARCHAR(250);
ALTER TABLE "RecolteOffre" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "RecolteOffre_id_seq" AS BIGINT;
ALTER TABLE "RecolteOffre" ALTER COLUMN "id" SET DEFAULT nextval('"RecolteOffre_id_seq"'::regclass);
ALTER SEQUENCE "RecolteOffre_id_seq" OWNED BY "RecolteOffre"."id";
SELECT setval('"RecolteOffre_id_seq"', COALESCE((SELECT MAX("id") FROM "RecolteOffre"), 0) + 1, false);
ALTER TABLE "RecolteOffre" ADD CONSTRAINT "RecolteOffre_pkey" PRIMARY KEY ("id");
ALTER TABLE "RecolteOffre" ALTER COLUMN "maturite" TYPE VARCHAR(50);
ALTER TABLE "RecolteOffre" ALTER COLUMN "produitAgricoleId" TYPE BIGINT USING ("produitAgricoleId"::bigint);
ALTER TABLE "RecolteOffre" ALTER COLUMN "gicId" TYPE BIGINT USING ("gicId"::bigint);

-- TransactionAcheteur
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT IF EXISTS "TransactionAcheteur_pkey";
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "id" TYPE BIGINT USING ("id"::bigint);
CREATE SEQUENCE IF NOT EXISTS "TransactionAcheteur_id_seq" AS BIGINT;
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "id" SET DEFAULT nextval('"TransactionAcheteur_id_seq"'::regclass);
ALTER SEQUENCE "TransactionAcheteur_id_seq" OWNED BY "TransactionAcheteur"."id";
SELECT setval('"TransactionAcheteur_id_seq"', COALESCE((SELECT MAX("id") FROM "TransactionAcheteur"), 0) + 1, false);
ALTER TABLE "TransactionAcheteur" ADD CONSTRAINT "TransactionAcheteur_pkey" PRIMARY KEY ("id");
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "type" TYPE VARCHAR(50);
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "statut" TYPE VARCHAR(50);
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "recolteOffreId" TYPE BIGINT USING ("recolteOffreId"::bigint);
ALTER TABLE "TransactionAcheteur" ALTER COLUMN "acheteurId" TYPE BIGINT USING ("acheteurId"::bigint);

-- Step 4: Missing Tables

-- OtpCode
CREATE TABLE IF NOT EXISTS "OtpCode" (
    "id" BIGSERIAL NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- B2BOfferEntry
CREATE TABLE IF NOT EXISTS "B2BOfferEntry" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "priceOrExchange" VARCHAR(200) NOT NULL,
    "gicName" VARCHAR(100) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "contact" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId" BIGINT NOT NULL,
    CONSTRAINT "B2BOfferEntry_pkey" PRIMARY KEY ("id")
);

-- ParcelEntry
CREATE TABLE IF NOT EXISTS "ParcelEntry" (
    "id" TEXT NOT NULL,
    "parcelName" VARCHAR(200) NOT NULL,
    "crop" VARCHAR(100) NOT NULL,
    "sowingDate" VARCHAR(50) NOT NULL,
    "stage" VARCHAR(50) NOT NULL,
    "estimatedHarvestDate" VARCHAR(50) NOT NULL,
    "estimatedVolumeKg" DOUBLE PRECISION NOT NULL,
    "actualHarvestVolumeKg" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId" BIGINT NOT NULL,
    CONSTRAINT "ParcelEntry_pkey" PRIMARY KEY ("id")
);

-- PrefinancingEntry
CREATE TABLE IF NOT EXISTS "PrefinancingEntry" (
    "id" TEXT NOT NULL,
    "gicName" VARCHAR(200) NOT NULL,
    "buyerName" VARCHAR(200) NOT NULL,
    "amountFcfa" DOUBLE PRECISION NOT NULL,
    "inputDescription" TEXT NOT NULL,
    "reservedProduct" VARCHAR(100) NOT NULL,
    "reservedVolumeKg" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'propose',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acheteurId" BIGINT,
    "gicId" BIGINT,
    CONSTRAINT "PrefinancingEntry_pkey" PRIMARY KEY ("id")
);

-- TrustRatingEntry
CREATE TABLE IF NOT EXISTS "TrustRatingEntry" (
    "id" TEXT NOT NULL,
    "targetId" VARCHAR(50) NOT NULL,
    "targetType" VARCHAR(20) NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "authorName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustRatingEntry_pkey" PRIMARY KEY ("id")
);

-- GicNeedEntry
CREATE TABLE IF NOT EXISTS "GicNeedEntry" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorRole" VARCHAR(50) NOT NULL DEFAULT 'member',
    "gicId" BIGINT NOT NULL,
    CONSTRAINT "GicNeedEntry_pkey" PRIMARY KEY ("id")
);

-- Step 5: Indexes & Constraints

CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_phone_key" ON "OtpCode"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalCroissance_recolteOffreId_key" ON "JournalCroissance"("recolteOffreId");

-- Ensure indices for TransactionAcheteur
DROP INDEX IF EXISTS "TransactionAcheteur_acheteurId_clientRequestId_recolteOffreId_k";
DROP INDEX IF EXISTS "TransactionAcheteur_acheteurId_clientRequestId_recolteOffre_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionAcheteur_acheteurId_clientRequestId_recolteOffreId_key"
  ON "TransactionAcheteur"("acheteurId", "clientRequestId", "recolteOffreId");
ALTER INDEX IF EXISTS "TransactionAcheteur_acheteurId_clientRequestId_recolteOffreId_k"
  RENAME TO "TransactionAcheteur_acheteurId_clientRequestId_recolteOffre_key";
CREATE INDEX IF NOT EXISTS "TransactionAcheteur_acheteurId_clientRequestId_idx"
  ON "TransactionAcheteur"("acheteurId", "clientRequestId");

-- Step 6: Foreign Keys
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DonneesSol" ADD CONSTRAINT "DonneesSol_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlerteMeteo" ADD CONSTRAINT "AlerteMeteo_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DonneeMarche" ADD CONSTRAINT "DonneeMarche_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DonneeMarche" ADD CONSTRAINT "DonneeMarche_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertePhyto" ADD CONSTRAINT "AlertePhyto_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoriqueProduction" ADD CONSTRAINT "HistoriqueProduction_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoriqueProduction" ADD CONSTRAINT "HistoriqueProduction_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GIC" ADD CONSTRAINT "GIC_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecolteOffre" ADD CONSTRAINT "RecolteOffre_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecolteOffre" ADD CONSTRAINT "RecolteOffre_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionAcheteur" ADD CONSTRAINT "TransactionAcheteur_recolteOffreId_fkey" FOREIGN KEY ("recolteOffreId") REFERENCES "RecolteOffre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionAcheteur" ADD CONSTRAINT "TransactionAcheteur_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BesoinGIC" ADD CONSTRAINT "BesoinGIC_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChargeFinanciere" ADD CONSTRAINT "ChargeFinanciere_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalCroissance" ADD CONSTRAINT "JournalCroissance_recolteOffreId_fkey" FOREIGN KEY ("recolteOffreId") REFERENCES "RecolteOffre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionAgronomique" ADD CONSTRAINT "QuestionAgronomique_agronomeInterneId_fkey" FOREIGN KEY ("agronomeInterneId") REFERENCES "AgronomeInterne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionAgronomique" ADD CONSTRAINT "QuestionAgronomique_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EchangeB2B" ADD CONSTRAINT "EchangeB2B_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prefinancement" ADD CONSTRAINT "Prefinancement_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prefinancement" ADD CONSTRAINT "Prefinancement_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_transactionAcheteurId_fkey" FOREIGN KEY ("transactionAcheteurId") REFERENCES "TransactionAcheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agriculteur" ADD CONSTRAINT "Agriculteur_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "B2BOfferEntry" ADD CONSTRAINT "B2BOfferEntry_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelEntry" ADD CONSTRAINT "ParcelEntry_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GicNeedEntry" ADD CONSTRAINT "GicNeedEntry_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
