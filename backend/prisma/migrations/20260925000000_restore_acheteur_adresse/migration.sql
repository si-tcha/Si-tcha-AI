-- Restore the nullable column declared by the current Prisma schema.
ALTER TABLE "Acheteur" ADD COLUMN IF NOT EXISTS "adresse" TEXT;
