import { test, expect } from "@playwright/test";
import { prisma } from "../shared-client";

const baseURL = process.env.API_BASE_URL ?? "http://127.0.0.1:4010";

test.beforeEach(async () => {
  await prisma.bankLine.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
});

test("existing user can review and extend bank lines", async ({ request }) => {
  const org = await prisma.org.create({ data: { name: "Birchal Org" } });
  await prisma.user.create({
    data: { email: "founder@example.com", password: "password123", orgId: org.id },
  });

  const usersRes = await request.get(`${baseURL}/users`);
  expect(usersRes.status()).toBe(200);
  const usersPayload = (await usersRes.json()) as { users: Array<{ email: string; orgId: string }> };
  expect(usersPayload.users).toHaveLength(1);
  expect(usersPayload.users[0].email).toBe("founder@example.com");

  const createRes = await request.post(`${baseURL}/bank-lines`, {
    data: {
      orgId: org.id,
      date: new Date("2024-01-02T00:00:00Z").toISOString(),
      amount: "5000.00",
      payee: "Birchal",
      desc: "Equity raise",
    },
  });

  expect(createRes.status()).toBe(201);
  const created = (await createRes.json()) as { id: string; orgId: string; payee: string };
  expect(created.orgId).toBe(org.id);
  expect(created.payee).toBe("Birchal");

  const linesRes = await request.get(`${baseURL}/bank-lines?take=5`);
  expect(linesRes.status()).toBe(200);
  const linesPayload = (await linesRes.json()) as { lines: Array<{ payee: string; desc: string }> };
  expect(linesPayload.lines).toHaveLength(1);
  expect(linesPayload.lines[0].payee).toBe("Birchal");
  expect(linesPayload.lines[0].desc).toBe("Equity raise");
});

test("invalid bank line submission is rejected", async ({ request }) => {
  const res = await request.post(`${baseURL}/bank-lines`, {
    data: { orgId: "", date: "yesterday", amount: "abc", payee: "", desc: "" },
  });

  expect(res.status()).toBe(400);
  const payload = (await res.json()) as { error: string };
  expect(payload.error).toBe("bad_request");
});
