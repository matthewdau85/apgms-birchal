import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/src/db";
import { registerConnectorOAuthRoutes } from "./routes/connectors.oauth";
import { registerConnectorWebhookRoutes } from "./routes/connectors.webhooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    try {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as string);
      (request as any).rawBody = buffer;
      if (buffer.length === 0) {
        done(null, {});
        return;
      }
      const parsed = JSON.parse(buffer.toString("utf8"));
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
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

  registerConnectorOAuthRoutes(app);
  registerConnectorWebhookRoutes(app);

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

export function resolveEnvPath() {
  return path.resolve(__dirname, "../../../.env");
}
