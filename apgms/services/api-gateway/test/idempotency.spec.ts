import assert from "node:assert/strict";
import Fastify from "fastify";
import idempotencyPlugin from "../src/plugins/idempotency";

async function setupTestApp() {
  const app = Fastify();
  await idempotencyPlugin(app);

  let createCount = 0;
  app.post(
    "/bank-lines",
    { config: { idempotency: true } },
    async (req, reply) => {
      createCount += 1;
      return reply.code(201).send({ created: createCount, orgId: (req.body as any)?.orgId });
    },
  );

  let applyCount = 0;
  app.post(
    "/allocations/apply",
    { config: { idempotency: true } },
    async (req, reply) => {
      applyCount += 1;
      return reply.send({ applied: applyCount, orgId: (req.body as any)?.orgId });
    },
  );

  await app.ready();

  return { app, counters: { get create() { return createCount; }, get apply() { return applyCount; } } };
}

async function run() {
  const { app, counters } = await setupTestApp();

  try {
    const firstCreate = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "create-1",
      },
      payload: {
        orgId: "org-1",
        amount: 100,
      },
    });

    assert.equal(firstCreate.statusCode, 201);
    assert.equal(counters.create, 1);
    assert.deepEqual(firstCreate.json(), { created: 1, orgId: "org-1" });

    const replayCreate = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "create-1",
      },
      payload: {
        orgId: "org-1",
        amount: 100,
      },
    });

    assert.equal(replayCreate.statusCode, 201);
    assert.equal(counters.create, 1, "handler should not execute on cached replay");
    assert.deepEqual(replayCreate.json(), { created: 1, orgId: "org-1" });

    const firstApply = await app.inject({
      method: "POST",
      url: "/allocations/apply",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "apply-1",
      },
      payload: {
        orgId: "org-1",
        allocations: [{ amount: 42 }],
      },
    });

    assert.equal(firstApply.statusCode, 200);
    assert.equal(counters.apply, 1);
    assert.deepEqual(firstApply.json(), { applied: 1, orgId: "org-1" });

    const replayApply = await app.inject({
      method: "POST",
      url: "/allocations/apply",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "apply-1",
      },
      payload: {
        orgId: "org-1",
        allocations: [{ amount: 42 }],
      },
    });

    assert.equal(replayApply.statusCode, 200);
    assert.equal(counters.apply, 1);
    assert.deepEqual(replayApply.json(), { applied: 1, orgId: "org-1" });
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
