ALTER TABLE "PaiementAfribaPay"
    ALTER COLUMN "idempotencyKey" DROP NOT NULL,
    ALTER COLUMN "requestFingerprint" DROP NOT NULL;
