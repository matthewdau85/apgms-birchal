-- CreateEnum
CREATE TYPE "RptStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "digestBefore" TEXT,
    "digestAfter" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditEvent_digestAfter_key" UNIQUE ("digestAfter")
);

-- CreateTable
CREATE TABLE "ManifestEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "prevDigest" TEXT,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ManifestEntry_digest_key" UNIQUE ("digest"),
    CONSTRAINT "ManifestEntry_orgId_period_sequence_key" UNIQUE ("orgId", "period", "sequence")
);

-- CreateTable
CREATE TABLE "RptToken" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "RptStatus" NOT NULL DEFAULT 'ACTIVE',
    "mintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintedBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedReason" TEXT,

    CONSTRAINT "RptToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RptToken_token_key" UNIQUE ("token")
);

-- CreateIndex
CREATE INDEX "RptToken_orgId_period_idx" ON "RptToken"("orgId", "period");

-- AddForeignKey
ALTER TABLE "RptToken" ADD CONSTRAINT "RptToken_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ManifestEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
