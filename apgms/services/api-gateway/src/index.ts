import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";
import { matchRule } from "./rules";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const bankLineCreateSchema = z.object({
  orgId: z.string(),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().trim().min(1),
  desc: z.string().trim().min(1),
  category: z.string().trim().min(1).max(64).optional(),
});

const ruleCreateSchema = z.object({
  orgId: z.string(),
  name: z.string().trim().min(1),
  payeeRegex: z.union([z.string(), z.literal(null)]).optional(),
  minAmount: z.union([z.coerce.number(), z.literal(null)]).optional(),
  maxAmount: z.union([z.coerce.number(), z.literal(null)]).optional(),
  containsDesc: z.union([z.string(), z.literal(null)]).optional(),
  setCategory: z.string().trim().min(1).max(64),
});

const ruleUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  payeeRegex: z.union([z.string(), z.literal(null)]).optional(),
  minAmount: z.union([z.coerce.number(), z.literal(null)]).optional(),
  maxAmount: z.union([z.coerce.number(), z.literal(null)]).optional(),
  containsDesc: z.union([z.string(), z.literal(null)]).optional(),
  setCategory: z.string().trim().min(1).max(64).optional(),
});

const applyRulesSchema = z.object({
  orgId: z.string(),
});

type RuleCreateInput = z.infer<typeof ruleCreateSchema>;
type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;

type NormalizedRuleInput<T> = T & {
  payeeRegex?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  containsDesc?: string | null;
};

function normalizeRuleInput<T extends RuleCreateInput | RuleUpdateInput>(
  payload: T,
): NormalizedRuleInput<T> {
  const normalized: any = { ...payload };

  if (Object.prototype.hasOwnProperty.call(normalized, "payeeRegex")) {
    const value = normalized.payeeRegex;
    if (value === undefined) {
      // leave as undefined
    } else if (value === null) {
      normalized.payeeRegex = null;
    } else {
      const trimmed = value.trim();
      if (!trimmed) {
        normalized.payeeRegex = null;
      } else {
        try {
          new RegExp(trimmed);
          normalized.payeeRegex = trimmed;
        } catch {
          throw new Error("Invalid payeeRegex");
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "containsDesc")) {
    const value = normalized.containsDesc;
    if (value === undefined) {
      // leave as undefined
    } else if (value === null) {
      normalized.containsDesc = null;
    } else {
      const trimmed = value.trim();
      normalized.containsDesc = trimmed.length === 0 ? null : trimmed;
    }
  }

  const normalizeAmount = (value: unknown) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error("Amount must be finite");
    }
    return num;
  };

  if (Object.prototype.hasOwnProperty.call(normalized, "minAmount")) {
    normalized.minAmount = normalizeAmount(normalized.minAmount);
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "maxAmount")) {
    normalized.maxAmount = normalizeAmount(normalized.maxAmount);
  }

  const minAmount = normalized.minAmount;
  const maxAmount = normalized.maxAmount;
  if (
    minAmount !== undefined &&
    minAmount !== null &&
    maxAmount !== undefined &&
    maxAmount !== null &&
    maxAmount < minAmount
  ) {
    throw new Error("maxAmount must be greater than or equal to minAmount");
  }

  return normalized;
}

function mapToRulePrismaData(
  input: NormalizedRuleInput<Partial<RuleCreateInput & RuleUpdateInput>>,
) {
  const data: any = {};
  if (Object.prototype.hasOwnProperty.call(input, "orgId") && input.orgId !== undefined) {
    data.orgId = input.orgId;
  }
  if (Object.prototype.hasOwnProperty.call(input, "name") && input.name !== undefined) {
    data.name = input.name;
  }
  if (Object.prototype.hasOwnProperty.call(input, "payeeRegex")) {
    data.payeeRegex = input.payeeRegex ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "containsDesc")) {
    data.containsDesc = input.containsDesc ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "setCategory") && input.setCategory !== undefined) {
    data.setCategory = input.setCategory;
  }
  if (Object.prototype.hasOwnProperty.call(input, "minAmount")) {
    const value = input.minAmount;
    if (value === undefined) {
      // skip - undefined means omit
    } else if (value === null) {
      data.minAmount = null;
    } else {
      data.minAmount = new Prisma.Decimal(value);
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "maxAmount")) {
    const value = input.maxAmount;
    if (value === undefined) {
      // skip
    } else if (value === null) {
      data.maxAmount = null;
    } else {
      data.maxAmount = new Prisma.Decimal(value);
    }
  }
  return data;
}

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
    const parsed = bankLineCreateSchema.parse(req.body ?? {});
    const created = await prisma.bankLine.create({
      data: {
        orgId: parsed.orgId,
        date: parsed.date,
        amount: new Prisma.Decimal(parsed.amount),
        payee: parsed.payee,
        desc: parsed.desc,
        category: parsed.category,
      },
    });
    return rep.code(201).send(created);
  } catch (e: any) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request", message: e.message ?? "invalid payload" });
  }
});

// Rules CRUD
app.get("/rules", async (req, rep) => {
  const orgId = (req.query as any).orgId;
  if (!orgId || typeof orgId !== "string") {
    return rep.code(400).send({ error: "bad_request", message: "orgId query param required" });
  }
  const rules = await prisma.rule.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
  return { rules };
});

app.post("/rules", async (req, rep) => {
  try {
    const parsed = normalizeRuleInput(ruleCreateSchema.parse(req.body ?? {}));
    const created = await prisma.rule.create({
      data: mapToRulePrismaData(parsed),
    });
    return rep.code(201).send(created);
  } catch (e: any) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request", message: e.message ?? "invalid payload" });
  }
});

app.put("/rules/:id", async (req, rep) => {
  const params = req.params as { id: string };
  try {
    const parsed = normalizeRuleInput(ruleUpdateSchema.parse(req.body ?? {}));
    const data = mapToRulePrismaData(parsed);
    if (Object.keys(data).length === 0) {
      return rep.code(400).send({ error: "bad_request", message: "no fields to update" });
    }
    const updated = await prisma.rule.update({
      where: { id: params.id },
      data,
    });
    return updated;
  } catch (e: any) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request", message: e.message ?? "invalid payload" });
  }
});

app.delete("/rules/:id", async (req, rep) => {
  const params = req.params as { id: string };
  await prisma.rule.delete({ where: { id: params.id } });
  return rep.code(204).send();
});

app.post("/rules/apply", async (req, rep) => {
  try {
    const parsed = applyRulesSchema.parse(req.body ?? {});
    const [rules, lines] = await Promise.all([
      prisma.rule.findMany({ where: { orgId: parsed.orgId }, orderBy: { createdAt: "asc" } }),
      prisma.bankLine.findMany({ where: { orgId: parsed.orgId, category: null } }),
    ]);

    const updates: { id: string; category: string }[] = [];
    for (const line of lines) {
      for (const rule of rules) {
        const matches = matchRule(
          { amount: line.amount.toNumber(), payee: line.payee, desc: line.desc },
          {
            payeeRegex: rule.payeeRegex,
            minAmount: rule.minAmount?.toNumber(),
            maxAmount: rule.maxAmount?.toNumber(),
            containsDesc: rule.containsDesc,
          },
        );
        if (matches) {
          updates.push({ id: line.id, category: rule.setCategory });
          break;
        }
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((update) =>
          prisma.bankLine.update({ where: { id: update.id }, data: { category: update.category } }),
        ),
      );
    }

    return { updated: updates.length };
  } catch (e: any) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request", message: e.message ?? "invalid payload" });
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
