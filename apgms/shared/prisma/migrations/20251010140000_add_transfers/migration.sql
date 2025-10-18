CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SETTLED', 'FAILED');
CREATE TYPE "TransferRail" AS ENUM ('BECS', 'PAYTO');

CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "rail" "TransferRail" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id");
ALTER TABLE "TransferEvent" ADD CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "Transfer_requestId_key" ON "Transfer"("requestId");
CREATE UNIQUE INDEX "TransferEvent_requestId_key" ON "TransferEvent"("requestId");

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferEvent" ADD CONSTRAINT "TransferEvent_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
