-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable: Add role column with default USER
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex (optional: for querying by role)
CREATE INDEX "users_role_idx" ON "users"("role");
