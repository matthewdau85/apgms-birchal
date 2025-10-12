import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// health
app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// bank-lines (adjust fields to match your schema)
app.get("/bank-lines", async () => {
  return prisma.bankLine.findMany({ orderBy: { createdAt: "desc" } });
});

app.post("/bank-lines", async (req, reply) => {
  const b: any = req.body ?? {};
  const row = await prisma.bankLine.create({
    data: {
      orgId: b.orgId ?? "demo-org",    // replace with real org linkage
      date: b.date ? new Date(b.date) : new Date(),
      amount: Number(b.amount ?? 0),
      payee: String(b.payee ?? "n/a"),
      desc: String(b.desc ?? "n/a"),
    },
  });
  reply.code(201);
  return row;
});

// proxy to tax-engine /health
app.get("/tax/health", async (req, reply) => {
  try {
    const base = process.env.TAX_ENGINE_URL ?? "http://localhost:8000";
    const r = await fetch(`${base}/health`);
    return await r.json();
  } catch (e) {
    app.log.error(e);
    reply.code(502);
    return { ok: false, error: "tax-engine unavailable" };
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
