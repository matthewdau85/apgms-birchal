import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

process.env.NODE_ENV = "test";

const { buildApp } = await import("../src/index");
const { prisma } = await import("../../../shared/src/db");

type JwtPayload = {
  sub: string;
  orgId: string;
  roles: string[];
};

function createToken(payload: JwtPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

describe("authz", () => {
  let app: FastifyInstance;
  const secret = "dev-secret";

  beforeEach(async () => {
    process.env.AUTH_SECRET = secret;
    app = buildApp();
    await app.ready();

    vi.spyOn(prisma.user, "findMany").mockResolvedValue([] as any);
    vi.spyOn(prisma.bankLine, "findMany").mockResolvedValue([] as any);
    vi.spyOn(prisma.bankLine, "create").mockResolvedValue({ id: "line", orgId: "org-1" } as any);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const usersResponse = await app.inject({ method: "GET", url: "/users?orgId=org-1" });
    expect(usersResponse.statusCode).toBe(401);

    const bankLinesResponse = await app.inject({ method: "GET", url: "/bank-lines?orgId=org-1" });
    expect(bankLinesResponse.statusCode).toBe(401);
  });

  it("rejects access when orgId does not match", async () => {
    const token = createToken({ sub: "user-1", orgId: "org-1", roles: ["viewer"] }, secret);

    const response = await app.inject({
      method: "GET",
      url: "/users?orgId=org-2",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejects writes when required role is missing", async () => {
    const token = createToken({ sub: "user-1", orgId: "org-1", roles: ["viewer"] }, secret);

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgId: "org-1",
        date: new Date().toISOString(),
        amount: "10.00",
        payee: "Vendor",
        desc: "Test",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows access with valid jwt and matching org", async () => {
    const viewerToken = createToken({ sub: "user-1", orgId: "org-1", roles: ["viewer"] }, secret);

    const usersResponse = await app.inject({
      method: "GET",
      url: "/users?orgId=org-1",
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(usersResponse.statusCode).toBe(200);

    const operatorToken = createToken({ sub: "user-1", orgId: "org-1", roles: ["operator"] }, secret);

    const postResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        orgId: "org-1",
        date: new Date().toISOString(),
        amount: "100.00",
        payee: "Vendor",
        desc: "Valid",
      },
    });

    expect(postResponse.statusCode).toBe(201);
  });
});
