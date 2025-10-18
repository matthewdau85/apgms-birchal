import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app";
import { ROLE_MATRIX, ROLES, roleSatisfies, type Role } from "../src/authz";

type MockUser = { email: string; orgId: string; createdAt: Date };
type MockBankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
};

type PrismaLike = Parameters<typeof buildApp>[0]["prisma"];

function createMockPrisma(): PrismaLike {
  const baseLine: MockBankLine = {
    id: "bank-line-1",
    orgId: "org-1",
    date: new Date("2024-01-01"),
    amount: 123.45,
    payee: "Example",
    desc: "Example bank line",
  };

  return {
    user: {
      async findMany() {
        const users: MockUser[] = [
          { email: "viewer@example.com", orgId: "org-1", createdAt: new Date("2023-01-01") },
        ];
        return users;
      },
    },
    bankLine: {
      async findMany() {
        return [baseLine];
      },
      async create({ data }: { data: Record<string, any> }) {
        return { id: "bank-line-created", ...data };
      },
    },
  } satisfies PrismaLike;
}

describe("roles matrix guard rails [docs/roles-matrix.md]", () => {
  for (const entry of ROLE_MATRIX) {
    const label = `[docs/roles-matrix.md] ${entry.method} ${entry.url}`;

    it(`${label} -> missing role yields 401`, async () => {
      const response = await injectAgainstApp(entry);
      assert.strictEqual(response.statusCode, 401);
    });

    for (const role of ROLES) {
      it(`${label} -> ${role} role`, async () => {
        const response = await injectAgainstApp(entry, role);
        const expected = roleSatisfies(role, entry.minRole) ? entry.successStatus : 403;
        assert.strictEqual(response.statusCode, expected);
      });
    }
  }
});

type MatrixEntry = (typeof ROLE_MATRIX)[number];

type InjectResponse = Awaited<ReturnType<ReturnType<typeof buildApp>["inject"]>>;

async function injectAgainstApp(entry: MatrixEntry, role?: Role): Promise<InjectResponse> {
  const app = buildApp({ prisma: createMockPrisma() });
  await app.ready();
  try {
    const headers: Record<string, string> = {};
    if (role) {
      headers["x-role"] = role;
    }

    const requestOptions: Parameters<typeof app.inject>[0] & { payload?: unknown } = {
      method: entry.method,
      url: entry.url,
      headers,
    };

    if (entry.payload) {
      requestOptions.payload = entry.payload;
    }

    return await app.inject(requestOptions);
  } finally {
    await app.close();
  }
}
