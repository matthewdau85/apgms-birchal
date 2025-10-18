import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dashboardResponseSchema } from "../src/schemas/dashboard";
import {
  createBankLineBodySchema,
  createBankLineResponseSchema,
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
} from "../src/schemas/bank-lines";
import { listUsersResponseSchema } from "../src/schemas/users";

const iso = () => new Date().toISOString();

describe("users schema", () => {
  it("accepts a valid response", () => {
    const payload = {
      users: [
        {
          email: "founder@example.com",
          orgId: "org-123",
          createdAt: iso(),
        },
      ],
    };

    assert.doesNotThrow(() => listUsersResponseSchema.parse(payload));
  });

  it("rejects an invalid response", () => {
    const payload = {
      users: [
        {
          email: "not-an-email",
          orgId: "org-123",
          createdAt: "yesterday",
        },
      ],
    };

    assert.throws(() => listUsersResponseSchema.parse(payload));
  });
});

describe("bank line schemas", () => {
  it("parses take from query", () => {
    const query = listBankLinesQuerySchema.parse({ take: "50" });
    assert.equal(query.take, 50);
  });

  it("accepts valid list response", () => {
    const payload = {
      lines: [
        {
          id: "line-1",
          orgId: "org-1",
          date: iso(),
          amount: "1250.40",
          payee: "Acme",
          desc: "Office fit-out",
          createdAt: iso(),
        },
      ],
    };

    assert.doesNotThrow(() => listBankLinesResponseSchema.parse(payload));
  });

  it("rejects invalid list response", () => {
    const payload = {
      lines: [
        {
          id: "line-1",
          orgId: "org-1",
          date: "invalid",
          amount: "oops",
          payee: "Acme",
          desc: "Office fit-out",
          createdAt: iso(),
        },
      ],
    };

    assert.throws(() => listBankLinesResponseSchema.parse(payload));
  });

  it("coerces amount when creating", () => {
    const payload = {
      orgId: "org-1",
      date: iso(),
      amount: 1250.4,
      payee: "Acme",
      desc: "Office fit-out",
    };

    const parsed = createBankLineBodySchema.parse(payload);
    assert.equal(parsed.amount, "1250.4");
  });

  it("rejects invalid create payload", () => {
    const payload = {
      orgId: "org-1",
      date: "not-a-date",
      amount: "abc",
      payee: "Acme",
      desc: "Office fit-out",
    };

    assert.throws(() => createBankLineBodySchema.parse(payload));
  });

  it("validates create response", () => {
    const payload = {
      id: "line-2",
      orgId: "org-1",
      date: iso(),
      amount: "10.00",
      payee: "CloudCo",
      desc: "Subscription",
      createdAt: iso(),
    };

    assert.doesNotThrow(() => createBankLineResponseSchema.parse(payload));
  });
});

describe("dashboard schema", () => {
  it("accepts a valid payload", () => {
    const payload = {
      totals: {
        users: 10,
        bankLines: 25,
        balance: "1200.00",
      },
      recentBankLines: [
        {
          id: "line-1",
          orgId: "org-1",
          date: iso(),
          amount: "100.00",
          payee: "Acme",
          desc: "Office fit-out",
          createdAt: iso(),
        },
      ],
    };

    assert.doesNotThrow(() => dashboardResponseSchema.parse(payload));
  });

  it("rejects an invalid payload", () => {
    const payload = {
      totals: {
        users: -1,
        bankLines: 2,
        balance: "abc",
      },
      recentBankLines: [],
    };

    assert.throws(() => dashboardResponseSchema.parse(payload));
  });
});
