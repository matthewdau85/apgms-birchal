import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function commandExists(command: string): boolean {
  try {
    const probe = spawnSync(command, ["--version"], { stdio: "ignore" });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function startContainers(): void {
  const composeFile = path.resolve(process.cwd(), "docker-compose.yml");
  if (!existsSync(composeFile)) {
    return;
  }

  if (!commandExists("docker")) {
    console.warn("docker not available; skipping container startup");
    return;
  }

  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "up",
      "-d",
      "postgres",
      "redis"
    ],
    {
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    console.warn("docker compose failed to start test services");
  }
}

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/apgms_test?schema=public";
  process.env.SHADOW_DATABASE_URL =
    process.env.SHADOW_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/apgms_test_shadow?schema=public";
  process.env.REDIS_URL =
    process.env.REDIS_URL ?? "redis://localhost:6379/0";

  if (process.env.START_TEST_SERVICES !== "false") {
    startContainers();
  }
}
