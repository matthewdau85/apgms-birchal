import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/index";

type RouteEntry = {
  name: string;
  method: "GET" | "POST";
  url: string;
  roles: string[];
  okStatus: number;
  payload?: Record<string, unknown>;
  query?: Record<string, unknown>;
  wrongOrgHeader?: "x-org-id" | "x-dev-org";
};

const PRIMARY_ORG = "org-main";
const OTHER_ORG = "org-other";

const prismaMock = {
  user: {
    async findMany() {
      return [];
    },
  },
  bankLine: {
    async findMany(args: { where?: { orgId?: string }; take?: number }) {
      return [
        {
          id: "line-1",
          orgId: args.where?.orgId ?? PRIMARY_ORG,
          amount: 0,
          date: new Date().toISOString(),
          payee: "Example",
          desc: "Stub",
        },
      ];
    },
    async create({ data }: { data: Record<string, any> }) {
      return { id: "line-new", ...data };
    },
  },
  allocation: {},
  auditReport: {},
};

const ROUTES: RouteEntry[] = [
  {
    name: "users",
    method: "GET",
    url: "/users",
    roles: ["admin"],
    okStatus: 200,
    wrongOrgHeader: "x-org-id",
  },
  {
    name: "bank-lines:list",
    method: "GET",
    url: "/bank-lines",
    roles: ["user"],
    okStatus: 200,
    query: { take: 5 },
    wrongOrgHeader: "x-org-id",
  },
  {
    name: "bank-lines:create",
    method: "POST",
    url: "/bank-lines",
    roles: ["finance"],
    okStatus: 201,
    payload: {
      orgId: PRIMARY_ORG,
      date: new Date().toISOString(),
      amount: 42,
      payee: "Vendor",
      desc: "Payment",
    },
    wrongOrgHeader: "x-org-id",
  },
  {
    name: "allocations:preview",
    method: "POST",
    url: "/allocations/preview",
    roles: ["analyst"],
    okStatus: 200,
    payload: { orgId: PRIMARY_ORG, amount: 1000 },
    wrongOrgHeader: "x-dev-org",
  },
  {
    name: "allocations:apply",
    method: "POST",
    url: "/allocations/apply",
    roles: ["admin"],
    okStatus: 200,
    payload: { orgId: PRIMARY_ORG },
    wrongOrgHeader: "x-org-id",
  },
  {
    name: "audit:rpt",
    method: "GET",
    url: "/audit/rpt/report-123",
    roles: ["auditor"],
    okStatus: 200,
    wrongOrgHeader: "x-org-id",
  },
  {
    name: "dashboard",
    method: "GET",
    url: "/dashboard",
    roles: ["user"],
    okStatus: 200,
    wrongOrgHeader: "x-org-id",
  },
];

test("protected routes enforce authentication and scope", async (t) => {
  process.env.AUTH_BYPASS = "false";

  const app = (await buildApp({ logger: false, prisma: prismaMock as any })) as FastifyInstance;
  await app.ready();

  t.after(async () => {
    await app.close();
  });

  for (const route of ROUTES) {
    await t.test(`${route.method} ${route.url}`, async (t) => {
      const url = buildUrl(route.url, route.query);

      await t.test("401 without token", async () => {
        const headers = makeDevHeaders(PRIMARY_ORG, route.roles);
        delete headers.authorization;
        const response = await app.inject({
          method: route.method,
          url,
          payload: route.payload,
          headers,
        });
        assert.equal(response.statusCode, 401, `${route.name} should reject missing tokens`);
      });

      await t.test("403 on wrong org", async () => {
        const headers = makeDevHeaders(PRIMARY_ORG, route.roles);
        if (route.wrongOrgHeader === "x-dev-org") {
          headers["x-dev-org"] = OTHER_ORG;
        } else {
          headers["x-org-id"] = OTHER_ORG;
        }
        const response = await app.inject({
          method: route.method,
          url,
          payload: route.payload,
          headers,
        });
        assert.equal(response.statusCode, 403, `${route.name} should reject cross-org access`);
      });

      await t.test("success with matching org", async () => {
        const headers = makeDevHeaders(PRIMARY_ORG, route.roles);
        const response = await app.inject({
          method: route.method,
          url,
          payload: route.payload,
          headers,
        });
        assert.equal(response.statusCode, route.okStatus, `${route.name} should allow valid requests`);
      });
    });
  }
});

function makeDevHeaders(orgId: string, roles: string[]): Record<string, string> {
  const token = makeToken({ sub: "user-1", orgId, roles });
  return {
    authorization: `Bearer ${token}`,
    "x-org-id": orgId,
  };
}

type TokenInput = {
  sub: string;
  orgId: string;
  roles: string[];
};

function makeToken(payload: TokenInput): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  if (!query || Object.keys(query).length === 0) {
    return path;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}
