import { spawn } from "node:child_process";
import process from "node:process";

const DEFAULT_DATABASE_URL = "postgresql://apgms:apgms@127.0.0.1:5432/apgms";
const DEFAULT_SHADOW_SCHEMA = "shadow";
const PRISMA_SCHEMA_PATH = "shared/prisma/schema.prisma";
const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export function ensureDatabaseEnv() {
  const isDatabaseUrlProvided = Boolean(process.env.DATABASE_URL);
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;

  if (!isDatabaseUrlProvided) {
    console.log(`DATABASE_URL not set, defaulting to ${DEFAULT_DATABASE_URL}`);
  }

  if (!process.env.SHADOW_DATABASE_URL) {
    process.env.SHADOW_DATABASE_URL = buildShadowDatabaseUrl(databaseUrl);
    console.log(`Using shadow database URL ${process.env.SHADOW_DATABASE_URL}`);
  }
}

export async function runPrismaCommand(...args: string[]) {
  ensureDatabaseEnv();
  await runCommand(PNPM_COMMAND, ["exec", "prisma", ...args, "--schema", PRISMA_SCHEMA_PATH]);
}

function buildShadowDatabaseUrl(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has("schema")) {
      url.searchParams.set("schema", DEFAULT_SHADOW_SCHEMA);
    } else {
      url.searchParams.set("schema", `${url.searchParams.get("schema")}_shadow`);
    }
    return url.toString();
  } catch (error) {
    console.warn("Failed to parse DATABASE_URL for shadow db, reusing main URL", error);
    return databaseUrl;
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);

    child.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
      }
    });
  });
}
