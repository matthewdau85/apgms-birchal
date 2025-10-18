import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { createMetricsCollector, MetricsCollector } from "./metrics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

interface UserRecord {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
  orgId: string;
}

interface BankLineRecord {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

interface DbClient {
  user: {
    findMany(args: { select?: any; orderBy?: any }): Promise<Partial<UserRecord>[]>;
  };
  bankLine: {
    findMany(args: { orderBy?: any; take?: number }): Promise<BankLineRecord[]>;
    create(args: { data: any }): Promise<BankLineRecord>;
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockDb(): DbClient {
  const users: UserRecord[] = [
    {
      id: randomUUID(),
      email: "linda@birchal.example",
      password: "hashed",
      createdAt: new Date("2024-07-21T08:20:00Z"),
      orgId: "org_birchal",
    },
    {
      id: randomUUID(),
      email: "owen@lumen.example",
      password: "hashed",
      createdAt: new Date("2024-07-18T10:30:00Z"),
      orgId: "org_lumen",
    },
    {
      id: randomUUID(),
      email: "harper@acme.example",
      password: "hashed",
      createdAt: new Date("2024-06-30T12:10:00Z"),
      orgId: "org_acme",
    },
    {
      id: randomUUID(),
      email: "sanjay@acme.example",
      password: "hashed",
      createdAt: new Date("2024-06-28T09:45:00Z"),
      orgId: "org_acme",
    },
  ];

  const bankLines: BankLineRecord[] = [
    {
      id: randomUUID(),
      orgId: "org_birchal",
      date: new Date("2024-07-20"),
      amount: 1250.4,
      payee: "ATO",
      desc: "GST remittance",
      createdAt: new Date("2024-07-20T08:15:00Z"),
    },
    {
      id: randomUUID(),
      orgId: "org_lumen",
      date: new Date("2024-07-19"),
      amount: 982.1,
      payee: "Telco Services",
      desc: "Enterprise connectivity",
      createdAt: new Date("2024-07-19T09:42:00Z"),
    },
    {
      id: randomUUID(),
      orgId: "org_acme",
      date: new Date("2024-07-18"),
      amount: 450.0,
      payee: "Cloud Vendor",
      desc: "Compute credits",
      createdAt: new Date("2024-07-18T11:00:00Z"),
    },
    {
      id: randomUUID(),
      orgId: "org_birchal",
      date: new Date("2024-07-16"),
      amount: 220.13,
      payee: "Office Supplies",
      desc: "Refills",
      createdAt: new Date("2024-07-16T14:12:00Z"),
    },
  ];

  return {
    user: {
      async findMany(args) {
        await wait(18 + Math.random() * 6);
        const ordered = [...users].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const selected = ordered.map((user) => ({
          email: user.email,
          orgId: user.orgId,
          createdAt: user.createdAt,
        }));
        return selected;
      },
    },
    bankLine: {
      async findMany(args) {
        await wait(28 + Math.random() * 10);
        const take = Math.min(Math.max(args?.take ?? bankLines.length, 1), 200);
        const ordered = [...bankLines].sort((a, b) => b.date.getTime() - a.date.getTime());
        return ordered.slice(0, take);
      },
      async create(args) {
        const delay = 42 + Math.random() * 15;
        await wait(delay);
        const data = args.data;
        const now = new Date();
        const record: BankLineRecord = {
          id: randomUUID(),
          orgId: data.orgId,
          date: new Date(data.date),
          amount: Number(data.amount),
          payee: data.payee,
          desc: data.desc,
          createdAt: now,
        };
        bankLines.unshift(record);
        // Simulate light compute to make profiling non-trivial.
        let checksum = 0;
        const iterations = 5_000;
        for (let i = 0; i < iterations; i += 1) {
          checksum += Math.sqrt(i + record.amount);
        }
        if (checksum < 0) {
          throw new Error("checksum underflow");
        }
        return record;
      },
    },
  } satisfies DbClient;
}

export interface BuildAppOptions {
  useMockDb?: boolean;
  collector?: MetricsCollector;
}

export interface BuildAppResult {
  app: FastifyInstance;
  collector: MetricsCollector;
  db: DbClient;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<BuildAppResult> {
  const collector = options.collector ?? createMetricsCollector();
  let db: DbClient;
  if (options.useMockDb) {
    db = createMockDb();
  } else {
    const { prisma } = await import("../../../shared/src/db");
    db = prisma as unknown as DbClient;
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.addHook("onRequest", (req, _rep, done) => {
    (req as any).metricsStart = performance.now();
    done();
  });

  app.addHook("onResponse", (req, rep, done) => {
    const start = (req as any).metricsStart ?? performance.now();
    const duration = performance.now() - start;
    const route = req.routeOptions?.url ?? req.routerPath ?? req.url;
    collector.recordRequest(req.method, route, rep.statusCode, duration);
    done();
  });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await collector.time("db.user.findMany", () =>
      db.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      } as any)
    );
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await collector.time("db.bankLine.findMany", () =>
      db.bankLine.findMany({
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      })
    );
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
      const created = await collector.time("db.bankLine.create", () =>
        db.bankLine.create({
          data: {
            orgId: body.orgId,
            date: new Date(body.date),
            amount: body.amount as any,
            payee: body.payee,
            desc: body.desc,
          },
        })
      );
      return rep.code(201).send(created);
    } catch (e) {
      req.log.error(e);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  return { app, collector, db };
}
