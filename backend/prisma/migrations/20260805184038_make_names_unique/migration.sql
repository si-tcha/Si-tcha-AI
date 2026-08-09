/*
  Warnings:

  - A unique constraint covering the columns `[nom]` on the table `BassinProduction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom]` on the table `ProduitAgricole` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DonneeMarche" ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BassinProduction_nom_key" ON "BassinProduction"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitAgricole_nom_key" ON "ProduitAgricole"("nom");
