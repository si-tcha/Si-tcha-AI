/*
  Warnings:

  - Added the required column `prix` to the `ProduitAgricole` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProduitAgricole" ADD COLUMN     "prix" DECIMAL(15,2) NOT NULL;
