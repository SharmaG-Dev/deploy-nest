/*
  Warnings:

  - The values [BUILDING,DEPLOYED,CANCELLED] on the enum `DeploymentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DeploymentStatus_new" AS ENUM ('PENDING', 'CREATING', 'DOWNLOADING', 'EXTRACTING', 'STARTING', 'READY', 'STOPPING', 'STOPPED', 'FAILED');
ALTER TABLE "public"."deployments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "deployments" ALTER COLUMN "status" TYPE "DeploymentStatus_new" USING ("status"::text::"DeploymentStatus_new");
ALTER TYPE "DeploymentStatus" RENAME TO "DeploymentStatus_old";
ALTER TYPE "DeploymentStatus_new" RENAME TO "DeploymentStatus";
DROP TYPE "public"."DeploymentStatus_old";
ALTER TABLE "deployments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "containerName" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "stoppedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "deployments_projectId_idx" ON "deployments"("projectId");

-- CreateIndex
CREATE INDEX "deployments_containerId_idx" ON "deployments"("containerId");
