import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type EnvOverrides = Record<string, string>;

const envKeys = [
  "PORT",
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_MAX",
  "REDIS_URL",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "JWT_SECRET",
  "JWT_PUBLIC_KEY",
  "JWT_PRIVATE_KEY",
  "DATABASE_URL",
] as const;

type EnvKey = (typeof envKeys)[number];

const baseEnv: Partial<Record<EnvKey, string>> = {};
for (const key of envKeys) {
  if (process.env[key] !== undefined) {
    baseEnv[key] = process.env[key] as string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configModuleUrl = pathToFileURL(path.join(__dirname, "../src/config.ts")).href;

function resetEnv(): void {
  for (const key of envKeys) {
    if (baseEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = baseEnv[key] as string;
    }
  }
}

function applyEnv(overrides: EnvOverrides, removedKeys: EnvKey[] = []): void {
  resetEnv();
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  for (const key of removedKeys) {
    delete process.env[key];
  }
}

async function importConfig(overrides: EnvOverrides, removedKeys: EnvKey[] = []) {
  applyEnv(overrides, removedKeys);
  try {
    return await import(`${configModuleUrl}?t=${Date.now()}&r=${Math.random()}`);
  } finally {
    resetEnv();
  }
}

const validEnv: EnvOverrides = {
  PORT: "4010",
  ALLOWED_ORIGINS: "http://localhost:3000",
  RATE_LIMIT_MAX: "50",
  REDIS_URL: "redis://localhost:6379/0",
  JWT_ISSUER: "apgms",
  JWT_AUDIENCE: "apgms-clients",
  JWT_SECRET: "a".repeat(48),
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apgms",
};

await (async () => {
  await assert.rejects(
    () => importConfig(validEnv, ["JWT_SECRET"]),
    (err: unknown) => {
      assert.ok(err instanceof Error, "error should be an instance of Error");
      assert.match(err.message, /Invalid environment configuration/);
      assert.match(err.message, /JWT_SECRET/);
      return true;
    },
    "missing JWT_SECRET should throw",
  );

  const mod = await importConfig(validEnv);
  const cfg = mod.config;

  assert.equal(cfg.port, Number(validEnv.PORT));
  assert.deepEqual(cfg.allowedOrigins, ["http://localhost:3000"]);
  assert.equal(cfg.jwt.strategy, "secret");
})();

console.log("config.spec.ts: all tests passed");
