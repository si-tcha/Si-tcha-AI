CREATE TYPE "LangueAgriculteur" AS ENUM ('FR', 'EN');
CREATE TYPE "PhaseCulture" AS ENUM ('PREPARATION', 'IMPLANTATION', 'CROISSANCE', 'ENTRETIEN', 'RECOLTE', 'STOCKAGE');
CREATE TYPE "StatutEtapeCulture" AS ENUM ('A_VENIR', 'EN_COURS', 'TERMINEE', 'ANNULEE');
CREATE TYPE "StatutCycleCulture" AS ENUM ('EN_COURS', 'TERMINE', 'ANNULE');
CREATE TYPE "NiveauAlerte" AS ENUM ('INFO', 'ATTENTION', 'URGENT');
CREATE TYPE "StatutNotificationSMS" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC');
CREATE TYPE "StatutParcelle" AS ENUM ('ACTIVE', 'ARCHIVEE');

ALTER TABLE "DonneesSol"
ALTER COLUMN "humidite" TYPE DECIMAL(5,4)
USING "humidite"::DECIMAL(5,4);

ALTER TABLE "Agriculteur"
ADD COLUMN "langue" "LangueAgriculteur" NOT NULL DEFAULT 'FR';

ALTER TABLE "GIC"
ADD COLUMN "agronomeInterneId" TEXT;

ALTER TABLE "DonneesMeteo"
ADD COLUMN "parcelleId" TEXT;

ALTER TABLE "DonneesSol"
ADD COLUMN "parcelleId" TEXT;

ALTER TABLE "AlerteMeteo"
ADD COLUMN "messageCourtEn" TEXT,
ADD COLUMN "niveau" "NiveauAlerte" NOT NULL DEFAULT 'ATTENTION',
ADD COLUMN "cleDeduplication" TEXT,
ADD COLUMN "parcelleId" TEXT;

CREATE TABLE "Parcelle" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "zone" TEXT,
    "localisation" TEXT,
    "surfaceHa" DECIMAL(12,4),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geoJson" JSONB,
    "agroMonitoringPolygonId" TEXT,
    "statut" "StatutParcelle" NOT NULL DEFAULT 'ACTIVE',
    "dateCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMaj" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId" TEXT NOT NULL,
    CONSTRAINT "Parcelle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Parcelle_agroMonitoringPolygonId_key" ON "Parcelle"("agroMonitoringPolygonId");
CREATE INDEX "Parcelle_gicId_statut_idx" ON "Parcelle"("gicId", "statut");
CREATE UNIQUE INDEX "Parcelle_gicId_id_key" ON "Parcelle"("gicId", "id");

INSERT INTO "Parcelle" ("id", "nom", "gicId", "agroMonitoringPolygonId")
SELECT gen_random_uuid()::text, 'Parcelle principale', "id", "polygonId"
FROM "GIC"
WHERE "polygonId" IS NOT NULL;

UPDATE "DonneesMeteo" AS mesure
SET "parcelleId" = parcelle."id"
FROM "Parcelle" AS parcelle
WHERE parcelle."gicId" = mesure."gicId"
  AND parcelle."agroMonitoringPolygonId" IS NOT NULL;

UPDATE "DonneesSol" AS mesure
SET "parcelleId" = parcelle."id"
FROM "Parcelle" AS parcelle
WHERE parcelle."gicId" = mesure."gicId"
  AND parcelle."agroMonitoringPolygonId" IS NOT NULL;

UPDATE "AlerteMeteo" AS alerte
SET "parcelleId" = parcelle."id"
FROM "Parcelle" AS parcelle
WHERE parcelle."gicId" = alerte."gicId"
  AND parcelle."agroMonitoringPolygonId" IS NOT NULL;

CREATE TABLE "AgriculteurParcelle" (
    "agriculteurId" TEXT NOT NULL,
    "parcelleId" TEXT NOT NULL,
    "gicId" TEXT NOT NULL,
    "fonction" TEXT,
    "dateAffectation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgriculteurParcelle_pkey" PRIMARY KEY ("agriculteurId", "parcelleId")
);

CREATE INDEX "AgriculteurParcelle_parcelleId_idx" ON "AgriculteurParcelle"("parcelleId");

CREATE TABLE "CycleCulture" (
    "id" TEXT NOT NULL,
    "culture" TEXT NOT NULL,
    "variete" TEXT,
    "surfaceHa" DECIMAL(12,4),
    "dateSemis" DATE,
    "dateDebut" DATE,
    "dateFin" DATE,
    "statut" "StatutCycleCulture" NOT NULL DEFAULT 'EN_COURS',
    "dateCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcelleId" TEXT NOT NULL,
    CONSTRAINT "CycleCulture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CycleCulture_parcelleId_statut_idx" ON "CycleCulture"("parcelleId", "statut");

CREATE TABLE "EtapeCycleCulture" (
    "id" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "phase" "PhaseCulture" NOT NULL,
    "statut" "StatutEtapeCulture" NOT NULL DEFAULT 'A_VENIR',
    "dateDebut" DATE,
    "dateFin" DATE,
    "note" TEXT,
    "cycleCultureId" TEXT NOT NULL,
    CONSTRAINT "EtapeCycleCulture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EtapeCycleCulture_cycleCultureId_ordre_key" ON "EtapeCycleCulture"("cycleCultureId", "ordre");

CREATE TABLE "PrevisionMeteo" (
    "id" TEXT NOT NULL,
    "timestampPrevision" TIMESTAMPTZ NOT NULL,
    "temperature" DECIMAL(5,2),
    "humidite" DECIMAL(5,2),
    "pluviometrie" DECIMAL(7,2),
    "probabilitePluie" DECIMAL(5,4),
    "vitesseVent" DECIMAL(5,2),
    "description" TEXT,
    "donneesBrutes" JSONB NOT NULL,
    "dateReception" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcelleId" TEXT NOT NULL,
    CONSTRAINT "PrevisionMeteo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrevisionMeteo_parcelleId_timestampPrevision_key" ON "PrevisionMeteo"("parcelleId", "timestampPrevision");

CREATE TABLE "ObservationSatellite" (
    "id" TEXT NOT NULL,
    "dateObservation" TIMESTAMPTZ NOT NULL,
    "satellite" TEXT NOT NULL,
    "couvertureNuageuse" DECIMAL(5,2),
    "ndviMoyen" DECIMAL(7,5),
    "statistiques" JSONB,
    "imageNDVIUrl" TEXT,
    "imageCouleurUrl" TEXT,
    "tuileNDVIUrl" TEXT,
    "geoTiffNDVIUrl" TEXT,
    "dateReception" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcelleId" TEXT NOT NULL,
    CONSTRAINT "ObservationSatellite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObservationSatellite_parcelleId_dateObservation_satellite_key" ON "ObservationSatellite"("parcelleId", "dateObservation", "satellite");

CREATE TABLE "NotificationSMS" (
    "id" TEXT NOT NULL,
    "statut" "StatutNotificationSMS" NOT NULL DEFAULT 'EN_ATTENTE',
    "identifiantFournisseur" TEXT,
    "contenu" TEXT NOT NULL,
    "langue" "LangueAgriculteur" NOT NULL,
    "erreur" TEXT,
    "dateCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEnvoi" TIMESTAMPTZ,
    "alerteMeteoId" TEXT,
    "agriculteurId" TEXT NOT NULL,
    CONSTRAINT "NotificationSMS_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationSMS_alerteMeteoId_agriculteurId_key" ON "NotificationSMS"("alerteMeteoId", "agriculteurId");
CREATE INDEX "NotificationSMS_agriculteurId_dateCreation_idx" ON "NotificationSMS"("agriculteurId", "dateCreation");
CREATE UNIQUE INDEX "AlerteMeteo_cleDeduplication_key" ON "AlerteMeteo"("cleDeduplication");

CREATE INDEX "GIC_agronomeInterneId_idx" ON "GIC"("agronomeInterneId");
CREATE UNIQUE INDEX "Agriculteur_gicId_id_key" ON "Agriculteur"("gicId", "id");
CREATE INDEX "DonneesMeteo_gicId_timestampMesure_idx" ON "DonneesMeteo"("gicId", "timestampMesure");
CREATE INDEX "DonneesMeteo_parcelleId_timestampMesure_idx" ON "DonneesMeteo"("parcelleId", "timestampMesure");
CREATE INDEX "DonneesSol_gicId_timestampMesure_idx" ON "DonneesSol"("gicId", "timestampMesure");
CREATE INDEX "DonneesSol_parcelleId_timestampMesure_idx" ON "DonneesSol"("parcelleId", "timestampMesure");
CREATE INDEX "AlerteMeteo_gicId_timestampCreation_idx" ON "AlerteMeteo"("gicId", "timestampCreation");
CREATE INDEX "AlerteMeteo_parcelleId_timestampCreation_idx" ON "AlerteMeteo"("parcelleId", "timestampCreation");

ALTER TABLE "Parcelle"
ADD CONSTRAINT "Parcelle_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgriculteurParcelle"
ADD CONSTRAINT "AgriculteurParcelle_gicId_agriculteurId_fkey" FOREIGN KEY ("gicId", "agriculteurId") REFERENCES "Agriculteur"("gicId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "AgriculteurParcelle_gicId_parcelleId_fkey" FOREIGN KEY ("gicId", "parcelleId") REFERENCES "Parcelle"("gicId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CycleCulture"
ADD CONSTRAINT "CycleCulture_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EtapeCycleCulture"
ADD CONSTRAINT "EtapeCycleCulture_cycleCultureId_fkey" FOREIGN KEY ("cycleCultureId") REFERENCES "CycleCulture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrevisionMeteo"
ADD CONSTRAINT "PrevisionMeteo_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ObservationSatellite"
ADD CONSTRAINT "ObservationSatellite_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationSMS"
ADD CONSTRAINT "NotificationSMS_alerteMeteoId_fkey" FOREIGN KEY ("alerteMeteoId") REFERENCES "AlerteMeteo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationSMS_agriculteurId_fkey" FOREIGN KEY ("agriculteurId") REFERENCES "Agriculteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GIC"
ADD CONSTRAINT "GIC_agronomeInterneId_fkey" FOREIGN KEY ("agronomeInterneId") REFERENCES "AgronomeInterne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DonneesMeteo"
ADD CONSTRAINT "DonneesMeteo_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DonneesSol"
ADD CONSTRAINT "DonneesSol_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlerteMeteo"
ADD CONSTRAINT "AlerteMeteo_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;