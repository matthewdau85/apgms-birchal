-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "DesignatedAccountType" AS ENUM ('OPERATING', 'TAX', 'PAYROLL');

-- CreateEnum
CREATE TYPE "GateEventType" AS ENUM ('REGISTRATION_SUBMITTED', 'REGISTRATION_APPROVED', 'BAS_SCHEDULE_CREATED', 'ALLOCATION_RULES_PUBLISHED');

-- CreateEnum
CREATE TYPE "GateEventStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('BAS', 'CASH_FLOW_SUMMARY');

-- AlterTable
ALTER TABLE "Org"
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "basScheduleAnchor" TIMESTAMP(3),
  ADD COLUMN "basScheduleFrequencyMonths" INTEGER,
  ADD COLUMN "basSubmissionDayOfMonth" INTEGER,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BankLine"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "source" TEXT DEFAULT 'import';

-- CreateTable
CREATE TABLE "DesignatedAccount" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "DesignatedAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "bsb" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastReconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DesignatedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationRuleSet" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "designatedAccountId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AllocationRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "GateEventType" NOT NULL,
  "status" "GateEventStatus" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecomputedRpt" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "reportType" "ReportType" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "basDueDate" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrecomputedRpt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllocationRuleSet_orgId_version_key" ON "AllocationRuleSet"("orgId", "version");

-- CreateIndex
CREATE INDEX "GateEvent_orgId_occurredAt_idx" ON "GateEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrecomputedRpt_orgId_reportType_periodStart_periodEnd_key" ON "PrecomputedRpt"("orgId", "reportType", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "DesignatedAccount" ADD CONSTRAINT "DesignatedAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRuleSet" ADD CONSTRAINT "AllocationRuleSet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRuleSet" ADD CONSTRAINT "AllocationRuleSet_designatedAccountId_fkey" FOREIGN KEY ("designatedAccountId") REFERENCES "DesignatedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEvent" ADD CONSTRAINT "GateEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecomputedRpt" ADD CONSTRAINT "PrecomputedRpt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
