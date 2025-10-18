import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export interface ServiceConfig {
  serviceName: string;
  env: string;
  host: string;
  port: number;
  redisUrl: string;
  bullQueuePrefix: string;
}

function findEnvFile(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function loadServiceConfig(serviceName: string, importMetaUrl: string, overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  const filePath = fileURLToPath(importMetaUrl);
  const envPath = findEnvFile(path.dirname(filePath));
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  const port = overrides.port ?? (process.env.PORT ? Number(process.env.PORT) : undefined) ?? 3000;
  const host = overrides.host ?? process.env.HOST ?? "0.0.0.0";
  const redisUrl = overrides.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
  const bullQueuePrefix = overrides.bullQueuePrefix ?? process.env.BULLMQ_PREFIX ?? `apgms:${serviceName}`;
  const env = overrides.env ?? process.env.NODE_ENV ?? "development";

  return {
    serviceName,
    env,
    host,
    port,
    redisUrl,
    bullQueuePrefix,
  };
}
