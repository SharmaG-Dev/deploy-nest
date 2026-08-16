-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'EXTRACTING', 'INDEXING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "ingestionStatus" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "projectManifest" TEXT;
