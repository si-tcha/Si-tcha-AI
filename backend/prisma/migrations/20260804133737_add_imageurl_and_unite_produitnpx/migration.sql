-- AlterTable
ALTER TABLE "ProduitAgricole" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "prix" DROP NOT NULL,
ALTER COLUMN "unite" SET DEFAULT 'kg';
