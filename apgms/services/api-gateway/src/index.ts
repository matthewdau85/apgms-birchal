import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/db";

import { config } from "./config";
import { registerSecurity } from "./security";

const app = Fastify({
  logger: true,
  bodyLimit: config.maxBodyBytes,
});

const allowAllOrigins = config.corsAllowlist.includes("*");

await app.register(cors, {
  origin: (origin, cb) => {
    if (allowAllOrigins || !origin) {
      cb(null, true);
      return;
    }

    if (config.corsAllowlist.includes(origin)) {
      cb(null, true);
      return;
    }

    cb(new Error("Origin not allowed"), false);
  },
});

await registerSecurity(app);

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
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

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const host = "0.0.0.0";

app
  .listen({ port: config.port, host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
