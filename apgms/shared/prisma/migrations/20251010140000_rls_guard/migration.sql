-- Convert primary and foreign keys to UUID and enable row level security policies
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure new UUID identifiers exist
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "new_id" uuid DEFAULT gen_random_uuid();
UPDATE "Org" SET "new_id" = COALESCE("new_id", gen_random_uuid());
ALTER TABLE "Org" ALTER COLUMN "new_id" SET NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "new_id" uuid DEFAULT gen_random_uuid();
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "new_orgId" uuid;
UPDATE "User" SET "new_id" = COALESCE("new_id", gen_random_uuid());
UPDATE "User" SET "new_orgId" = o."new_id"
FROM "Org" o
WHERE "User"."orgId" = o."id";
ALTER TABLE "User" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "new_orgId" SET NOT NULL;

ALTER TABLE "BankLine" ADD COLUMN IF NOT EXISTS "new_id" uuid DEFAULT gen_random_uuid();
ALTER TABLE "BankLine" ADD COLUMN IF NOT EXISTS "new_orgId" uuid;
UPDATE "BankLine" SET "new_id" = COALESCE("new_id", gen_random_uuid());
UPDATE "BankLine" SET "new_orgId" = o."new_id"
FROM "Org" o
WHERE "BankLine"."orgId" = o."id";
ALTER TABLE "BankLine" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "BankLine" ALTER COLUMN "new_orgId" SET NOT NULL;

-- Rebuild primary keys
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE "BankLine" DROP CONSTRAINT IF EXISTS "BankLine_pkey";
ALTER TABLE "Org" DROP CONSTRAINT IF EXISTS "Org_pkey";

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orgId_fkey";
ALTER TABLE "BankLine" DROP CONSTRAINT IF EXISTS "BankLine_orgId_fkey";

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "id";
ALTER TABLE "User" DROP COLUMN IF EXISTS "orgId";
ALTER TABLE "BankLine" DROP COLUMN IF EXISTS "id";
ALTER TABLE "BankLine" DROP COLUMN IF EXISTS "orgId";
ALTER TABLE "Org" DROP COLUMN IF EXISTS "id";

ALTER TABLE "Org" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "User" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "User" RENAME COLUMN "new_orgId" TO "orgId";
ALTER TABLE "BankLine" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "BankLine" RENAME COLUMN "new_orgId" TO "orgId";

ALTER TABLE "Org" ADD PRIMARY KEY ("id");
ALTER TABLE "User" ADD PRIMARY KEY ("id");
ALTER TABLE "BankLine" ADD PRIMARY KEY ("id");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankLine" ADD CONSTRAINT "BankLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");

ALTER TABLE "Org" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "User" ALTER COLUMN "orgId" SET DATA TYPE uuid USING "orgId";
ALTER TABLE "BankLine" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "BankLine" ALTER COLUMN "orgId" SET DATA TYPE uuid USING "orgId";

-- Enable row level security and policies
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "user_org_isolation" ON "User"
  USING ("orgId" = current_setting('apgms.org_id')::uuid)
  WITH CHECK ("orgId" = current_setting('apgms.org_id')::uuid);

ALTER TABLE "BankLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "bank_line_org_isolation" ON "BankLine"
  USING ("orgId" = current_setting('apgms.org_id')::uuid)
  WITH CHECK ("orgId" = current_setting('apgms.org_id')::uuid);
