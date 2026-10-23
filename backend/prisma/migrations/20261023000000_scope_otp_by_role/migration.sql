-- Un même numéro peut être propriétaire d'un compte acheteur et d'un compte
-- producteur. Les OTP doivent donc être isolés par rôle afin qu'un code envoyé
-- pour l'un ne remplace jamais celui de l'autre.

ALTER TABLE "OtpCode"
  ADD COLUMN IF NOT EXISTS "role" VARCHAR(10) NOT NULL DEFAULT 'buyer';

-- Les anciens enregistrements ne pouvaient appartenir qu'à un seul rôle :
-- préserver les OTP vendeur existants lorsqu'aucun acheteur ne partage le
-- numéro. Le cas des deux comptes n'était pas autorisé avant cette migration.
UPDATE "OtpCode" AS otp
SET "role" = 'seller'
WHERE EXISTS (
  SELECT 1 FROM "Agriculteur" AS seller
  WHERE seller."contact" = otp."phone"
)
AND NOT EXISTS (
  SELECT 1 FROM "Acheteur" AS buyer
  WHERE buyer."contact" = otp."phone"
);

ALTER TABLE "OtpCode"
  DROP CONSTRAINT IF EXISTS "OtpCode_role_check";

ALTER TABLE "OtpCode"
  ADD CONSTRAINT "OtpCode_role_check"
  CHECK ("role" IN ('buyer', 'seller'));

DROP INDEX IF EXISTS "OtpCode_phone_key";

CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_phone_role_key"
  ON "OtpCode"("phone", "role");

-- Les écritures applicatives fournissent toujours le rôle explicitement.
-- Retirer le défaut temporaire évite qu'un OTP sans rôle soit silencieusement
-- classé comme acheteur et maintient la base conforme à schema.prisma.
ALTER TABLE "OtpCode"
  ALTER COLUMN "role" DROP DEFAULT;
