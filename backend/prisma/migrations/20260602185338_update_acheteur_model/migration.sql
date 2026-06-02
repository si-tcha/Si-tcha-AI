/*
  Warnings:

  - You are about to alter the column `preferencesAlertes` on the `Acheteur` table. The data in that column could be lost. The data in that column will be cast from `JsonB` to `VarChar(250)`.

*/
-- AlterTable
ALTER TABLE "Acheteur" ADD COLUMN     "adresse" VARCHAR(250),
ALTER COLUMN "preferencesAlertes" SET DATA TYPE VARCHAR(250);
