import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import { authPlugin } from "./plugins/auth";
import { orgScopeHook } from "./hooks/org-scope";

export const buildApp = async () => {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  await app.register(
    async (v1App) => {
      await authPlugin(v1App);
      v1App.addHook("preHandler", orgScopeHook);

      v1App.get("/ping", async (request) => ({
        ok: true,
        user: (request as any).user,
        orgId: (request as any).orgId,
      }));

      v1App.get("/orgs/:orgId/ping", async (request) => ({
        ok: true,
        orgId: (request as any).orgId,
      }));

      // List users (email + org)
      v1App.get("/users", async () => {
        const users = await prisma.user.findMany({
          select: { email: true, orgId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        return { users };
      });

      // List bank lines (latest first)
      v1App.get("/bank-lines", async (req) => {
        const take = Number((req.query as any).take ?? 20);
        const lines = await prisma.bankLine.findMany({
          orderBy: { date: "desc" },
          take: Math.min(Math.max(take, 1), 200),
        });
        return { lines };
      });

      // Create a bank line
      v1App.post("/bank-lines", async (req, rep) => {
        try {
          const body = req.body as {
            orgId: string;
            date: string;
            amount: number | string;
            payee: string;
            desc: string;
          };
          const created = await prisma.bankLine.create({
            data: {
              orgId: body.orgId,
              date: new Date(body.date),
              amount: body.amount as any,
              payee: body.payee,
              desc: body.desc,
            },
          });
          return rep.code(201).send(created);
        } catch (e) {
          req.log.error(e);
          return rep.code(400).send({ error: "bad_request" });
        }
      });
    },
    { prefix: "/v1" },
  );

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = await buildApp();

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
