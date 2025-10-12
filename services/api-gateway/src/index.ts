// --- load ../../../../.env (repo root) from src ---
// src = apgms/services/api-gateway/src
// repo root .env = apgms/.env  ==> go up three levels
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { prisma } from "../../../shared/src/db";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const tags = {
  system: "System",
  users: "Users",
  bankLines: "Bank Lines",
} as const;

const healthResponseSchema = registry.register(
  "HealthResponse",
  z.object({
    ok: z.literal(true),
    service: z.literal("api-gateway"),
  }),
);

const errorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    error: z.string(),
  }),
);

const userSummarySchema = registry.register(
  "UserSummary",
  z.object({
    email: z.string().email(),
    orgId: z.string(),
    createdAt: z.string().datetime(),
  }),
);

const usersResponseSchema = registry.register(
  "UsersResponse",
  z.object({
    users: z.array(userSummarySchema),
  }),
);

const bankLineSchema = registry.register(
  "BankLine",
  z.object({
    id: z.string(),
    orgId: z.string(),
    date: z.string().datetime(),
    amount: z.string(),
    payee: z.string(),
    desc: z.string(),
    createdAt: z.string().datetime(),
  }),
);

const bankLinesResponseSchema = registry.register(
  "BankLinesResponse",
  z.object({
    lines: z.array(bankLineSchema),
  }),
);

const bankLinesQuerySchema = registry.register(
  "BankLinesQuery",
  z.object({
    take: z.coerce.number().int().min(1).max(200).optional(),
  }),
);

const createBankLineBodySchema = registry.register(
  "CreateBankLineBody",
  z.object({
    orgId: z.string(),
    date: z.string().datetime(),
    amount: z.union([z.number(), z.string()]),
    payee: z.string().min(1),
    desc: z.string().min(1),
  }),
);

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Service health check",
  tags: [tags.system],
  responses: {
    200: {
      description: "Service health information",
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/users",
  summary: "List users",
  tags: [tags.users],
  responses: {
    200: {
      description: "List of users",
      content: {
        "application/json": {
          schema: usersResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/bank-lines",
  summary: "List bank feed lines",
  tags: [tags.bankLines],
  request: {
    query: bankLinesQuerySchema,
  },
  responses: {
    200: {
      description: "Bank feed lines",
      content: {
        "application/json": {
          schema: bankLinesResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/bank-lines",
  summary: "Create a bank feed line",
  tags: [tags.bankLines],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createBankLineBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created bank feed line",
      content: {
        "application/json": {
          schema: bankLineSchema,
        },
      },
    },
    400: {
      description: "Invalid payload",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, { origin: true });

// Quick sanity log so you can verify the DSN being used
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get(
  "/health",
  {
    schema: {
      summary: "Service health check",
      tags: [tags.system],
      response: {
        200: healthResponseSchema,
      },
    },
  },
  async () => ({ ok: true, service: "api-gateway" }),
);

app.get(
  "/users",
  {
    schema: {
      summary: "List users",
      tags: [tags.users],
      response: {
        200: usersResponseSchema,
      },
    },
  },
  async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  },
);

app.get(
  "/bank-lines",
  {
    schema: {
      summary: "List bank feed lines",
      tags: [tags.bankLines],
      querystring: bankLinesQuerySchema,
      response: {
        200: bankLinesResponseSchema,
      },
    },
  },
  async (request) => {
    const take = request.query.take ?? 20;
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });
    return { lines };
  },
);

app.post(
  "/bank-lines",
  {
    schema: {
      summary: "Create a bank feed line",
      tags: [tags.bankLines],
      body: createBankLineBodySchema,
      response: {
        201: bankLineSchema,
        400: errorResponseSchema,
      },
    },
  },
  async (request, reply) => {
    try {
      const body = request.body;
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return reply.code(201).send(created);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "bad_request" });
    }
  },
);

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

if (process.env.NODE_ENV !== "production") {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "API Gateway",
      version: "0.1.0",
    },
    servers: [{ url: `http://localhost:${port}` }],
    tags: Object.values(tags).map((name) => ({ name })),
  });

  await app.register(swagger, {
    mode: "static",
    specification: {
      document,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}

// Print all routes once ready (to verify POST exists)
app.ready(() => {
  app.log.info(app.printRoutes());
});

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
