import request from "../lib/supertest/index";
import { beforeEach, describe, expect, test } from "../lib/vitest/index";
import { createApp } from "../../services/api-gateway/src/app";
import { AuditChain, PolicyEngine, ReplayProtector, StaticTokenAuthenticator, defaultPolicies } from "@apgms/shared";

type UserRecord = { email: string; orgId: string; createdAt: Date };
type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
};

function createPrismaStub(users: UserRecord[], bankLines: BankLineRecord[]) {
  return {
    user: {
      findMany: async () => users,
    },
    bankLine: {
      findMany: async ({ take }: { take: number }) => bankLines.slice(0, take),
      create: async ({ data }: { data: Omit<BankLineRecord, "id"> }) => {
        const record: BankLineRecord = {
          id: `line-${bankLines.length + 1}`,
          ...data,
        };
        bankLines.unshift(record);
        return record;
      },
    },
  };
}

describe("api-gateway integration", () => {
  const initialUsers: UserRecord[] = [
    { email: "finance@example.com", orgId: "org-1", createdAt: new Date("2024-01-01T00:00:00Z") },
    { email: "auditor@example.com", orgId: "org-2", createdAt: new Date("2023-12-31T00:00:00Z") },
  ];
  const initialBankLines: BankLineRecord[] = [
    {
      id: "line-1",
      orgId: "org-1",
      date: new Date("2024-02-01T00:00:00Z"),
      amount: 1250,
      payee: "Oceanic Cloud",
      desc: "Subscription",
    },
  ];

  const authenticator = new StaticTokenAuthenticator([
    {
      token: "valid-token",
      principal: {
        tokenId: "token-valid",
        subject: "svc-finance",
        orgId: "org-1",
        roles: ["finance:read", "finance:write", "audit:read"],
      },
    },
    {
      token: "viewer-token",
      principal: {
        tokenId: "token-viewer",
        subject: "svc-viewer",
        orgId: "org-1",
        roles: ["finance:read"],
      },
    },
  ]);

  let auditChain: AuditChain;
  let replayProtector: ReplayProtector;
  let policyEngine: PolicyEngine;
  let users: UserRecord[];
  let bankLines: BankLineRecord[];

  beforeEach(() => {
    auditChain = new AuditChain();
    replayProtector = new ReplayProtector();
    policyEngine = new PolicyEngine(defaultPolicies);
    users = initialUsers.map((user) => ({ ...user }));
    bankLines = initialBankLines.map((line) => ({ ...line }));
  });

  test("health endpoint remains public", async () => {
    const app = await createApp({
      prisma: createPrismaStub(users, bankLines),
      authenticator,
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: "shared-secret",
    });

    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "api-gateway" });
  });

  test("requires valid token for user listing", async () => {
    const app = await createApp({
      prisma: createPrismaStub(users, bankLines),
      authenticator,
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: "shared-secret",
    });

    const missing = await request(app).get("/users");
    expect(missing.status).toBe(401);

    const invalid = await request(app).get("/users").set("authorization", "Bearer nope");
    expect(invalid.status).toBe(401);

    const ok = await request(app)
      .get("/users")
      .set("authorization", "Bearer valid-token");
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchSnapshot();
  });

  test("policy engine blocks negative bank line submissions", async () => {
    const app = await createApp({
      prisma: createPrismaStub(users, bankLines),
      authenticator,
      auditChain,
      replayProtector,
      policyEngine,
      webhookSecret: "shared-secret",
    });

    const denied = await request(app)
      .post("/bank-lines")
      .set("authorization", "Bearer valid-token")
      .send({
        orgId: "org-1",
        date: "2024-03-01",
        amount: -10,
        payee: "Test",
        desc: "Refund",
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("policy_denied");

    const allowed = await request(app)
      .post("/bank-lines")
      .set("authorization", "Bearer valid-token")
      .set("x-ledger-balance", "1000")
      .send({
        orgId: "org-1",
        date: "2024-03-01",
        amount: 25,
        payee: "Test",
        desc: "Expense",
      });
    expect(allowed.status).toBe(201);
    expect(auditChain.getEntries()).toHaveLength(1);
    const verification = await request(app)
      .get("/audit/verify")
      .set("authorization", "Bearer valid-token");
    expect(verification.body.ok).toBe(true);
  });
});
