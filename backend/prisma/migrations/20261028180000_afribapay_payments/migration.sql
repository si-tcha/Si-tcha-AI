CREATE TYPE "StatutPaiementAfribaPay" AS ENUM ('AWAITING_OTP', 'PENDING', 'SUCCESS', 'FAILED');

CREATE TABLE "PaiementAfribaPay" (
    "id" TEXT NOT NULL,
    "acheteurId" TEXT NOT NULL,
    "transactionAcheteurId" TEXT,
    "prefinancementId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "providerLink" TEXT,
    "type" TEXT NOT NULL,
    "montant" DECIMAL(15,0) NOT NULL,
    "tauxMargeBrute" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "fraisAfribaPay" DECIMAL(15,2),
    "montantMargeBrute" DECIMAL(15,2),
    "margeReelleSitcha" DECIMAL(15,2),
    "montantBaseRedistribution" DECIMAL(15,2),
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "pays" TEXT NOT NULL,
    "operateur" TEXT NOT NULL,
    "telephoneSuffixe" TEXT NOT NULL,
    "statut" "StatutPaiementAfribaPay" NOT NULL DEFAULT 'PENDING',
    "dateCreation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMaj" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaiementAfribaPay_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaiementAfribaPay_acheteurId_fkey"
        FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaiementAfribaPay_transactionAcheteurId_fkey"
        FOREIGN KEY ("transactionAcheteurId") REFERENCES "TransactionAcheteur"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaiementAfribaPay_prefinancementId_fkey"
        FOREIGN KEY ("prefinancementId") REFERENCES "Prefinancement"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaiementAfribaPay_exactly_one_resource_check"
        CHECK (("transactionAcheteurId" IS NOT NULL)::integer + ("prefinancementId" IS NOT NULL)::integer = 1)
);

CREATE UNIQUE INDEX "PaiementAfribaPay_orderId_key" ON "PaiementAfribaPay"("orderId");
CREATE UNIQUE INDEX "PaiementAfribaPay_providerTransactionId_key" ON "PaiementAfribaPay"("providerTransactionId");
CREATE UNIQUE INDEX "PaiementAfribaPay_acheteurId_idempotencyKey_key" ON "PaiementAfribaPay"("acheteurId", "idempotencyKey");
CREATE INDEX "PaiementAfribaPay_acheteurId_dateCreation_idx" ON "PaiementAfribaPay"("acheteurId", "dateCreation");
CREATE INDEX "PaiementAfribaPay_transactionAcheteurId_statut_idx" ON "PaiementAfribaPay"("transactionAcheteurId", "statut");
CREATE INDEX "PaiementAfribaPay_prefinancementId_statut_idx" ON "PaiementAfribaPay"("prefinancementId", "statut");

CREATE UNIQUE INDEX "PaiementAfribaPay_transaction_active_key"
    ON "PaiementAfribaPay"("transactionAcheteurId")
    WHERE "transactionAcheteurId" IS NOT NULL AND "statut" IN ('AWAITING_OTP', 'PENDING', 'SUCCESS');
CREATE UNIQUE INDEX "PaiementAfribaPay_prefinancement_active_key"
    ON "PaiementAfribaPay"("prefinancementId")
    WHERE "prefinancementId" IS NOT NULL AND "statut" IN ('AWAITING_OTP', 'PENDING', 'SUCCESS');
