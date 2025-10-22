import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BankLine } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@apgms/shared/src/db";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  const mod = await import("../src/index.js");
  app = mod.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /bank-lines", () => {
  it("invalid payload -> 400 with zod errors", async () => {
    const createSpy = vi.spyOn(prisma.bankLine, "create");

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "content-type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(Array.isArray(body.errors)).toBe(true);
    const paths = body.errors
      .map((issue: { path: (string | number)[] }) => issue.path.join("."))
      .sort();
    expect(paths).toEqual(["amount", "date", "desc", "orgId", "payee"]);
    expect(createSpy.mock.calls.length).toBe(0);
  });

  it("valid payload -> 201 with schema-confirmed shape", async () => {
    const eventDate = new Date("2024-01-10T09:00:00.000Z");
    const createdAt = new Date("2024-01-11T10:00:00.000Z");

    const created: BankLine = {
      id: "line_1",
      orgId: "org_123",
      date: eventDate,
      amount: new Decimal("123.45"),
      payee: "ACME Pty Ltd",
      desc: "January statement",
      createdAt,
    };

    const createSpy = vi.spyOn(prisma.bankLine, "create").mockResolvedValue(created);

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "content-type": "application/json" },
      payload: {
        orgId: created.orgId,
        date: eventDate.toISOString(),
        amount: "123.45",
        payee: created.payee,
        desc: created.desc,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id: created.id,
      orgId: created.orgId,
      date: eventDate.toISOString(),
      amount: 123.45,
      payee: created.payee,
      desc: created.desc,
      createdAt: createdAt.toISOString(),
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith({
      data: {
        orgId: created.orgId,
        date: eventDate,
        amount: 123.45,
        payee: created.payee,
        desc: created.desc,
      },
    });
  });
});
