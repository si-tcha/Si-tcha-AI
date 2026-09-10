-- Migration Bloc 4 : création des tables manquantes (forward-only)
-- Tables B2BOfferEntry, ParcelEntry (+ champ actualHarvestDate),
-- PrefinancingEntry, TrustRatingEntry, GicNeedEntry et OtpCode.
--
-- NOTE DE RÉCONCILIATION : La colonne GIC.id est de type TEXT dans la DB
-- réelle (migration initiale 20260602175753_init), alors que schema.prisma
-- la déclare BigInt. Les FK vers GIC utilisent donc TEXT pour correspondre
-- à la DB réelle. Ce désalignement est un blocage documenté entre le schéma
-- Prisma et la DB existante ; il ne sera pas résolu dans ce bloc.

-- -----------------------------------------------------------------------
-- 1. B2BOfferEntry
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "B2BOfferEntry" (
    "id"              TEXT         NOT NULL,
    "title"           VARCHAR(200) NOT NULL,
    "type"            VARCHAR(20)  NOT NULL,
    "category"        VARCHAR(100) NOT NULL,
    "priceOrExchange" VARCHAR(200) NOT NULL,
    "gicName"         VARCHAR(100) NOT NULL,
    "location"        VARCHAR(200) NOT NULL,
    "contact"         VARCHAR(50)  NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId"           TEXT         NOT NULL,
    CONSTRAINT "B2BOfferEntry_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'B2BOfferEntry_gicId_fkey'
  ) THEN
    ALTER TABLE "B2BOfferEntry"
      ADD CONSTRAINT "B2BOfferEntry_gicId_fkey"
      FOREIGN KEY ("gicId") REFERENCES "GIC"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2. ParcelEntry (avec actualHarvestDate inclus dès la création)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ParcelEntry" (
    "id"                    TEXT             NOT NULL,
    "parcelName"            VARCHAR(200)     NOT NULL,
    "crop"                  VARCHAR(100)     NOT NULL,
    "sowingDate"            VARCHAR(50)      NOT NULL,
    "stage"                 VARCHAR(50)      NOT NULL,
    "estimatedHarvestDate"  VARCHAR(50)      NOT NULL,
    "estimatedVolumeKg"     DOUBLE PRECISION NOT NULL,
    "actualHarvestVolumeKg" DOUBLE PRECISION,
    "actualHarvestDate"     VARCHAR(50),
    "updatedAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId"                 TEXT             NOT NULL,
    CONSTRAINT "ParcelEntry_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ParcelEntry_gicId_fkey'
  ) THEN
    ALTER TABLE "ParcelEntry"
      ADD CONSTRAINT "ParcelEntry_gicId_fkey"
      FOREIGN KEY ("gicId") REFERENCES "GIC"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 3. PrefinancingEntry
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PrefinancingEntry" (
    "id"               TEXT             NOT NULL,
    "gicName"          VARCHAR(200)     NOT NULL,
    "buyerName"        VARCHAR(200)     NOT NULL,
    "amountFcfa"       DOUBLE PRECISION NOT NULL,
    "inputDescription" TEXT             NOT NULL,
    "reservedProduct"  VARCHAR(100)     NOT NULL,
    "reservedVolumeKg" DOUBLE PRECISION NOT NULL,
    "status"           VARCHAR(50)      NOT NULL DEFAULT 'propose',
    "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acheteurId"       TEXT,
    "gicId"            TEXT,
    CONSTRAINT "PrefinancingEntry_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------
-- 4. TrustRatingEntry
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrustRatingEntry" (
    "id"         TEXT         NOT NULL,
    "targetId"   VARCHAR(50)  NOT NULL,
    "targetType" VARCHAR(20)  NOT NULL,
    "rating"     INTEGER      NOT NULL,
    "comment"    TEXT         NOT NULL,
    "authorName" VARCHAR(100) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustRatingEntry_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------
-- 5. GicNeedEntry
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GicNeedEntry" (
    "id"          TEXT         NOT NULL,
    "category"    VARCHAR(50)  NOT NULL,
    "description" TEXT         NOT NULL,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorRole"  VARCHAR(50)  NOT NULL DEFAULT 'member',
    "gicId"       TEXT         NOT NULL,
    CONSTRAINT "GicNeedEntry_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GicNeedEntry_gicId_fkey'
  ) THEN
    ALTER TABLE "GicNeedEntry"
      ADD CONSTRAINT "GicNeedEntry_gicId_fkey"
      FOREIGN KEY ("gicId") REFERENCES "GIC"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 6. OtpCode
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OtpCode" (
    "id"        BIGSERIAL    NOT NULL,
    "phone"     VARCHAR(50)  NOT NULL,
    "code"      VARCHAR(10)  NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_phone_key" ON "OtpCode"("phone");
