import crypto from "node:crypto";
import request from "../lib/supertest/index";
import { beforeEach, describe, expect, test } from "../lib/vitest/index";
import { createApp } from "../../services/api-gateway/src/app";
import { AuditChain, PolicyEngine, ReplayProtector, StaticTokenAuthenticator, defaultPolicies } from "@apgms/shared";

const WEBHOOK_SECRET = "red-team-secret";

function sign(body: unknown) {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
}

describe("webhook and auth hardening", () => {
  let auditChain: AuditChain;
  let replayProtector: ReplayProtector;
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    auditChain = new AuditChain();
    replayProtector = new ReplayProtector();
    policyEngine = new PolicyEngine(defaultPolicies);
  });

  test("rejects replayed webhook events", async () => {
    const app = await createApp({
      prisma: {
        user: { findMany: async () => [] },
        bankLine: {
          findMany: async () => [],
          create: async () => {
            throw new Error("should not create during webhook test");
          },
        },
      },
      authenticator: new StaticTokenAuthenticator({
        token: "valid-token",
        principal: { tokenId: "token", subject: "svc", orgId: "org-1", roles: ["finance:read"] },
      }),
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: WEBHOOK_SECRET,
    });

    const event = { id: "evt-1", orgId: "org-1", payload: { ok: true }, timestamp: Date.now() };

    const first = await request(app)
      .post("/webhooks/bank-events")
      .set("x-webhook-signature", sign(event))
      .send(event);
    expect(first.status).toBe(202);

    const replay = await request(app)
      .post("/webhooks/bank-events")
      .set("x-webhook-signature", sign(event))
      .send(event);
    expect(replay.status).toBe(409);
    expect(replay.body.error).toBe("replay_detected");
  });

  test("detects tampered payloads", async () => {
    const app = await createApp({
      prisma: {
        user: { findMany: async () => [] },
        bankLine: {
          findMany: async () => [],
          create: async () => {
            throw new Error("should not create during webhook test");
          },
        },
      },
      authenticator: new StaticTokenAuthenticator({
        token: "valid-token",
        principal: { tokenId: "token", subject: "svc", orgId: "org-1", roles: ["finance:read"] },
      }),
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: WEBHOOK_SECRET,
    });

    const event = { id: "evt-2", orgId: "org-1", payload: { ok: true }, timestamp: Date.now() };
    const signature = sign(event);

    const tampered = await request(app)
      .post("/webhooks/bank-events")
      .set("x-webhook-signature", signature)
      .send({ ...event, payload: { ok: false } });

    expect(tampered.status).toBe(401);
    expect(tampered.body.error).toBe("invalid_signature");
  });

  test("rejects attempts to bypass auth", async () => {
    const app = await createApp({
      prisma: {
        user: { findMany: async () => [] },
        bankLine: {
          findMany: async () => [],
          create: async () => {
            throw new Error("should not create during webhook test");
          },
        },
      },
      authenticator: new StaticTokenAuthenticator({
        token: "valid-token",
        principal: { tokenId: "token", subject: "svc", orgId: "org-1", roles: ["finance:read"] },
      }),
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: WEBHOOK_SECRET,
    });

    const response = await request(app)
      .get("/bank-lines")
      .set("x-api-key", "not-valid");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("invalid_token");
  });
});
