import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { createHmac } from "node:crypto";
import { buildApp } from "../src/index";

type BankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
};

type User = {
  email: string;
  orgId: string;
  createdAt: Date;
};

const SECRET = "test-secret";
process.env.JWT_SHARED_SECRET = SECRET;
process.env.OIDC_ISSUER = "https://issuer.example.com";
process.env.OIDC_AUDIENCE = "api://default";

type PrismaStub = {
  user: {
    findMany: (args: any) => Promise<User[]>;
  };
  bankLine: {
    findMany: (args: any) => Promise<BankLine[]>;
    create: (args: { data: any }) => Promise<BankLine>;
  };
};

const createPrismaStub = (): PrismaStub => {
  const bankLines: BankLine[] = [];
  const users: User[] = [
    { email: "admin@example.com", orgId: "org-1", createdAt: new Date("2023-01-01") },
    { email: "user@example.com", orgId: "org-1", createdAt: new Date("2023-02-01") },
  ];
  return {
    user: {
      findMany: async (args: any) => {
        if (args?.where?.orgId) {
          return users.filter((user) => user.orgId === args.where.orgId);
        }
        return users;
      },
    },
    bankLine: {
      findMany: async (args: any) => {
        if (args?.where?.orgId) {
          return bankLines.filter((line) => line.orgId === args.where.orgId);
        }
        return bankLines;
      },
      create: async ({ data }) => {
        const record: BankLine = {
          id: String(bankLines.length + 1),
          orgId: data.orgId,
          date: data.date,
          amount: Number(data.amount),
          payee: data.payee,
          desc: data.desc,
        };
        bankLines.push(record);
        return record;
      },
    },
  };
};

const base64UrlEncode = (value: string) => Buffer.from(value, "utf-8").toString("base64url");

const signToken = async (claims: Record<string, any>) => {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: process.env.OIDC_ISSUER!,
      aud: process.env.OIDC_AUDIENCE!,
      iat: now,
      exp: now + 3600,
      ...claims,
    })
  );
  const data = `${header}.${payload}`;
  const signature = createHmac("sha256", Buffer.from(SECRET, "utf-8"))
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
};

describe("auth middleware", () => {
  const prismaStub = createPrismaStub();
  let app: Awaited<ReturnType<typeof buildApp>>;

  before(async () => {
    app = await buildApp({ prismaClient: prismaStub });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("returns 401 when no token provided", async () => {
    const response = await app.inject({ method: "GET", url: "/users" });
    assert.equal(response.statusCode, 401);
  });

  it("rejects cross-tenant writes", async () => {
    const token = await signToken({
      sub: "user-1",
      orgId: "org-1",
      roles: ["user"],
      amr: ["pwd", "mfa"],
    });
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org-2",
        date: new Date().toISOString(),
        amount: 100,
        payee: "ACME",
        desc: "Mismatch",
      },
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 403);
  });

  it("rejects admin requests without MFA posture", async () => {
    const token = await signToken({
      sub: "admin-1",
      orgId: "org-1",
      roles: ["admin"],
      amr: ["pwd"],
      acr: "urn:acr:1fa",
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin/reports",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 403);
  });

  it("allows admin requests when MFA satisfied", async () => {
    const token = await signToken({
      sub: "admin-1",
      orgId: "org-1",
      roles: ["admin"],
      amr: ["pwd", "mfa"],
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin/reports",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.orgId, "org-1");
  });
});
