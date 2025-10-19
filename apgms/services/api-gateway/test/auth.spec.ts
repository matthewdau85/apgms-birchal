import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fastify from "fastify";
import request from "supertest";
import authPlugin from "../src/plugins/auth";
import { orgScopeHook } from "../src/hooks/org-scope";

const JWT_SECRET = process.env.TEST_JWT_SECRET || "dev-secret";

function signHS256(payload: object) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const crypto = require("crypto");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

let app: any;

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISSUER = "apgms";
  process.env.JWT_AUDIENCE = "apgms-clients";

  app = fastify();
  await app.register(authPlugin);
  app.register(async (i, _o, d) => {
    i.addHook("preHandler", i.authenticate as any);
    i.addHook("preHandler", orgScopeHook);
    i.get("/v1/ping", async (_req, reply) => reply.send({ ok: true }));
    i.get("/v1/orgs/:orgId/resource", async (_req, reply) => reply.send({ ok: true }));
    d();
  });
  await app.listen({ port: 0 });
});

afterAll(async () => {
  await app.close();
});

describe("auth", () => {
  it("rejects missing token", async () => {
    const res = await request(app.server).get("/v1/ping");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("rejects bad token", async () => {
    const res = await request(app.server).get("/v1/ping").set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(401);
  });

  it("accepts good token", async () => {
    const token = signHS256({ id: "u1", orgId: "orgA", iss: "apgms", aud: "apgms-clients" });
    const res = await request(app.server).get("/v1/ping").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("org-scope", () => {
  it("forbids cross-org access", async () => {
    const token = signHS256({ id: "u1", orgId: "orgA", iss: "apgms", aud: "apgms-clients" });
    const res = await request(app.server)
      .get("/v1/orgs/orgB/resource")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("allows same-org access", async () => {
    const token = signHS256({ id: "u1", orgId: "orgA", iss: "apgms", aud: "apgms-clients" });
    const res = await request(app.server)
      .get("/v1/orgs/orgA/resource")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
