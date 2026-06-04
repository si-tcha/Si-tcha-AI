/*
  Warnings:

  - The primary key for the `Acheteur` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `adresse` on the `Acheteur` table. All the data in the column will be lost.
  - You are about to drop the column `preferencesAlertes` on the `Acheteur` table. All the data in the column will be lost.
  - The primary key for the `Agriculteur` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `prenom` on the `Agriculteur` table. All the data in the column will be lost.
  - The primary key for the `AgronomeInterne` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AlertePhyto` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BassinProduction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BesoinGIC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ChargeFinanciere` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DonneeMarche` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DonneesMeteo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EchangeB2B` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Evaluation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `GIC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `HistoriqueProduction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `JournalCroissance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Prefinancement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ProduitAgricole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ProgrammeAgricole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `QuestionAgronomique` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RecolteOffre` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TransactionAcheteur` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[nui]` on the table `Acheteur` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contact]` on the table `Agriculteur` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identifiantREF]` on the table `GIC` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nom` to the `Acheteur` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nui` to the `Acheteur` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secteur_activite` to the `Acheteur` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatutAgriculteur" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- DropForeignKey
ALTER TABLE "Agriculteur" DROP CONSTRAINT "Agriculteur_gicId_fkey";

-- DropForeignKey
ALTER TABLE "AlertePhyto" DROP CONSTRAINT "AlertePhyto_bassinProductionId_fkey";

-- DropForeignKey
ALTER TABLE "BesoinGIC" DROP CONSTRAINT "BesoinGIC_gicId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeFinanciere" DROP CONSTRAINT "ChargeFinanciere_gicId_fkey";

-- DropForeignKey
ALTER TABLE "DonneeMarche" DROP CONSTRAINT "DonneeMarche_bassinProductionId_fkey";

-- DropForeignKey
ALTER TABLE "DonneeMarche" DROP CONSTRAINT "DonneeMarche_produitAgricoleId_fkey";

-- DropForeignKey
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT "DonneesMeteo_bassinProductionId_fkey";

-- DropForeignKey
ALTER TABLE "EchangeB2B" DROP CONSTRAINT "EchangeB2B_gicId_fkey";

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_transactionAcheteurId_fkey";

-- DropForeignKey
ALTER TABLE "GIC" DROP CONSTRAINT "GIC_bassinProductionId_fkey";

-- DropForeignKey
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT "HistoriqueProduction_bassinProductionId_fkey";

-- DropForeignKey
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT "HistoriqueProduction_produitAgricoleId_fkey";

-- DropForeignKey
ALTER TABLE "JournalCroissance" DROP CONSTRAINT "JournalCroissance_recolteOffreId_fkey";

-- DropForeignKey
ALTER TABLE "Prefinancement" DROP CONSTRAINT "Prefinancement_acheteurId_fkey";

-- DropForeignKey
ALTER TABLE "Prefinancement" DROP CONSTRAINT "Prefinancement_gicId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT "QuestionAgronomique_agronomeInterneId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT "QuestionAgronomique_gicId_fkey";

-- DropForeignKey
ALTER TABLE "RecolteOffre" DROP CONSTRAINT "RecolteOffre_gicId_fkey";

-- DropForeignKey
ALTER TABLE "RecolteOffre" DROP CONSTRAINT "RecolteOffre_produitAgricoleId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT "TransactionAcheteur_acheteurId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT "TransactionAcheteur_recolteOffreId_fkey";

-- AlterTable
ALTER TABLE "Acheteur" DROP CONSTRAINT "Acheteur_pkey",
DROP COLUMN "adresse",
DROP COLUMN "preferencesAlertes",
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "nui" TEXT NOT NULL,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "secteur_activite" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nomEntreprise" SET DATA TYPE TEXT,
ALTER COLUMN "contact" SET DATA TYPE TEXT,
ADD CONSTRAINT "Acheteur_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Acheteur_id_seq";

-- AlterTable
ALTER TABLE "Agriculteur" DROP CONSTRAINT "Agriculteur_pkey",
DROP COLUMN "prenom",
ADD COLUMN     "statut" "StatutAgriculteur" NOT NULL DEFAULT 'EN_ATTENTE',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ALTER COLUMN "contact" SET DATA TYPE TEXT,
ALTER COLUMN "estLeader" SET DEFAULT false,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Agriculteur_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Agriculteur_id_seq";

-- AlterTable
ALTER TABLE "AgronomeInterne" DROP CONSTRAINT "AgronomeInterne_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "specialite" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ADD CONSTRAINT "AgronomeInterne_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AgronomeInterne_id_seq";

-- AlterTable
ALTER TABLE "AlertePhyto" DROP CONSTRAINT "AlertePhyto_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "ravageurMaladie" SET DATA TYPE TEXT,
ALTER COLUMN "protocoleUrgence" SET DATA TYPE TEXT,
ALTER COLUMN "bassinProductionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AlertePhyto_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AlertePhyto_id_seq";

-- AlterTable
ALTER TABLE "BassinProduction" DROP CONSTRAINT "BassinProduction_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ALTER COLUMN "region" SET DATA TYPE TEXT,
ADD CONSTRAINT "BassinProduction_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "BassinProduction_id_seq";

-- AlterTable
ALTER TABLE "BesoinGIC" DROP CONSTRAINT "BesoinGIC_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "categorieBesoin" SET DATA TYPE TEXT,
ALTER COLUMN "description" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "BesoinGIC_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "BesoinGIC_id_seq";

-- AlterTable
ALTER TABLE "ChargeFinanciere" DROP CONSTRAINT "ChargeFinanciere_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "typeCharge" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ChargeFinanciere_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ChargeFinanciere_id_seq";

-- AlterTable
ALTER TABLE "DonneeMarche" DROP CONSTRAINT "DonneeMarche_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "produitAgricoleId" SET DATA TYPE TEXT,
ALTER COLUMN "bassinProductionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DonneeMarche_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DonneeMarche_id_seq";

-- AlterTable
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT "DonneesMeteo_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "bassinProductionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DonneesMeteo_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DonneesMeteo_id_seq";

-- AlterTable
ALTER TABLE "EchangeB2B" DROP CONSTRAINT "EchangeB2B_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "typeEchange" SET DATA TYPE TEXT,
ALTER COLUMN "description" SET DATA TYPE TEXT,
ALTER COLUMN "statut" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "EchangeB2B_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "EchangeB2B_id_seq";

-- AlterTable
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "commentaire" SET DATA TYPE TEXT,
ALTER COLUMN "roleAuteur" SET DATA TYPE TEXT,
ALTER COLUMN "transactionAcheteurId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Evaluation_id_seq";

-- AlterTable
ALTER TABLE "GIC" DROP CONSTRAINT "GIC_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ALTER COLUMN "logoURL" SET DATA TYPE TEXT,
ALTER COLUMN "reglementInterieur" SET DATA TYPE TEXT,
ALTER COLUMN "activitesPrincipales" SET DATA TYPE TEXT,
ALTER COLUMN "identifiantREF" SET DATA TYPE TEXT,
ALTER COLUMN "statutLegalisation" SET DATA TYPE TEXT,
ALTER COLUMN "bassinProductionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "GIC_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "GIC_id_seq";

-- AlterTable
ALTER TABLE "HistoriqueProduction" DROP CONSTRAINT "HistoriqueProduction_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "superficieHa" SET DATA TYPE TEXT,
ALTER COLUMN "rendementMoyen" SET DATA TYPE TEXT,
ALTER COLUMN "produitAgricoleId" SET DATA TYPE TEXT,
ALTER COLUMN "bassinProductionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "HistoriqueProduction_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "HistoriqueProduction_id_seq";

-- AlterTable
ALTER TABLE "JournalCroissance" DROP CONSTRAINT "JournalCroissance_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "etatLevee" SET DATA TYPE TEXT,
ALTER COLUMN "traitementsAppliques" SET DATA TYPE TEXT,
ALTER COLUMN "recolteOffreId" SET DATA TYPE TEXT,
ADD CONSTRAINT "JournalCroissance_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "JournalCroissance_id_seq";

-- AlterTable
ALTER TABLE "Prefinancement" DROP CONSTRAINT "Prefinancement_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "type" SET DATA TYPE TEXT,
ALTER COLUMN "conditions" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ALTER COLUMN "acheteurId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Prefinancement_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Prefinancement_id_seq";

-- AlterTable
ALTER TABLE "ProduitAgricole" DROP CONSTRAINT "ProduitAgricole_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ALTER COLUMN "categorie" SET DATA TYPE TEXT,
ADD CONSTRAINT "ProduitAgricole_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ProduitAgricole_id_seq";

-- AlterTable
ALTER TABLE "ProgrammeAgricole" DROP CONSTRAINT "ProgrammeAgricole_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "nom" SET DATA TYPE TEXT,
ALTER COLUMN "description" SET DATA TYPE TEXT,
ALTER COLUMN "criteresEligibilite" SET DATA TYPE TEXT,
ALTER COLUMN "urlLien" SET DATA TYPE TEXT,
ADD CONSTRAINT "ProgrammeAgricole_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ProgrammeAgricole_id_seq";

-- AlterTable
ALTER TABLE "QuestionAgronomique" DROP CONSTRAINT "QuestionAgronomique_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "questionTexte" SET DATA TYPE TEXT,
ALTER COLUMN "mediaUrl" SET DATA TYPE TEXT,
ALTER COLUMN "statut" SET DATA TYPE TEXT,
ALTER COLUMN "reponseAgronome" SET DATA TYPE TEXT,
ALTER COLUMN "agronomeInterneId" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "QuestionAgronomique_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "QuestionAgronomique_id_seq";

-- AlterTable
ALTER TABLE "RecolteOffre" DROP CONSTRAINT "RecolteOffre_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "maturite" SET DATA TYPE TEXT,
ALTER COLUMN "produitAgricoleId" SET DATA TYPE TEXT,
ALTER COLUMN "gicId" SET DATA TYPE TEXT,
ADD CONSTRAINT "RecolteOffre_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RecolteOffre_id_seq";

-- AlterTable
ALTER TABLE "TransactionAcheteur" DROP CONSTRAINT "TransactionAcheteur_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "type" SET DATA TYPE TEXT,
ALTER COLUMN "statut" SET DATA TYPE TEXT,
ALTER COLUMN "recolteOffreId" SET DATA TYPE TEXT,
ALTER COLUMN "acheteurId" SET DATA TYPE TEXT,
ADD CONSTRAINT "TransactionAcheteur_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "TransactionAcheteur_id_seq";

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_contact_key" ON "Admin"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "Acheteur_nui_key" ON "Acheteur"("nui");

-- CreateIndex
CREATE UNIQUE INDEX "Agriculteur_contact_key" ON "Agriculteur"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "GIC_identifiantREF_key" ON "GIC"("identifiantREF");

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
