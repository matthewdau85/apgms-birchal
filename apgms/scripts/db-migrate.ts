import { runPrismaCommand } from "./db-utils";

async function main() {
  console.log("Applying Prisma migrations...");
  await runPrismaCommand("migrate", "deploy");

  console.log("Generating Prisma client...");
  await runPrismaCommand("generate");

  console.log("Database migrations completed.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
