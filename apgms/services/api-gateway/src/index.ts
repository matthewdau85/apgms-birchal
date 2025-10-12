import cors from "@fastify/cors";
import Fastify from "fastify";

import { env, prisma } from "@apgms/shared";

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
});

const corsOrigin = env.CORS_ORIGIN ?? true;
await app.register(cors, { origin: corsOrigin });

app.log.info({ databaseUrlConfigured: Boolean(env.DATABASE_URL) }, "loaded env");

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

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = env.PORT;
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
