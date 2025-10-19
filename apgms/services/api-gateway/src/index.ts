import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../../../shared/src/db";
import {
  computeDeterministicAllocation,
  AllocationError,
} from "../../../shared/src/policy-engine";
import {
  allocationPreviewRequestSchema,
  allocationPreviewResponseSchema,
} from "./schemas/allocations.preview.schema";
import {
  ledgerEntryInputSchema,
  type LedgerEntry,
  type LedgerEntryInput,
} from "./schemas/ledger.schema";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export interface LedgerRepository {
  append(entries: LedgerEntryInput[]): Promise<LedgerEntry[]>;
}

export class InMemoryLedger implements LedgerRepository {
  private readonly entries: LedgerEntry[] = [];

  async append(entries: LedgerEntryInput[]): Promise<LedgerEntry[]> {
    const stamped = entries.map((entry) => ({
      ...entry,
      id: randomUUID(),
      createdAt: new Date(),
    }));
    this.entries.push(...stamped);
    return stamped;
  }

  getAll(): LedgerEntry[] {
    return [...this.entries];
  }
}

export interface BuildAppOptions {
  fastifyOptions?: FastifyServerOptions;
  prisma?: PrismaClient;
  ledger?: LedgerRepository;
}

const normalizeLedgerInputs = (
  orgId: string,
  allocations: { gateId: string; amount: number }[],
): LedgerEntryInput[] => {
  return allocations
    .filter((allocation) => allocation.amount > 0)
    .map((allocation) =>
      ledgerEntryInputSchema.parse({
        orgId,
        gateId: allocation.gateId,
        amount: allocation.amount,
      }),
    );
};

const buildAllocationResponse = (
  response: unknown,
): ReturnType<typeof allocationPreviewResponseSchema.parse> => {
  return allocationPreviewResponseSchema.parse(response);
};

export const buildApp = async (
  options: BuildAppOptions = {},
): Promise<FastifyInstance> => {
  const fastifyOptions = options.fastifyOptions ?? { logger: true };
  const app = Fastify(fastifyOptions);
  const prisma = options.prisma ?? defaultPrisma;
  const ledger = options.ledger ?? new InMemoryLedger();

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

  app.post("/allocations/preview", async (req, rep) => {
    try {
      const payload = allocationPreviewRequestSchema.parse(req.body);
      const preview = computeDeterministicAllocation({
        amount: payload.amount,
        gates: payload.gates.map((gate) => ({
          id: gate.id,
          state: gate.state,
          weight: gate.weight,
        })),
      });
      const response = buildAllocationResponse(preview);
      return rep.status(200).send(response);
    } catch (error) {
      if (error instanceof AllocationError) {
        return rep.status(400).send({ error: error.message });
      }
      if (error instanceof Error) {
        return rep.status(400).send({ error: error.message });
      }
      return rep.status(400).send({ error: "invalid_request" });
    }
  });

  app.post("/allocations/apply", async (req, rep) => {
    try {
      const payload = allocationPreviewRequestSchema.parse(req.body);
      const preview = computeDeterministicAllocation({
        amount: payload.amount,
        gates: payload.gates.map((gate) => ({
          id: gate.id,
          state: gate.state,
          weight: gate.weight,
        })),
      });

      const ledgerInputs = normalizeLedgerInputs(payload.orgId, preview.allocations);
      const entries = await ledger.append(ledgerInputs);

      const response = {
        ...preview,
        ledgerEntries: entries,
      };

      return rep.status(201).send(response);
    } catch (error) {
      if (error instanceof AllocationError) {
        return rep.status(400).send({ error: error.message });
      }
      if (error instanceof Error) {
        return rep.status(400).send({ error: error.message });
      }
      return rep.status(400).send({ error: "invalid_request" });
    }
  });

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  buildApp()
    .then((app) =>
      app.listen({ port, host }).catch((err) => {
        app.log.error(err);
        process.exit(1);
      }),
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
