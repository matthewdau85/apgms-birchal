import { beforeEach } from "vitest";
import { resetAuditBlobs } from "@apgms/shared/audit-blob";
import { resetGates } from "@apgms/shared/gates";
import { resetRedis } from "@apgms/services-shared/redis";
import { resetAgreements } from "@apgms/payments/adapters/payto.mock";

defineEnvironment();

beforeEach(() => {
  resetAuditBlobs();
  resetGates();
  resetRedis();
  resetAgreements();
});

function defineEnvironment(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  process.env.GATE_POLL_MS = process.env.GATE_POLL_MS ?? "50";
}
