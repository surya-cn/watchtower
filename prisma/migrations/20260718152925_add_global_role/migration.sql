-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('admin', 'member');

-- AlterTable
ALTER TABLE "issue_clusters" ADD COLUMN     "recurrence_ratio" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "global_role" "GlobalRole" NOT NULL DEFAULT 'member';
