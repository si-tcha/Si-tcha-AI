ALTER TABLE "TransactionAcheteur"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT;

CREATE UNIQUE INDEX "TransactionAcheteur_acheteurId_idempotencyKey_key"
ON "TransactionAcheteur"("acheteurId", "idempotencyKey");
