import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://apgms:apgms@localhost:5432/apgms";

test("prisma client exposes disconnect", async () => {
  const { prisma } = await import("../src/db");
  assert.ok(prisma);
  assert.equal(typeof prisma.$disconnect, "function");
});
