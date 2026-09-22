-- AlterTable
ALTER TABLE "TransactionAcheteur" ADD COLUMN "clientRequestId" VARCHAR(100),
ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "TransactionAcheteur_acheteurId_clientRequestId_recolteOffreId_key" ON "TransactionAcheteur"("acheteurId", "clientRequestId", "recolteOffreId");

-- CreateIndex
CREATE INDEX "TransactionAcheteur_acheteurId_clientRequestId_idx" ON "TransactionAcheteur"("acheteurId", "clientRequestId");
