-- CreateEnum
CREATE TYPE "PolicyProgram" AS ENUM ('OWDA', 'BAS');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AllocationRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AllocationRuleType" AS ENUM ('FIXED', 'PERCENTAGE', 'THRESHOLD');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntrySource" AS ENUM ('BANK_LINE', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "GateEventType" AS ENUM ('POLICY_ACTIVATED', 'POLICY_DEACTIVATED', 'RULE_TRIGGERED', 'REMITTANCE_CREATED', 'REMITTANCE_SETTLED');

-- CreateEnum
CREATE TYPE "GateEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RptTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- CreateEnum
CREATE TYPE "PendingRemittanceStatus" AS ENUM ('PREPARED', 'SUBMITTED', 'SETTLED', 'REJECTED');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalRef" TEXT,
    "name" TEXT NOT NULL,
    "program" "PolicyProgram" NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "coverageStart" TIMESTAMP(3) NOT NULL,
    "coverageEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationRuleSet" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AllocationRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleType" "AllocationRuleType" NOT NULL,
    "definition" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateEvent" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "allocationSetId" TEXT,
    "eventType" "GateEventType" NOT NULL,
    "status" "GateEventStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "allocationRuleSetId" TEXT,
    "bankLineId" TEXT,
    "gateEventId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "source" "LedgerEntrySource" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RptToken" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "kind" "RptTokenKind" NOT NULL DEFAULT 'ACCESS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RptToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingRemittance" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "ledgerEntryId" TEXT,
    "status" "PendingRemittanceStatus" NOT NULL DEFAULT 'PREPARED',
    "amount" DECIMAL(65,30) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_externalRef_key" ON "Policy"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationRuleSet_policyId_version_key" ON "AllocationRuleSet"("policyId", "version");

-- CreateIndex
CREATE INDEX "LedgerEntry_policyId_occurredAt_idx" ON "LedgerEntry"("policyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RptToken_token_key" ON "RptToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRemittance_ledgerEntryId_key" ON "PendingRemittance"("ledgerEntryId");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRuleSet" ADD CONSTRAINT "AllocationRuleSet_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEvent" ADD CONSTRAINT "GateEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEvent" ADD CONSTRAINT "GateEvent_allocationSetId_fkey" FOREIGN KEY ("allocationSetId") REFERENCES "AllocationRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_allocationRuleSetId_fkey" FOREIGN KEY ("allocationRuleSetId") REFERENCES "AllocationRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bankLineId_fkey" FOREIGN KEY ("bankLineId") REFERENCES "BankLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gateEventId_fkey" FOREIGN KEY ("gateEventId") REFERENCES "GateEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RptToken" ADD CONSTRAINT "RptToken_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRemittance" ADD CONSTRAINT "PendingRemittance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRemittance" ADD CONSTRAINT "PendingRemittance_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
