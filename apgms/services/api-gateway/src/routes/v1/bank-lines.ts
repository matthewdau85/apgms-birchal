import {
  claimIdempotencyKey,
  clearIdempotencyKey,
  getIdempotencyRecord,
  hashRequestBody,
  storeIdempotencySuccess,
  type IdempotencyKeyComponents,
} from "@apgms/shared/src/idempotency";
import type { Prisma, PrismaClient } from "@prisma/client";
import type Redis from "../../vendor/ioredis.js";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

function buildIdempotencyComponents(
  orgId: string,
  req: { method: string; routePath: string },
  bodyHash: string,
  key: string,
): IdempotencyKeyComponents {
  return {
    orgId,
    method: req.method.toUpperCase(),
    path: req.routePath,
    bodyHash,
    key,
  };
}

const amountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const raw = typeof value === "number" ? value.toString() : value;
    if (raw.trim().length === 0) {
      throw new Error("Amount is required");
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error("Invalid amount value");
    }
    return raw;
  });

const bankLineCreateSchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: amountSchema,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const updateSchema = z
  .object({
    date: z.coerce.date().optional(),
    amount: amountSchema.optional(),
    payee: z.string().min(1).optional(),
    desc: z.string().min(1).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

const listQuerySchema = z.object({
  orgId: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  payee: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const orgQuerySchema = z.object({ orgId: z.string().min(1) });

type CursorPayload = { date: string; id: string };

function encodeCursor(value: CursorPayload): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const parsed = JSON.parse(raw) as CursorPayload;
  if (!parsed?.date || !parsed?.id) {
    throw new Error("Invalid cursor");
  }
  return parsed;
}

interface BankLinesRoutesOptions {
  prisma?: PrismaClient;
  redis?: Redis;
}

let cachedSharedPrisma: PrismaClient | undefined;

async function resolvePrisma(opts: BankLinesRoutesOptions): Promise<PrismaClient> {
  if (opts.prisma) {
    return opts.prisma;
  }
  if (!cachedSharedPrisma) {
    const module = await import("@apgms/shared/src/db");
    cachedSharedPrisma = module.prisma as PrismaClient;
  }
  return cachedSharedPrisma;
}

const bankLinesRoutes: FastifyPluginAsync<BankLinesRoutesOptions> = async (fastify, opts) => {
  const prisma = await resolvePrisma(opts);
  const redis = opts.redis ?? (fastify as unknown as { redis?: Redis }).redis;

  if (!redis) {
    throw new Error("Redis client not available");
  }
  fastify.get("/bank-lines", async (req, rep) => {
    const { orgId, limit, cursor, dateFrom, dateTo, payee } = listQuerySchema.parse(req.query);

    const whereClauses: Prisma.BankLineWhereInput[] = [{ orgId }];

    if (dateFrom) {
      whereClauses.push({ date: { gte: dateFrom } });
    }
    if (dateTo) {
      whereClauses.push({ date: { lte: dateTo } });
    }
    if (payee) {
      whereClauses.push({ payee: { contains: payee, mode: "insensitive" } });
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      const cursorDate = new Date(decoded.date);
      if (Number.isNaN(cursorDate.getTime())) {
        return rep.status(400).send({ error: "invalid_cursor" });
      }

      whereClauses.push({
        OR: [
          { date: { lt: cursorDate } },
          {
            AND: [
              { date: { equals: cursorDate } },
              { id: { lte: decoded.id } },
            ],
          },
        ],
      });
    }

    const where: Prisma.BankLineWhereInput = { AND: whereClauses };

    const items = await prisma.bankLine.findMany({
      where,
      orderBy: [
        { date: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
    });

    let nextCursor: string | undefined;
    if (items.length > limit) {
      const next = items.pop();
      if (next) {
        nextCursor = encodeCursor({ date: next.date.toISOString(), id: next.id });
      }
    }

    return { items, nextCursor };
  });

  fastify.get("/bank-lines/:id", async (req, rep) => {
    const { id } = idParamSchema.parse(req.params);
    const { orgId } = orgQuerySchema.parse(req.query);

    const line = await prisma.bankLine.findFirst({
      where: { id, orgId },
    });

    if (!line) {
      return rep.status(404).send({ error: "not_found" });
    }

    return line;
  });

  fastify.post("/bank-lines", async (req, rep) => {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return rep.status(400).send({ error: "missing_idempotency_key" });
    }

    let parsedBody;
    try {
      parsedBody = bankLineCreateSchema.parse(req.body ?? {});
    } catch (err) {
      return rep.status(400).send({ error: "invalid_body", details: err });
    }

    const bodyHash = hashRequestBody(req.body ?? {});
    const keyComponents = buildIdempotencyComponents(
      parsedBody.orgId,
      { method: req.method, routePath: "/v1/bank-lines" },
      bodyHash,
      idempotencyKey,
    );

    const existingRecord = await getIdempotencyRecord(redis, keyComponents);
    if (existingRecord?.state === "completed") {
      if (existingRecord.headers) {
        for (const [headerName, value] of Object.entries(existingRecord.headers)) {
          rep.header(headerName, value);
        }
      }
      rep.header("idempotency-replayed", "true");
      return rep.status(existingRecord.statusCode).send(existingRecord.body);
    }

    if (!existingRecord) {
      const claimed = await claimIdempotencyKey(redis, keyComponents);
      if (!claimed) {
        const freshRecord = await getIdempotencyRecord(redis, keyComponents);
        if (freshRecord?.state === "completed") {
          if (freshRecord.headers) {
            for (const [headerName, value] of Object.entries(freshRecord.headers)) {
              rep.header(headerName, value);
            }
          }
          rep.header("idempotency-replayed", "true");
          return rep.status(freshRecord.statusCode).send(freshRecord.body);
        }

        return rep.status(409).send({ error: "request_in_progress" });
      }
    } else if (existingRecord.state === "pending") {
      return rep.status(409).send({ error: "request_in_progress" });
    }

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: parsedBody.orgId,
          date: parsedBody.date,
          amount: parsedBody.amount,
          payee: parsedBody.payee,
          desc: parsedBody.desc,
        },
      });

      const responsePayload = { statusCode: 201, body: created };
      await storeIdempotencySuccess(redis, keyComponents, responsePayload);

      return rep.status(201).send(created);
    } catch (err) {
      await clearIdempotencyKey(redis, keyComponents);
      req.log.error({ err }, "failed to create bank line");
      return rep.status(500).send({ error: "internal_error" });
    }
  });

  fastify.patch("/bank-lines/:id", async (req, rep) => {
    const { id } = idParamSchema.parse(req.params);
    const { orgId } = orgQuerySchema.parse(req.query);

    let updates: z.infer<typeof updateSchema>;
    try {
      updates = updateSchema.parse(req.body ?? {});
    } catch (err) {
      return rep.status(400).send({ error: "invalid_body", details: err });
    }

    const existing = await prisma.bankLine.findFirst({ where: { id, orgId } });
    if (!existing) {
      return rep.status(404).send({ error: "not_found" });
    }

    const data: Prisma.BankLineUpdateInput = {};
    if (updates.date) {
      data.date = updates.date;
    }
    if (updates.amount) {
      data.amount = updates.amount;
    }
    if (updates.payee) {
      data.payee = updates.payee;
    }
    if (updates.desc) {
      data.desc = updates.desc;
    }

    const updated = await prisma.bankLine.update({
      where: { id },
      data,
    });

    return updated;
  });

  fastify.delete("/bank-lines/:id", async (req, rep) => {
    const { id } = idParamSchema.parse(req.params);
    const { orgId } = orgQuerySchema.parse(req.query);

    const existing = await prisma.bankLine.findFirst({ where: { id, orgId } });
    if (!existing) {
      return rep.status(404).send({ error: "not_found" });
    }

    await prisma.bankLine.delete({ where: { id } });

    return rep.status(204).send();
  });
};

export default bankLinesRoutes;
