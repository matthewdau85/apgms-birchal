import { describe, it, expect, beforeEach } from "./harness";
import { buildApp } from "../services/api-gateway/src/app";
import { prisma, resetInMemoryStore } from "@apgms/shared";

describe("privacy routes", () => {
  beforeEach(async () => {
    resetInMemoryStore?.();
  });

  it("requires admin for export", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/privacy/export/org-1" });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("exports and soft deletes data", async () => {
    const app = await buildApp();

    const exportResponse = await app.inject({
      method: "GET",
      url: "/privacy/export/org-1",
      headers: { "x-admin-token": "local-admin" },
    });
    expect(exportResponse.statusCode).toBe(200);
    const payload = exportResponse.json();
    expect(payload.users.length).toBeGreaterThan(0);

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/privacy/delete/org-1",
      headers: { "x-admin-token": "local-admin" },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const users = await prisma.user.findMany({ where: { orgId: "org-1" } });
    const lines = await prisma.bankLine.findMany({ where: { orgId: "org-1" } });

    expect(users.every((u: any) => u.deletedAt)).toBe(true);
    expect(lines.every((l: any) => l.deletedAt)).toBe(true);

    await app.close();
  });
});
