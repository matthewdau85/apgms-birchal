-- AlterTable
ALTER TABLE "User"
  ADD COLUMN     "deletedAt" TIMESTAMP(3),
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BankLine"
  ADD COLUMN     "deletedAt" TIMESTAMP(3),
  ALTER COLUMN "payee" DROP NOT NULL,
  ALTER COLUMN "desc" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditBlob" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redactedAt" TIMESTAMP(3),
    CONSTRAINT "AuditBlob_pkey" PRIMARY KEY ("id")
);
