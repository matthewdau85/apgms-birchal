import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import replyValidationPlugin, { withValidatedReply } from "../src/plugins/reply-validate";
import { ListResponse } from "../src/schemas/bank-lines";

test("responds with 500 when reply payload violates schema", async () => {
  const app = Fastify();
  await replyValidationPlugin(app);
  app.get(
    "/broken",
    withValidatedReply(ListResponse, async () => ({
      lines: [
        {
          id: "line_1",
          orgId: "org_1",
          date: new Date().toISOString(),
          amountCents: "1000" as unknown as number,
          payee: "Acme",
          desc: "Test",
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  );

  await app.ready();
  const response = await app.inject({ method: "GET", url: "/broken" });
  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.equal(body.error, "invalid_response_payload");
  assert.ok(body.details);

  await app.close();
});

test("passes through when reply payload matches schema", async () => {
  const app = Fastify();
  await replyValidationPlugin(app);
  app.get(
    "/valid",
    withValidatedReply(ListResponse, async () => ({
      lines: [
        {
          id: "line_1",
          orgId: "org_1",
          date: new Date().toISOString(),
          amountCents: 1000,
          payee: "Acme",
          desc: "Test",
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  );

  await app.ready();
  const response = await app.inject({ method: "GET", url: "/valid" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.lines[0]?.amountCents, 1000);

  await app.close();
});
