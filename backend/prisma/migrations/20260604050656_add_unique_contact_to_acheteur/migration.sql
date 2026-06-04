/*
  Warnings:

  - A unique constraint covering the columns `[contact]` on the table `Acheteur` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Acheteur_contact_key" ON "Acheteur"("contact");
