-- CreateTable
CREATE TABLE "Acheteur" (
    "id" BIGSERIAL NOT NULL,
    "nomEntreprise" VARCHAR(50) NOT NULL,
    "contact" VARCHAR(50) NOT NULL,
    "preferencesAlertes" JSONB NOT NULL,

    CONSTRAINT "Acheteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BassinProduction" (
    "id" BIGSERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "region" VARCHAR(50) NOT NULL,
    "latitude" DECIMAL(15,2) NOT NULL,
    "longitude" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "BassinProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduitAgricole" (
    "id" BIGSERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "categorie" VARCHAR(50) NOT NULL,

    CONSTRAINT "ProduitAgricole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonneesMeteo" (
    "id" BIGSERIAL NOT NULL,
    "temperature" DECIMAL(15,2) NOT NULL,
    "pluviometrie" DECIMAL(15,2) NOT NULL,
    "timestampMesure" DATE NOT NULL,
    "bassinProductionId" BIGINT NOT NULL,

    CONSTRAINT "DonneesMeteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonneeMarche" (
    "id" BIGSERIAL NOT NULL,
    "prixMoyen" DECIMAL(15,2) NOT NULL,
    "rentabilite" DECIMAL(15,2) NOT NULL,
    "dateReleve" DATE NOT NULL,
    "produitAgricoleId" BIGINT NOT NULL,
    "bassinProductionId" BIGINT NOT NULL,

    CONSTRAINT "DonneeMarche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertePhyto" (
    "id" BIGSERIAL NOT NULL,
    "ravageurMaladie" VARCHAR(50) NOT NULL,
    "protocoleUrgence" VARCHAR(250) NOT NULL,
    "dateEmission" DATE NOT NULL,
    "bassinProductionId" BIGINT NOT NULL,

    CONSTRAINT "AlertePhyto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgronomeInterne" (
    "id" BIGSERIAL NOT NULL,
    "specialite" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(50) NOT NULL,

    CONSTRAINT "AgronomeInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeAgricole" (
    "id" BIGSERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "description" VARCHAR(50) NOT NULL,
    "criteresEligibilite" VARCHAR(50) NOT NULL,
    "dateLimite" DATE NOT NULL,
    "urlLien" VARCHAR(50) NOT NULL,

    CONSTRAINT "ProgrammeAgricole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueProduction" (
    "id" BIGSERIAL NOT NULL,
    "anneeCampagne" INTEGER NOT NULL,
    "quantiteTotale" DECIMAL(15,2) NOT NULL,
    "superficieHa" VARCHAR(50) NOT NULL,
    "rendementMoyen" VARCHAR(50) NOT NULL,
    "prixMoyen" DECIMAL(15,2) NOT NULL,
    "timestampMaj" DATE,
    "produitAgricoleId" BIGINT NOT NULL,
    "bassinProductionId" BIGINT NOT NULL,

    CONSTRAINT "HistoriqueProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GIC" (
    "id" BIGSERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "logoURL" VARCHAR(50) NOT NULL,
    "reglementInterieur" VARCHAR(250),
    "activitesPrincipales" VARCHAR(50) NOT NULL,
    "identifiantREF" VARCHAR(50) NOT NULL,
    "statutLegalisation" VARCHAR(50) NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "bassinProductionId" BIGINT NOT NULL,

    CONSTRAINT "GIC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecolteOffre" (
    "id" BIGSERIAL NOT NULL,
    "quantiteEstimee" DECIMAL(15,2) NOT NULL,
    "quantiteDisponible" DECIMAL(15,2) NOT NULL,
    "dateDispoEstimee" DATE NOT NULL,
    "maturite" VARCHAR(50) NOT NULL,
    "alerteBaisseEmise" BOOLEAN,
    "timestampMaj" DATE NOT NULL,
    "produitAgricoleId" BIGINT NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "RecolteOffre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAcheteur" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "quantite" DECIMAL(15,2) NOT NULL,
    "prixConvenu" DECIMAL(15,2) NOT NULL,
    "statut" VARCHAR(50) NOT NULL,
    "recolteOffreId" BIGINT NOT NULL,
    "acheteurId" BIGINT NOT NULL,

    CONSTRAINT "TransactionAcheteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BesoinGIC" (
    "id" BIGSERIAL NOT NULL,
    "categorieBesoin" VARCHAR(50) NOT NULL,
    "description" VARCHAR(50) NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "BesoinGIC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeFinanciere" (
    "id" BIGSERIAL NOT NULL,
    "typeCharge" VARCHAR(50) NOT NULL,
    "montant" DECIMAL(15,2) NOT NULL,
    "surfaceHaConcernee" DECIMAL(15,2) NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "ChargeFinanciere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalCroissance" (
    "id" BIGSERIAL NOT NULL,
    "dateSemis" DATE NOT NULL,
    "etatLevee" VARCHAR(50) NOT NULL,
    "traitementsAppliques" VARCHAR(150) NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "recolteOffreId" BIGINT NOT NULL,

    CONSTRAINT "JournalCroissance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAgronomique" (
    "id" BIGSERIAL NOT NULL,
    "questionTexte" VARCHAR(250) NOT NULL,
    "mediaUrl" VARCHAR(50) NOT NULL,
    "statut" VARCHAR(50) NOT NULL,
    "reponseAgronome" VARCHAR(250),
    "timestampMaj" DATE NOT NULL,
    "agronomeInterneId" BIGINT NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "QuestionAgronomique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchangeB2B" (
    "id" BIGSERIAL NOT NULL,
    "typeEchange" VARCHAR(50) NOT NULL,
    "description" VARCHAR(50),
    "statut" VARCHAR(50) NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "EchangeB2B_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prefinancement" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "montantValeur" DECIMAL(15,2) NOT NULL,
    "conditions" VARCHAR(250) NOT NULL,
    "gicId" BIGINT NOT NULL,
    "acheteurId" BIGINT NOT NULL,

    CONSTRAINT "Prefinancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" BIGSERIAL NOT NULL,
    "noteDelai" INTEGER NOT NULL,
    "notePaiement" INTEGER NOT NULL,
    "noteQualite" INTEGER NOT NULL,
    "commentaire" VARCHAR(50) NOT NULL,
    "roleAuteur" VARCHAR(50) NOT NULL,
    "transactionAcheteurId" BIGINT NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agriculteur" (
    "id" BIGSERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "prenom" VARCHAR(50) NOT NULL,
    "contact" VARCHAR(50) NOT NULL,
    "estLeader" BOOLEAN NOT NULL,
    "timestampMaj" DATE NOT NULL,
    "gicId" BIGINT NOT NULL,

    CONSTRAINT "Agriculteur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalCroissance_recolteOffreId_key" ON "JournalCroissance"("recolteOffreId");

-- AddForeignKey
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonneeMarche" ADD CONSTRAINT "DonneeMarche_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonneeMarche" ADD CONSTRAINT "DonneeMarche_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertePhyto" ADD CONSTRAINT "AlertePhyto_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueProduction" ADD CONSTRAINT "HistoriqueProduction_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueProduction" ADD CONSTRAINT "HistoriqueProduction_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GIC" ADD CONSTRAINT "GIC_bassinProductionId_fkey" FOREIGN KEY ("bassinProductionId") REFERENCES "BassinProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecolteOffre" ADD CONSTRAINT "RecolteOffre_produitAgricoleId_fkey" FOREIGN KEY ("produitAgricoleId") REFERENCES "ProduitAgricole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecolteOffre" ADD CONSTRAINT "RecolteOffre_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAcheteur" ADD CONSTRAINT "TransactionAcheteur_recolteOffreId_fkey" FOREIGN KEY ("recolteOffreId") REFERENCES "RecolteOffre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAcheteur" ADD CONSTRAINT "TransactionAcheteur_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BesoinGIC" ADD CONSTRAINT "BesoinGIC_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeFinanciere" ADD CONSTRAINT "ChargeFinanciere_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCroissance" ADD CONSTRAINT "JournalCroissance_recolteOffreId_fkey" FOREIGN KEY ("recolteOffreId") REFERENCES "RecolteOffre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAgronomique" ADD CONSTRAINT "QuestionAgronomique_agronomeInterneId_fkey" FOREIGN KEY ("agronomeInterneId") REFERENCES "AgronomeInterne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAgronomique" ADD CONSTRAINT "QuestionAgronomique_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchangeB2B" ADD CONSTRAINT "EchangeB2B_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prefinancement" ADD CONSTRAINT "Prefinancement_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prefinancement" ADD CONSTRAINT "Prefinancement_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_transactionAcheteurId_fkey" FOREIGN KEY ("transactionAcheteurId") REFERENCES "TransactionAcheteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agriculteur" ADD CONSTRAINT "Agriculteur_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
