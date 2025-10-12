-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payeeRegex" TEXT,
    "minAmount" DECIMAL,
    "maxAmount" DECIMAL,
    "containsDesc" TEXT,
    "setCategory" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Rule_orgId_idx" ON "Rule"("orgId");

-- AlterTable
ALTER TABLE "BankLine" ADD COLUMN "category" VARCHAR(64);

-- CreateIndex
CREATE INDEX "BankLine_category_idx" ON "BankLine"("category");
