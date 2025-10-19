import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import headersPlugin from "../src/plugins/headers";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "interest-cohort=()",
} as const;

const CSP_HEADER =
  "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3000";

describe("headers plugin", () => {
  it("applies security headers to api responses", async () => {
    const app = Fastify();
    await app.register(headersPlugin);

    app.get("/healthz", async () => ({ ok: true }));

    const response = await app.inject({ method: "GET", url: "/healthz" });

    assert.equal(response.statusCode, 200);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(response.headers[header], value);
    }
    assert.equal(response.headers["content-security-policy"], undefined);
  });

  it("sets csp for web routes", async () => {
    const app = Fastify();
    await app.register(headersPlugin);

    app.get("/app", async (_request, reply) => {
      reply.type("text/html");
      return "<html></html>";
    });

    const response = await app.inject({ method: "GET", url: "/app" });

    assert.equal(response.statusCode, 200);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(response.headers[header], value);
    }
    assert.equal(response.headers["content-security-policy"], CSP_HEADER);
  });
});
