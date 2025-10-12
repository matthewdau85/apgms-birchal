import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

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
      category?: string;
      payee: string;
      desc: string;
    };
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        category: body.category?.trim() || "Uncategorized",
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

const summaryQuerySchema = z.object({
  orgId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_date");
  }
  return parsed;
};

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

app.get("/reports/summary", async (req, rep) => {
  try {
    const query = summaryQuerySchema.parse(req.query);
    const from = parseDate(query.from);
    const to = parseDate(query.to);

    const where: Prisma.BankLineWhereInput = {
      orgId: query.orgId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [categoryGroups, inflowAgg, outflowAgg, positiveByDate, negativeByDate] =
      await Promise.all([
        prisma.bankLine.groupBy({
          by: ["category"],
          where,
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.bankLine.aggregate({
          where: { ...where, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        prisma.bankLine.aggregate({
          where: { ...where, amount: { lt: 0 } },
          _sum: { amount: true },
        }),
        prisma.bankLine.groupBy({
          by: ["date"],
          where: { ...where, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        prisma.bankLine.groupBy({
          by: ["date"],
          where: { ...where, amount: { lt: 0 } },
          _sum: { amount: true },
        }),
      ]);

    const totalsByCategory = categoryGroups
      .map((group) => ({
        category: group.category ?? "Uncategorized",
        total: Number(group._sum.amount ?? 0),
        count: group._count._all,
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const inflow = Number(inflowAgg._sum.amount ?? 0);
    const outflow = Math.abs(Number(outflowAgg._sum.amount ?? 0));
    const net = inflow - outflow;

    const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

    for (const group of positiveByDate) {
      const month = formatMonth(group.date);
      const entry = monthlyMap.get(month) ?? { inflow: 0, outflow: 0 };
      entry.inflow += Number(group._sum.amount ?? 0);
      monthlyMap.set(month, entry);
    }

    for (const group of negativeByDate) {
      const month = formatMonth(group.date);
      const entry = monthlyMap.get(month) ?? { inflow: 0, outflow: 0 };
      entry.outflow += Math.abs(Number(group._sum.amount ?? 0));
      monthlyMap.set(month, entry);
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([month, values]) => ({
        month,
        inflow: values.inflow,
        outflow: values.outflow,
        net: values.inflow - values.outflow,
      }));

    return {
      totalsByCategory,
      inflow,
      outflow,
      net,
      monthly,
    };
  } catch (error) {
    req.log.error(error);
    if (error instanceof z.ZodError || (error as Error).message === "invalid_date") {
      return rep.code(400).send({ error: "bad_request" });
    }
    return rep.code(500).send({ error: "internal_error" });
  }
});

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

