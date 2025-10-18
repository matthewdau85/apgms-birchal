import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  bankLinesCollectionJsonSchema,
  bankLinesCollectionSchema,
  bankLineSchema,
  createBankLineBodyJsonSchema,
  createBankLineBodySchema,
  createBankLineResponseJsonSchema,
  createBankLineResponseSchema,
  getBankLinesQueryJsonSchema,
  getBankLinesQuerySchema,
} from "../schemas/bank-lines";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

const idempotencyHeaderSchema = {
  type: "object",
  required: ["idempotency-key"],
  properties: {
    "idempotency-key": {
      type: "string",
      minLength: 1,
      maxLength: 255,
      description: "Unique key to guarantee idempotent POST requests",
    },
  },
} as const;

type CursorPayload = {
  date: string;
  id: string;
};

const encodeCursor = (payload: CursorPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodeCursor = (cursor: string): CursorPayload => {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as CursorPayload;
    if (typeof parsed?.date !== "string" || typeof parsed?.id !== "string") {
      throw new Error("Invalid cursor shape");
    }
    return parsed;
  } catch (err) {
    throw new Error("Invalid cursor");
  }
};

const decimalToString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof (value as { toString(): string }).toString === "function") {
    return (value as { toString(): string }).toString();
  }
  throw new Error("Unsupported decimal value");
};

const decimalToCents = (amount: unknown): number => {
  const normalized = decimalToString(amount).trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error("Invalid decimal representation");
  }
  const [, sign, wholePart, fractionalPart = ""] = match;
  const fraction = fractionalPart.padEnd(2, "0");
  if (fractionalPart.length > 2 && /[1-9]/.test(fractionalPart.slice(2))) {
    throw new Error("Decimal precision greater than 2 is not supported");
  }

  const centsBigInt = BigInt(wholePart) * 100n + BigInt(fraction.slice(0, 2));
  const signed = sign === "-" ? -centsBigInt : centsBigInt;
  const cents = Number(signed);
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Amount cannot be represented as safe integer");
  }
  return cents;
};

const centsToDecimalString = (amountCents: number): string => {
  const centsBig = BigInt(amountCents);
  const sign = centsBig < 0 ? "-" : "";
  const absolute = centsBig < 0 ? -centsBig : centsBig;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
};

const serializeBankLine = (line: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
}) => {
  const json = {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amountCents: decimalToCents(line.amount),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
  return bankLineSchema.parse(json);
};

const buildPaginationFilter = (cursor?: string) => {
  if (!cursor) {
    return {};
  }

  const decoded = decodeCursor(cursor);
  const cursorDate = new Date(decoded.date);
  if (Number.isNaN(cursorDate.getTime())) {
    throw new Error("Invalid cursor");
  }

  return {
    OR: [
      { date: { lt: cursorDate } },
      {
        AND: [
          { date: { equals: cursorDate } },
          { id: { lt: decoded.id } },
        ],
      },
    ],
  };
};

type BankLineDelegate = {
  findMany: (...args: any[]) => Promise<any>;
  findUnique: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
};

export type BankLineRouteDeps = {
  prisma: {
    bankLine: BankLineDelegate;
  };
};

export const createBankLinesRoutes = (
  deps: BankLineRouteDeps
): FastifyPluginAsync => {
  const prismaClient = deps.prisma;

  const plugin: FastifyPluginAsync = async (app) => {
  app.get(
    "/bank-lines",
    {
      schema: {
        tags: ["BankLines"],
        description: "List bank lines for an organisation using cursor pagination",
        querystring: getBankLinesQueryJsonSchema,
        response: {
          200: bankLinesCollectionJsonSchema,
        },
      },
    },
    async (req, rep) => {
      const parsedQuery = getBankLinesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return rep.code(400).send({
          error: "invalid_query",
          details: parsedQuery.error.format(),
        });
      }

      const { orgId, cursor, limit } = parsedQuery.data;

      let resolvedLimit: number | undefined;
      if (typeof limit !== "undefined") {
        const numericLimit = typeof limit === "string" ? Number(limit) : limit;
        if (!Number.isFinite(numericLimit) || !Number.isInteger(numericLimit)) {
          return rep.code(400).send({ error: "invalid_limit" });
        }
        if (numericLimit < 1 || numericLimit > MAX_LIMIT) {
          return rep.code(400).send({ error: "invalid_limit" });
        }
        resolvedLimit = numericLimit;
      }

      let paginationFilter = {};
      try {
        paginationFilter = buildPaginationFilter(cursor);
      } catch (err) {
        return rep.code(400).send({ error: "invalid_cursor" });
      }

      const take = resolvedLimit ?? DEFAULT_LIMIT;

      const lines = await prismaClient.bankLine.findMany({
        where: {
          orgId,
          ...paginationFilter,
        },
        orderBy: [
          { date: "desc" },
          { id: "desc" },
        ],
        take,
      });

      const serialized = lines.map(serializeBankLine);
      const nextCursor =
        serialized.length === take
          ? encodeCursor({
              date: serialized[serialized.length - 1].date,
              id: serialized[serialized.length - 1].id,
            })
          : undefined;

      const responsePayload = bankLinesCollectionSchema.parse({
        bankLines: serialized,
        nextCursor,
      });

      return responsePayload;
    }
  );

  app.post(
    "/bank-lines",
    {
      schema: {
        tags: ["BankLines"],
        description: "Create a bank line entry",
        headers: idempotencyHeaderSchema,
        body: createBankLineBodyJsonSchema,
        response: {
          200: createBankLineResponseJsonSchema,
          201: createBankLineResponseJsonSchema,
        },
      },
    },
    async (req, rep) => {
      const idempotencyKey = req.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
        return rep.code(400).send({ error: "idempotency_key_required" });
      }

      const parsedBody = createBankLineBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return rep.code(400).send({
          error: "invalid_body",
          details: parsedBody.error.format(),
        });
      }

      const { orgId, date, amountCents, payee, desc } = parsedBody.data;

      const existing = await prismaClient.bankLine.findUnique({ where: { id: idempotencyKey } });
      if (existing) {
        const payload = createBankLineResponseSchema.parse({
          bankLine: serializeBankLine(existing),
          idempotencyReplayed: true,
        });
        return rep.code(200).send(payload);
      }

      const created = await prismaClient.bankLine.create({
        data: {
          id: idempotencyKey,
          orgId,
          date: new Date(date),
          amount: centsToDecimalString(amountCents),
          payee,
          desc,
        },
      });

      const payload = createBankLineResponseSchema.parse({
        bankLine: serializeBankLine(created),
        idempotencyReplayed: false,
      });
      return rep.code(201).send(payload);
    }
  );
  };

  return plugin;
};

export const registerBankLineRoutes = async (
  app: FastifyInstance,
  deps: BankLineRouteDeps
) => {
  await app.register(createBankLinesRoutes(deps));
};
