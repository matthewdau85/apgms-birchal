-- Drop legacy tables if they exist
DROP TABLE IF EXISTS "BankLine" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Org" CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipRole') THEN DROP TYPE "MembershipRole"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxRegistrationType') THEN DROP TYPE "TaxRegistrationType"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxPeriodStatus') THEN DROP TYPE "TaxPeriodStatus"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountingMethod') THEN DROP TYPE "AccountingMethod"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BasCycle') THEN DROP TYPE "BasCycle"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceAccountType') THEN DROP TYPE "FinanceAccountType"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MandateStatus') THEN DROP TYPE "MandateStatus"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN DROP TYPE "PaymentStatus"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentEventType') THEN DROP TYPE "PaymentEventType"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GstTaxCode') THEN DROP TYPE "GstTaxCode"; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceScope') THEN DROP TYPE "EvidenceScope"; END IF;
END $$;

CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'ACCOUNTANT');
CREATE TYPE "TaxRegistrationType" AS ENUM ('GST', 'PAYGW');
CREATE TYPE "TaxPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'LODGED', 'AMENDED');
CREATE TYPE "AccountingMethod" AS ENUM ('CASH', 'ACCRUAL');
CREATE TYPE "BasCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');
CREATE TYPE "FinanceAccountType" AS ENUM ('OPERATING', 'PAYGW_WALLET', 'GST_WALLET', 'OTHER');
CREATE TYPE "MandateStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING_CAPTURE', 'SETTLED', 'FAILED', 'RECONCILED');
CREATE TYPE "PaymentEventType" AS ENUM ('STATUS_CHANGED', 'CAPTURED', 'REFUNDED', 'NOTE');
CREATE TYPE "GstTaxCode" AS ENUM ('TX', 'FRE', 'NT', 'INP', 'ADJ');
CREATE TYPE "EvidenceScope" AS ENUM ('GST', 'PAYGW', 'BAS');

CREATE TABLE "Org" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abn" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Australia/Brisbane',
  "accountingMethod" "AccountingMethod" NOT NULL DEFAULT 'ACCRUAL',
  "basCycle" "BasCycle" NOT NULL DEFAULT 'QUARTERLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "invitedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_userId_orgId_key" UNIQUE ("userId", "orgId"),
  CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "hashedKey" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaxRegistration" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "TaxRegistrationType" NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "accountBsb" TEXT,
  "accountNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxRegistration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaxPeriod" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "abn" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "TaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "lockDate" TIMESTAMP(3),
  "lodgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxPeriod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaxScheduleMeta" (
  "id" TEXT NOT NULL,
  "registration" "TaxRegistrationType" NOT NULL,
  "source" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "metadata" JSONB,
  "documentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxScheduleMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceAccount" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "FinanceAccountType" NOT NULL,
  "displayName" TEXT NOT NULL,
  "institution" TEXT,
  "bsb" TEXT,
  "accountNumber" TEXT,
  "oneWay" BOOLEAN NOT NULL DEFAULT false,
  "balanceCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FinanceMandate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "status" "MandateStatus" NOT NULL DEFAULT 'REQUESTED',
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "FinanceMandate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceMandate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FinanceMandate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT,
  "mandateId" TEXT,
  "periodId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "reference" TEXT NOT NULL,
  "description" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Payment_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "FinanceMandate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Payment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "type" "PaymentEventType" NOT NULL,
  "detail" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "orgId" TEXT,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdempotencyKey_key_key" UNIQUE ("key")
);

CREATE TABLE "BankImport" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "importedBy" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileHash" TEXT,
  CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankImport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BankLine" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "importId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "payee" TEXT NOT NULL,
  "desc" TEXT NOT NULL,
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unmatched',
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BankLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankImport"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ReconMatch" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "bankLineId" TEXT NOT NULL,
  "paymentId" TEXT,
  "confidence" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'needs_review',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ReconMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReconMatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReconMatch_bankLineId_fkey" FOREIGN KEY ("bankLineId") REFERENCES "BankLine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReconMatch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ReconException" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReconException_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ReconMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GstSupply" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT,
  "documentRef" TEXT,
  "description" TEXT,
  "supplyDate" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "gstCents" INTEGER NOT NULL,
  "taxCode" "GstTaxCode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GstSupply_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GstSupply_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GstSupply_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GstPurchase" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT,
  "documentRef" TEXT,
  "description" TEXT,
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "gstCents" INTEGER NOT NULL,
  "taxCode" "GstTaxCode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GstPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GstPurchase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GstPurchase_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GstAdjustment" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT,
  "description" TEXT,
  "amountCents" INTEGER NOT NULL,
  "gstCents" INTEGER NOT NULL,
  "taxCode" "GstTaxCode" NOT NULL DEFAULT 'ADJ',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GstAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GstAdjustment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GstAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GstBasCalc" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "g1" INTEGER NOT NULL,
  "g2" INTEGER NOT NULL,
  "g3" INTEGER NOT NULL,
  "g10" INTEGER NOT NULL,
  "g11" INTEGER NOT NULL,
  "label1A" INTEGER NOT NULL,
  "label1B" INTEGER NOT NULL,
  "netPayable" INTEGER NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" JSONB,
  CONSTRAINT "GstBasCalc_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GstBasCalc_periodId_key" UNIQUE ("periodId"),
  CONSTRAINT "GstBasCalc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GstBasCalc_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaygwEmployee" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "tfn" TEXT,
  "taxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
  "stsl" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaygwEmployee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaygwEmployee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaygwPayEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "employeeId" TEXT,
  "periodId" TEXT,
  "payDate" TIMESTAMP(3) NOT NULL,
  "grossCents" INTEGER NOT NULL,
  "withheldCents" INTEGER NOT NULL,
  "stslCents" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaygwPayEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaygwPayEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaygwPayEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PaygwEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PaygwPayEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PaygwWithholdingCalc" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "w1" INTEGER NOT NULL,
  "w2" INTEGER NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" JSONB,
  CONSTRAINT "PaygwWithholdingCalc_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaygwWithholdingCalc_periodId_key" UNIQUE ("periodId"),
  CONSTRAINT "PaygwWithholdingCalc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaygwWithholdingCalc_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "actorId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeHash" TEXT,
  "afterHash" TEXT,
  "ip" TEXT,
  "ua" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AuditRpt" (
  "id" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "scope" "EvidenceScope" NOT NULL,
  "evidenceDigest" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AuditRpt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditRpt_tokenId_key" UNIQUE ("tokenId"),
  CONSTRAINT "AuditRpt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditRpt_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AdminDocument" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "periodId" TEXT,
  "storagePath" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "version" TEXT,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hash" TEXT,
  "metadata" JSONB,
  CONSTRAINT "AdminDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminDocument_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "TaxScheduleMeta" ADD CONSTRAINT "TaxScheduleMeta_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AdminDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdminIngestionJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "documentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "AdminIngestionJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminIngestionJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminIngestionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AdminDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
