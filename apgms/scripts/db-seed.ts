import { runPrismaCommand, ensureDatabaseEnv } from "./db-utils";

async function main() {
  console.log("Ensuring database environment...");
  ensureDatabaseEnv();

  console.log("Generating Prisma client...");
  await runPrismaCommand("generate");

  console.log("Running Prisma seed script...");
  await runPrismaCommand("db", "seed", "--skip-generate");

  console.log("Database seed completed.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
