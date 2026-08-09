/*
  Warnings:

  - Added the required column `unite` to the `ProduitAgricole` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProduitAgricole" ADD COLUMN     "unite" TEXT NOT NULL;
