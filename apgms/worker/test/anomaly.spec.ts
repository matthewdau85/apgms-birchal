import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { auditBlobStore } from "@apgms/shared/audit-blobs";
import { processBankLineAnomalies, type BankLine } from "../src/pipeline/anomaly";
import { buildApp } from "@apgms/services/api-gateway/app";

const baseDate = new Date("2024-01-01T00:00:00Z");

const minutesFromBase = (minutes: number) => new Date(baseDate.getTime() + minutes * 60 * 1000);

describe("anomaly detection pipeline", () => {
  afterEach(() => {
    auditBlobStore.reset();
  });

  it("records anomalies and exposes them via /alerts", async () => {
    const lines: BankLine[] = [
      {
        id: "t1",
        counterpartyId: "cp-1",
        amount: 20,
        occurredAt: minutesFromBase(0),
        payee: "acme-ops",
      },
      {
        id: "t2",
        counterpartyId: "cp-1",
        amount: 150,
        occurredAt: minutesFromBase(1),
        payee: "acme-ops",
      },
      {
        id: "t3",
        counterpartyId: "cp-1",
        amount: 155,
        occurredAt: minutesFromBase(2),
        payee: "acme-ops",
      },
      {
        id: "t4",
        counterpartyId: "cp-1",
        amount: 160,
        occurredAt: minutesFromBase(3),
        payee: "acme-ops",
      },
      {
        id: "t5",
        counterpartyId: "cp-1",
        amount: 180,
        occurredAt: minutesFromBase(12),
        payee: "rogue-payee",
      },
    ];

    processBankLineAnomalies(lines, {
      config: {
        corridors: {
          "cp-1": { min: 50, max: 170 },
        },
        burst: { threshold: 3, windowMinutes: 5 },
        payeeAllowlist: {
          "cp-1": ["acme-ops"],
        },
      },
    });

    const prismaStub = {
      user: {
        findMany: async () => [],
      },
      bankLine: {
        findMany: async () => [],
        create: async () => ({}),
      },
    };

    const app = await buildApp({ logger: false }, { prisma: prismaStub });
    const response = await app.inject({ method: "GET", url: "/alerts?page=1&pageSize=10" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.total, 4);
    assert.equal(body.alerts.length, 4);

    const ruleCounts = body.alerts.reduce<Record<string, number>>((acc, alert: any) => {
      acc[alert.payload.rule] = (acc[alert.payload.rule] ?? 0) + 1;
      return acc;
    }, {});

    assert.equal(ruleCounts["amount_corridor_breach"], 2);
    assert.equal(ruleCounts["burst_frequency"], 1);
    assert.equal(ruleCounts["new_payee"], 1);
  });
});
