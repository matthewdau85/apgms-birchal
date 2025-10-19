import { spawnSync } from "node:child_process";

const schemaPath = "shared/prisma/schema.prisma";
const args = [
  "exec",
  "prisma",
  "migrate",
  "status",
  `--schema=${schemaPath}`,
  "--json",
];

const result = spawnSync("pnpm", args, {
  env: {
    ...process.env,
    // Offline CI environments cannot fetch engine checksums.
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING ?? "1",
  },
  encoding: "utf-8",
});

if (result.error) {
  console.error("Failed to execute Prisma CLI", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr.trim() || "prisma migrate status exited with an error");
  process.exit(result.status ?? 1);
}

let parsed: any;
try {
  parsed = JSON.parse(result.stdout.trim());
} catch (err) {
  console.error("Unable to parse Prisma migrate status output:");
  console.error(result.stdout);
  process.exit(1);
}

const databaseSchemaStatus = parsed?.databaseSchemaStatus;
const migrationStatus = parsed?.migrationStatus;

const isDatabaseValid = databaseSchemaStatus === "Valid";
const isUpToDate = migrationStatus === "UpToDate";

if (!isDatabaseValid || !isUpToDate) {
  console.error("Database schema or migrations are out of sync.");
  console.error(JSON.stringify({ databaseSchemaStatus, migrationStatus }, null, 2));
  process.exit(1);
}

console.log("Prisma migrations are in sync.");
