ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

UPDATE "User"
SET "passwordHash" = COALESCE("passwordHash", '')
WHERE "passwordHash" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" SET DEFAULT '';

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" SET NOT NULL;

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP DEFAULT;
