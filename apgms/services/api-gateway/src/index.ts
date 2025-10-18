import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import { prisma } from "../../../shared/src/db";
import { evaluatePolicy } from "../../../shared/policy-engine/index";
import {
  getRptToken,
  mintRpt,
  verifyChain,
  verifyRpt,
} from "./lib/rpt";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const gateJsonSchema = { type: "string", enum: ["OPEN", "CLOSED"] } as const;

const allocationJsonSchema = {
  type: "object",
  required: ["accountId", "amount", "ruleId", "weight", "gate"],
  properties: {
    accountId: { type: "string" },
    amount: { type: "number" },
    ruleId: { type: "string" },
    weight: { type: "number" },
    gate: gateJsonSchema,
  },
} as const;

const previewBodyJsonSchema = {
  type: "object",
  required: ["bankLine", "ruleset", "accountStates"],
  properties: {
    bankLine: {
      type: "object",
      required: ["id", "orgId", "date", "amount", "payee", "desc"],
      properties: {
        id: { type: "string" },
        orgId: { type: "string" },
        date: { type: "string" },
        amount: { type: "number", minimum: 0 },
        payee: { type: "string" },
        desc: { type: "string" },
      },
    },
    ruleset: {
      type: "object",
      required: ["id", "name", "version", "rules"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        version: { type: "string" },
        rules: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["accountId", "weight"],
            properties: {
              accountId: { type: "string" },
              weight: { type: "number", minimum: 0 },
              gate: gateJsonSchema,
              label: { type: "string" },
            },
          },
        },
      },
    },
    accountStates: {
      type: "array",
      items: {
        type: "object",
        required: ["accountId", "balance"],
        properties: {
          accountId: { type: "string" },
          balance: { type: "number" },
        },
      },
    },
  },
} as const;

const previewResponseJsonSchema = {
  type: "object",
  required: ["allocations", "policyHash", "explain"],
  properties: {
    allocations: { type: "array", items: allocationJsonSchema },
    policyHash: { type: "string" },
    explain: { type: "array", items: { type: "string" } },
  },
} as const;

const applyBodyJsonSchema = {
  ...previewBodyJsonSchema,
  properties: {
    ...previewBodyJsonSchema.properties,
    prevRptId: { type: "string" },
  },
} as const;

const applyResponseJsonSchema = {
  type: "object",
  required: ["ledgerEntry", "rpt"],
  properties: {
    ledgerEntry: {
      type: "object",
      required: ["id", "bankLineId", "policyHash", "allocations", "explain", "createdAt"],
      properties: {
        id: { type: "string" },
        bankLineId: { type: "string" },
        policyHash: { type: "string" },
        allocations: { type: "array", items: allocationJsonSchema },
        explain: { type: "array", items: { type: "string" } },
        createdAt: { type: "string" },
      },
    },
    rpt: {
      type: "object",
      required: ["id", "hash", "signature", "publicKey", "payload"],
      properties: {
        id: { type: "string" },
        hash: { type: "string" },
        signature: { type: "string" },
        publicKey: { type: "string" },
        payload: {
          type: "object",
          required: ["bankLineId", "policyHash", "allocations", "prevHash", "now"],
          properties: {
            bankLineId: { type: "string" },
            policyHash: { type: "string" },
            allocations: { type: "array", items: allocationJsonSchema },
            prevHash: { type: ["string", "null"] },
            now: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const auditParamsJsonSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
} as const;

const auditResponseJsonSchema = {
  type: "object",
  required: ["rpt", "valid", "chainValid"],
  properties: {
    rpt: applyResponseJsonSchema.properties.rpt,
    valid: { type: "boolean" },
    chainValid: { type: "boolean" },
  },
} as const;

const gateSchema = z.enum(["OPEN", "CLOSED"]);

const allocationRuleSchema = z.object({
  accountId: z.string().min(1),
  weight: z.number().nonnegative(),
  gate: gateSchema.default("OPEN"),
  label: z.string().optional(),
});

const accountStateSchema = z.object({
  accountId: z.string().min(1),
  balance: z.number(),
});

const bankLineSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number().nonnegative(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const policyEngineInputSchema = z.object({
  bankLine: bankLineSchema,
  ruleset: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    rules: z.array(allocationRuleSchema).min(1),
  }),
  accountStates: z.array(accountStateSchema),
});

const allocationsResponseSchema = z.object({
  allocations: z.array(
    z.object({
      accountId: z.string(),
      amount: z.number(),
      ruleId: z.string(),
      weight: z.number(),
      gate: gateSchema,
    }),
  ),
  policyHash: z.string(),
  explain: z.array(z.string()),
});

const applyRequestSchema = policyEngineInputSchema.extend({
  prevRptId: z.string().min(1).optional(),
});

const applyResponseSchema = z.object({
  ledgerEntry: z.object({
    id: z.string(),
    bankLineId: z.string(),
    policyHash: z.string(),
    allocations: z.array(
      z.object({
        accountId: z.string(),
        amount: z.number(),
        ruleId: z.string(),
        weight: z.number(),
        gate: gateSchema,
      }),
    ),
    explain: z.array(z.string()),
    createdAt: z.string(),
  }),
  rpt: z.object({
    id: z.string(),
    hash: z.string(),
    signature: z.string(),
    publicKey: z.string(),
    payload: z.object({
      bankLineId: z.string(),
      policyHash: z.string(),
      allocations: z.array(
        z.object({
          accountId: z.string(),
          amount: z.number(),
          ruleId: z.string(),
          weight: z.number(),
          gate: gateSchema,
        }),
      ),
      prevHash: z.string().nullable(),
      now: z.string(),
    }),
  }),
});

const auditParamsSchema = z.object({
  id: z.string().min(1),
});

const auditResponseSchema = z.object({
  rpt: z.object({
    id: z.string(),
    hash: z.string(),
    signature: z.string(),
    publicKey: z.string(),
    payload: z.object({
      bankLineId: z.string(),
      policyHash: z.string(),
      allocations: z.array(
        z.object({
          accountId: z.string(),
          amount: z.number(),
          ruleId: z.string(),
          weight: z.number(),
          gate: gateSchema,
        }),
      ),
      prevHash: z.string().nullable(),
      now: z.string(),
    }),
  }),
  valid: z.boolean(),
  chainValid: z.boolean(),
});

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

const ledgerStore = new Map<
  string,
  {
    id: string;
    bankLineId: string;
    policyHash: string;
    allocations: ReturnType<typeof evaluatePolicy>["allocations"];
    explain: string[];
    createdAt: Date;
  }
>();

app.post(
  "/allocations/preview",
  {
    schema: {
      body: previewBodyJsonSchema,
      response: { 200: previewResponseJsonSchema },
    },
  },
  async (req, rep) => {
    try {
      const parsed = policyEngineInputSchema.parse(req.body);
      const evaluated = evaluatePolicy(parsed);
      return evaluated;
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "invalid_request" });
    }
  },
);

app.post(
  "/allocations/apply",
  {
    schema: {
      body: applyBodyJsonSchema,
      response: { 200: applyResponseJsonSchema },
    },
  },
  async (req, rep) => {
    try {
      const parsed = applyRequestSchema.parse(req.body);
      const evaluated = evaluatePolicy(parsed);

      let prevHash: string | null = null;
      if (parsed.prevRptId) {
        const prevToken = await getRptToken(parsed.prevRptId);
        if (!prevToken) {
          return rep.code(400).send({ error: "invalid_prev_rpt" });
        }
        prevHash = prevToken.hash;
      }

      const now = new Date().toISOString();
      const rpt = mintRpt({
        bankLineId: parsed.bankLine.id,
        policyHash: evaluated.policyHash,
        allocations: evaluated.allocations,
        prevHash,
        now,
      });

      if ((prisma as any).ledgerEntry?.create) {
        const created = await (prisma as any).ledgerEntry.create({
          data: {
            bankLineId: parsed.bankLine.id,
            policyHash: evaluated.policyHash,
            allocations: evaluated.allocations as unknown as any,
            explain: evaluated.explain as unknown as any,
            rptToken: {
              create: {
                id: rpt.id,
                payload: rpt.payload as unknown as any,
                hash: rpt.hash,
                signature: rpt.signature,
                publicKey: rpt.publicKey,
                prevHash: rpt.payload.prevHash,
              },
            },
          },
          select: {
            id: true,
            bankLineId: true,
            policyHash: true,
            createdAt: true,
          },
        });

        return {
          ledgerEntry: {
            id: created.id,
            bankLineId: created.bankLineId,
            policyHash: created.policyHash,
            allocations: evaluated.allocations,
            explain: evaluated.explain,
            createdAt: created.createdAt.toISOString(),
          },
          rpt,
        };
      }

      const fallbackId = randomUUID();
      const createdAt = new Date(now);
      ledgerStore.set(fallbackId, {
        id: fallbackId,
        bankLineId: parsed.bankLine.id,
        policyHash: evaluated.policyHash,
        allocations: evaluated.allocations,
        explain: evaluated.explain,
        createdAt,
      });

      return {
        ledgerEntry: {
          id: fallbackId,
          bankLineId: parsed.bankLine.id,
          policyHash: evaluated.policyHash,
          allocations: evaluated.allocations,
          explain: evaluated.explain,
          createdAt: createdAt.toISOString(),
        },
        rpt,
      };
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "invalid_request" });
    }
  },
);

app.get(
  "/audit/rpt/:id",
  {
    schema: {
      params: auditParamsJsonSchema,
      response: { 200: auditResponseJsonSchema },
    },
  },
  async (req, rep) => {
    const parsed = auditParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_params" });
    }
    const rpt = await getRptToken(parsed.data.id);
    if (!rpt) {
      return rep.code(404).send({ error: "not_found" });
    }
    const valid = verifyRpt(rpt);
    const chainValid = await verifyChain(rpt.id);
    return { rpt, valid, chainValid };
  },
);

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

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
