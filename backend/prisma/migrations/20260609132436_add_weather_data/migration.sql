/*
  Warnings:

  - You are about to drop the column `bassinProductionId` on the `DonneesMeteo` table. All the data in the column will be lost.
  - You are about to alter the column `temperature` on the `DonneesMeteo` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(5,2)`.
  - You are about to alter the column `pluviometrie` on the `DonneesMeteo` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(5,2)`.
  - A unique constraint covering the columns `[polygonId]` on the table `GIC` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `DonneesMeteo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gicId` to the `DonneesMeteo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `humidite` to the `DonneesMeteo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `probabilitePluie` to the `DonneesMeteo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vitesseVent` to the `DonneesMeteo` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DonneesMeteo" DROP CONSTRAINT "DonneesMeteo_bassinProductionId_fkey";

-- AlterTable
ALTER TABLE "DonneesMeteo" DROP COLUMN "bassinProductionId",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "gicId" TEXT NOT NULL,
ADD COLUMN     "humidite" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "probabilitePluie" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "vitesseVent" DECIMAL(5,2) NOT NULL,
ALTER COLUMN "temperature" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "pluviometrie" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "timestampMesure" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "GIC" ADD COLUMN     "polygonId" TEXT;

-- CreateTable
CREATE TABLE "DonneesSol" (
    "id" TEXT NOT NULL,
    "temperatureSurface" DECIMAL(5,2) NOT NULL,
    "temperature10cm" DECIMAL(5,2) NOT NULL,
    "humidite" DECIMAL(5,2) NOT NULL,
    "timestampMesure" TIMESTAMPTZ NOT NULL,
    "gicId" TEXT NOT NULL,

    CONSTRAINT "DonneesSol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteMeteo" (
    "id" TEXT NOT NULL,
    "messageCourt" TEXT NOT NULL,
    "detailsTechniques" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "timestampCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gicId" TEXT NOT NULL,

    CONSTRAINT "AlerteMeteo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GIC_polygonId_key" ON "GIC"("polygonId");

-- AddForeignKey
ALTER TABLE "DonneesMeteo" ADD CONSTRAINT "DonneesMeteo_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonneesSol" ADD CONSTRAINT "DonneesSol_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlerteMeteo" ADD CONSTRAINT "AlerteMeteo_gicId_fkey" FOREIGN KEY ("gicId") REFERENCES "GIC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
