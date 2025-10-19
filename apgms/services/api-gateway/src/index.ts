import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db.js";
import {
  BankLineCreate,
  BankLineOut,
  type BankLineOutput,
} from "../../../shared/src/schemas/bankLine.js";
import { PageMeta, PageQuery } from "../../../shared/src/schemas/pagination.js";
import { z, ZodError } from "zod";
import openapiPlugin from "./plugins/openapi.js";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "./lib/zodTypeProvider.js";

const UserOut = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string().datetime(),
});

const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.literal("api-gateway"),
});

type SerializableBankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: { toString(): string };
  payee: string;
  desc: string;
  createdAt: Date;
};

function mapBankLine(line: SerializableBankLine): BankLineOutput {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: line.amount.toString(),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

export async function buildApp() {
  const baseApp = Fastify({ logger: true });
  baseApp.setValidatorCompiler(validatorCompiler as any);
  baseApp.setSerializerCompiler(serializerCompiler as any);

  baseApp.setErrorHandler((error, request, reply) => {
    const cause = (error as { cause?: unknown }).cause;
    const zodError =
      error instanceof ZodError
        ? error
        : cause instanceof ZodError
          ? cause
          : undefined;

    if (zodError) {
      request.log.warn({ issues: zodError.issues }, "validation error");
      return reply.status(422).send({
        statusCode: 422,
        error: "Unprocessable Entity",
        message: "Validation failed",
        issues: zodError.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    request.log.error(error);
    return reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name ?? "Internal Server Error",
      message: error.message,
    });
  });

  const app = baseApp.withTypeProvider<ZodTypeProvider>();

  await app.register(cors, { origin: true });
  await openapiPlugin(app);

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get(
    "/openapi.json",
    { config: { hide: true } },
    async (_, reply) => reply.type("application/json").send(app.swagger()),
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        response: {
          200: HealthResponse,
        },
      },
    },
    async () => ({ ok: true as const, service: "api-gateway" as const }),
  );

  app.get(
    "/users",
    {
      schema: {
        tags: ["Users"],
        summary: "List users",
        response: {
          200: z.object({ users: z.array(UserOut) }),
        },
      },
    },
    async () => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      type UserRecord = (typeof users)[number];

      return {
        users: users.map((user: UserRecord): z.infer<typeof UserOut> => ({
          email: user.email,
          orgId: user.orgId,
          createdAt: user.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    "/bank-lines",
    {
      schema: {
        tags: ["BankLines"],
        summary: "List bank lines",
        querystring: PageQuery,
        response: {
          200: z.object({
            data: z.array(BankLineOut),
            meta: PageMeta,
          }),
        },
      },
    },
    async (req) => {
      const query = PageQuery.parse(req.query);
      const { take } = query;

      const lines = await prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take,
      });

      const data = lines.map(mapBankLine);
      return {
        data,
        meta: {
          take,
          returned: data.length,
          nextCursor: data.at(-1)?.id ?? null,
          hasMore: data.length === take,
        },
      };
    },
  );

  app.post(
    "/bank-lines",
    {
      schema: {
        tags: ["BankLines"],
        summary: "Create a bank line",
        body: BankLineCreate,
        response: {
          201: BankLineOut,
        },
      },
    },
    async (req, reply) => {
      const body = BankLineCreate.parse(req.body);

      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: body.date,
          amount: body.amount,
          payee: body.payee,
          desc: body.desc,
        },
      });

      const payload = mapBankLine(created);
      return reply.code(201).send(payload);
    },
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
