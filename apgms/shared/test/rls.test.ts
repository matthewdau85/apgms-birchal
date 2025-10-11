import test from "node:test";
import assert from "node:assert/strict";
import { prisma, withOrgContext } from "../src/db";

const teardown = () => prisma.$disconnect();

test("row-level security enforces org isolation", async (t) => {
  t.after(teardown);
  const orgs = await prisma.org.findMany({ orderBy: { slug: "asc" }, take: 2 });
  assert.ok(orgs.length >= 2, "expected at least two organisations");

  const [orgA, orgB] = orgs;
  const bankLineForOrgB = await prisma.bankLine.findFirst({ where: { orgId: orgB.id } });
  assert.ok(bankLineForOrgB, "expected seed data for second org");

  const visibleToOrgA = await withOrgContext(orgA.id, (tx) =>
    tx.bankLine.findMany({ where: { orgId: orgB.id } })
  );

  assert.equal(visibleToOrgA.length, 0, "no cross-org rows should be returned");
});
