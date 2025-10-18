import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";
import { replace } from "./helpers";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

test("GET /audit returns recent audit events", async () => {
  const restoreFindMany = replace(prisma.auditEvent, "findMany", async () => [
    {
      id: "audit_1",
      orgId: "org_1",
      allocationId: null,
      actor: "system",
      action: "BANK_LINE_IMPORTED",
      details: { origin: "web" },
      createdAt: new Date("2024-04-01T00:00:00.000Z"),
    },
  ] as any);

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/audit?orgId=org_1&limit=5",
    });

    assert.equal(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      items: [
        {
          id: "audit_1",
          orgId: "org_1",
          allocationId: null,
          actor: "system",
          action: "BANK_LINE_IMPORTED",
          details: { origin: "web" },
          createdAt: "2024-04-01T00:00:00.000Z",
        },
      ],
    });
  } finally {
    await app.close();
    restoreFindMany();
  }
});

test("GET /audit returns a validation error for invalid limits", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/audit?orgId=org_1&limit=200",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
