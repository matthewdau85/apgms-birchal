import assert from "node:assert/strict";

import { createApp, PrismaClientLike } from "../src/app";
import { AlertBus } from "../src/policy/alert-bus";
import { AuditLog } from "../src/policy/audit-log";
import { AnomalyEvaluation, AnomalyPipeline } from "../src/policy/types";
import { GatePermissionError, GateService } from "../src/policy/gate-service";
import { PolicyEngine } from "../src/policy/policy-engine";
import { RemittanceLedger } from "../src/policy/remittance-ledger";
import { ScheduledQueue } from "../src/policy/scheduled-queue";

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    if (!(error instanceof Error)) {
      console.error(new Error("unknown error"));
    }
    process.exitCode = 1;
  }
}

class SequenceAnomalyPipeline implements AnomalyPipeline {
  private index = 0;

  constructor(private readonly evaluations: AnomalyEvaluation[]) {}

  async evaluate(): Promise<AnomalyEvaluation> {
    const evaluation = this.evaluations[this.index] ?? { severity: "NONE" as const };
    this.index += 1;
    return evaluation;
  }
}

await test("closing gate schedules remittance while closed", async () => {
  const gateService = new GateService();
  const ledger = new RemittanceLedger();
  const queue = new ScheduledQueue();
  const alertBus = new AlertBus();
  const auditLog = new AuditLog();
  const anomalyPipeline = new SequenceAnomalyPipeline([{ severity: "NONE" }]);
  const engine = new PolicyEngine({
    gateService,
    ledger,
    scheduledQueue: queue,
    anomalyPipeline,
    alertBus,
    auditLog,
  });

  const opensAt = new Date("2030-01-01T00:00:00Z");
  gateService.close("remit", {
    actorRole: "admin_compliance",
    reason: "MANUAL",
    opensAt,
  });

  const scheduled = await engine.apply({
    id: "remit-1",
    gateId: "remit",
    amount: 25,
  });

  assert.equal(scheduled.status, "scheduled");
  assert.equal(ledger.count(), 0);
  assert.equal(queue.count(), 1);
  const [queued] = queue.all();
  assert.equal(queued.gateId, "remit");
  assert.equal(queued.remittanceId, "remit-1");
  assert.ok(queued.opensAt instanceof Date);

  gateService.open("remit", "admin_compliance");
  const applied = await engine.apply({
    id: "remit-2",
    gateId: "remit",
    amount: 42,
  });

  assert.equal(applied.status, "applied");
  assert.equal(ledger.count(), 1);
  assert.equal(ledger.all()[0].remittanceId, "remit-2");
});

await test("anomaly closes gate and requires admin override", async () => {
  const gateService = new GateService();
  const ledger = new RemittanceLedger();
  const queue = new ScheduledQueue();
  const alertBus = new AlertBus();
  const auditLog = new AuditLog();
  const anomalyPipeline = new SequenceAnomalyPipeline([
    { severity: "HARD", detail: "breach" },
    { severity: "NONE" },
  ]);
  const engine = new PolicyEngine({
    gateService,
    ledger,
    scheduledQueue: queue,
    anomalyPipeline,
    alertBus,
    auditLog,
  });

  const result = await engine.apply({
    id: "fraudulent",
    gateId: "primary",
    amount: 88,
  });

  assert.equal(result.status, "scheduled");
  const gate = gateService.getState("primary");
  assert.equal(gate.status, "CLOSED");
  assert.equal(gate.reason, "ANOMALY_HARD");
  assert.equal(alertBus.all().length, 1);

  assert.throws(() => gateService.open("primary", "ops_agent"), GatePermissionError);
  gateService.open("primary", "admin_compliance");

  const clean = await engine.apply({
    id: "clean",
    gateId: "primary",
    amount: 55,
  });

  assert.equal(clean.status, "applied");
  assert.equal(ledger.count(), 1);
  assert.equal(queue.count(), 1);
});

await test("gate admin endpoints enforce role and emit audit events", async () => {
  const gateService = new GateService();
  const ledger = new RemittanceLedger();
  const queue = new ScheduledQueue();
  const alertBus = new AlertBus();
  const auditLog = new AuditLog();
  const anomalyPipeline = new SequenceAnomalyPipeline([{ severity: "NONE" }]);
  const engine = new PolicyEngine({
    gateService,
    ledger,
    scheduledQueue: queue,
    anomalyPipeline,
    alertBus,
    auditLog,
  });

  const app = await createApp({
    logger: false,
    dependencies: {
      gateService,
      ledger,
      scheduledQueue: queue,
      anomalyPipeline,
      alertBus,
      auditLog,
      policyEngine: engine,
      prisma: createPrismaStub(),
    },
  });

  const closeResponse = await app.inject({
    method: "POST",
    url: "/gates/remit/close",
    payload: {
      role: "admin_compliance",
      reason: "MANUAL",
      opensAt: "2030-01-01T00:00:00.000Z",
    },
  });

  assert.equal(closeResponse.statusCode, 200);
  const closePayload = closeResponse.json() as { gate: { status: string } };
  assert.equal(closePayload.gate.status, "CLOSED");
  assert.equal(auditLog.all().length, 1);
  assert.equal(auditLog.all()[0].type, "GATE_CLOSED");

  const forbidden = await app.inject({
    method: "POST",
    url: "/gates/remit/open",
    payload: { role: "ops_agent" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(gateService.getState("remit").status, "CLOSED");
  assert.equal(auditLog.all().length, 1);

  const openResponse = await app.inject({
    method: "POST",
    url: "/gates/remit/open",
    payload: { role: "admin_compliance" },
  });
  assert.equal(openResponse.statusCode, 200);
  const openPayload = openResponse.json() as { gate: { status: string } };
  assert.equal(openPayload.gate.status, "OPEN");
  assert.equal(auditLog.all().length, 2);
  assert.equal(auditLog.all()[1].type, "GATE_OPENED");

  await app.close();
});

function createPrismaStub(): PrismaClientLike {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async (args: any) => ({ id: "stub", ...args.data }),
    },
  };
}
