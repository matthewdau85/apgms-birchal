-- AlterTable
ALTER TABLE "BankLine"
    ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AUD',
    ADD COLUMN     "externalId" TEXT,
    ADD COLUMN     "source" TEXT,
    ADD COLUMN     "cleared" BOOLEAN NOT NULL DEFAULT false,
    ALTER COLUMN   "amount" TYPE DECIMAL(18,2) USING ROUND("amount", 2);

-- CreateIndex
CREATE UNIQUE INDEX "BankLine_orgId_externalId_key" ON "BankLine"("orgId", "externalId");
