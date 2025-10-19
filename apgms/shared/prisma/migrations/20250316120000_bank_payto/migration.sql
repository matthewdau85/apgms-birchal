-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "accountRef" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PayToMandate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bankConnectionId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "amountLimitCents" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuditBlob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayToMandate" ADD CONSTRAINT "PayToMandate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayToMandate" ADD CONSTRAINT "PayToMandate_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditBlob" ADD CONSTRAINT "AuditBlob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
