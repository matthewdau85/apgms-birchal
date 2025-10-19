import type { FastifyInstance, HTTPMethods } from "fastify";
import type { prisma as PrismaInstance } from "../../../../shared/src/db";

type RouteDependencies = {
  prisma: typeof PrismaInstance;
};

type RouteRegistration = (app: FastifyInstance, deps: RouteDependencies) => void | Promise<void>;
export type RouteIdentifier = `${Uppercase<HTTPMethods>} ${string}`;

type RouteEntry = readonly [RouteIdentifier, RouteRegistration];

const ROUTE_REGISTRY_ENTRIES: readonly RouteEntry[] = [
  [
    "GET /health",
    (app) => {
      app.get("/health", async () => ({ ok: true, service: "api-gateway" }));
    },
  ],
  [
    "GET /users",
    (app, deps) => {
      app.get("/users", async () => {
        const users = await deps.prisma.user.findMany({
          select: { email: true, orgId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        return { users };
      });
    },
  ],
  [
    "GET /bank-lines",
    (app, deps) => {
      app.get("/bank-lines", async (req) => {
        const take = Number((req.query as { take?: number | string }).take ?? 20);
        const lines = await deps.prisma.bankLine.findMany({
          orderBy: { date: "desc" },
          take: Math.min(Math.max(take, 1), 200),
        });
        return { lines };
      });
    },
  ],
  [
    "POST /bank-lines",
    (app, deps) => {
      app.post("/bank-lines", async (req, rep) => {
        try {
          const body = req.body as {
            orgId: string;
            date: string;
            amount: number | string;
            payee: string;
            desc: string;
          };
          const created = await deps.prisma.bankLine.create({
            data: {
              orgId: body.orgId,
              date: new Date(body.date),
              amount: Number(body.amount),
              payee: body.payee,
              desc: body.desc,
            },
          });
          return rep.code(201).send(created);
        } catch (error) {
          req.log.error(error);
          return rep.code(400).send({ error: "bad_request" });
        }
      });
    },
  ],
] as const;

const ROUTE_REGISTRY = new Map<RouteIdentifier, RouteRegistration>(ROUTE_REGISTRY_ENTRIES);

export const ROUTE_WHITELIST: readonly RouteIdentifier[] = ROUTE_REGISTRY_ENTRIES.map(([key]) => key);

let cachedDependencies: RouteDependencies | null = null;

async function resolveDependencies(provided?: RouteDependencies): Promise<RouteDependencies> {
  if (provided) {
    return provided;
  }

  if (!cachedDependencies) {
    const module = await import("../../../../shared/src/db.js");
    cachedDependencies = { prisma: module.prisma };
  }

  return cachedDependencies;
}

export async function registerRoutes(
  app: FastifyInstance,
  routes: readonly RouteIdentifier[] = ROUTE_WHITELIST,
  deps?: RouteDependencies,
): Promise<void> {
  const resolvedDeps = await resolveDependencies(deps);

  for (const route of routes) {
    const register = ROUTE_REGISTRY.get(route);
    if (!register) {
      throw new Error(`Route not whitelisted: ${route}`);
    }
    await register(app, resolvedDeps);
  }
}
