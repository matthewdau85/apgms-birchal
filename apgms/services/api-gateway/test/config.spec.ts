import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "../src/config.ts");

const validEnv = {
  PORT: "4000",
  ALLOWED_ORIGINS: "http://localhost:3000",
  RATE_LIMIT_MAX: "250",
  REDIS_URL: "redis://localhost:6379/0",
  JWT_SECRET: "1234567890abcdef1234567890",
  JWT_ISSUER: "apgms-test-issuer",
  JWT_AUDIENCE: "apgms-test-audience",
};

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
});

const importFreshConfig = async () => {
  const url = pathToFileURL(configPath);
  url.searchParams.set("t", `${Date.now()}`);
  return import(url.href);
};

describe("config", () => {
  it("fails fast when required env vars are missing", async () => {
    const invalidEnv: NodeJS.ProcessEnv = { ...validEnv };
    delete invalidEnv.JWT_SECRET;
    process.env = invalidEnv;

    await assert.rejects(importFreshConfig, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /JWT_SECRET/);
      return true;
    });
  });

  it("parses environment variables when present", async () => {
    process.env = { ...validEnv };

    const { config } = await importFreshConfig();

    assert.equal(config.PORT, 4000);
    assert.equal(config.ALLOWED_ORIGINS, validEnv.ALLOWED_ORIGINS);
    assert.equal(config.RATE_LIMIT_MAX, 250);
    assert.equal(config.REDIS_URL, validEnv.REDIS_URL);
    assert.equal(config.JWT_SECRET, validEnv.JWT_SECRET);
    assert.equal(config.JWT_ISSUER, validEnv.JWT_ISSUER);
    assert.equal(config.JWT_AUDIENCE, validEnv.JWT_AUDIENCE);
  });
});
