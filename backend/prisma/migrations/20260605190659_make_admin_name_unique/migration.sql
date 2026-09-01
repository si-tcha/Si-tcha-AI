/*
  Warnings:

  - A unique constraint covering the columns `[nom]` on the table `Admin` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Admin_nom_key" ON "Admin"("nom");
