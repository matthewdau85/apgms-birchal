import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";
import { requireOrg, requireRole, verifyAuth } from "./plugins/auth";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.addHook("preHandler", verifyAuth);

  app.get(
    "/users",
    {
      preHandler: [requireOrg(), requireRole("viewer")],
    },
    async (req) => {
      const query = z.object({ orgId: z.string() }).parse(req.query);
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        where: { orgId: query.orgId },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    },
  );

  app.get(
    "/bank-lines",
    {
      preHandler: [requireOrg(), requireRole("viewer")],
    },
    async (req) => {
      const query = z
        .object({
          orgId: z.string(),
          take: z
            .union([z.string(), z.number()])
            .optional()
            .transform((value) => (value === undefined ? undefined : Number(value)))
            .refine((value) => value === undefined || Number.isFinite(value), {
              message: "invalid_take",
            }),
        })
        .transform((value) => ({
          orgId: value.orgId,
          take: value.take !== undefined ? Math.min(Math.max(Math.trunc(value.take), 1), 200) : undefined,
        }))
        .parse(req.query);

      const take = query.take ?? 20;
      const lines = await prisma.bankLine.findMany({
        where: { orgId: query.orgId },
        orderBy: { date: "desc" },
        take,
      });
      return { lines };
    },
  );

  app.post(
    "/bank-lines",
    {
      preHandler: [requireOrg(), requireRole("operator")],
    },
    async (req, rep) => {
      try {
        const body = z
          .object({
            orgId: z.string(),
            date: z.string(),
            amount: z.union([z.string(), z.number()]),
            payee: z.string(),
            desc: z.string(),
          })
          .parse(req.body);

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
    },
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

export const app = buildApp();

const isExecutedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isExecutedDirectly && process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app
    .listen({ port, host })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
