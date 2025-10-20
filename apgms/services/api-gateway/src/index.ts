import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  bankLineCreateSchema,
  bankLineEntitySchema,
  bankLineListResponseSchema,
  bankLineQuerySchema,
  serializeBankLine,
} from "./validation";

type PrismaClientLike = {
  user: {
    findMany: (args: any) => Promise<any>;
  };
  bankLine: {
    findMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
};

const loadPrisma = async (): Promise<PrismaClientLike> => {
  const module = await import("../../../shared/src/db");
  return module.prisma as PrismaClientLike;
};

export const createApp = async (deps?: { prisma?: PrismaClientLike }) => {
  const db = deps?.prisma ?? (await loadPrisma());
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async () => {
    const users = await db.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req, rep) => {
    const parsedQuery = bankLineQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      return rep.code(400).send({
        error: "validation_error",
        issues: parsedQuery.error.issues,
      });
    }

    const take = parsedQuery.data.take ?? 20;
    const lines = await db.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    let serializedLines;
    try {
      serializedLines = lines.map((line) => serializeBankLine(line));
    } catch (error) {
      req.log.error({ err: error }, "failed to serialize bank lines");
      return rep.code(500).send({ error: "response_serialization_failed" });
    }
    const responsePayload = {
      lines: serializedLines,
    };
    const responseValidation = bankLineListResponseSchema.safeParse(responsePayload);
    if (!responseValidation.success) {
      req.log.error(
        { issues: responseValidation.error.issues },
        "bank line list response validation failed",
      );
      return rep.code(500).send({ error: "response_validation_failed" });
    }

    return responseValidation.data;
  });

  // Create a bank line
  app.post("/bank-lines", async (req, rep) => {
    const parsedBody = bankLineCreateSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return rep.code(400).send({
        error: "validation_error",
        issues: parsedBody.error.issues,
      });
    }

    try {
      const created = await db.bankLine.create({
        data: {
          orgId: parsedBody.data.orgId,
          date: parsedBody.data.date,
          amount: parsedBody.data.amount,
          payee: parsedBody.data.payee,
          desc: parsedBody.data.desc,
        },
      });
      let serialized;
      try {
        serialized = serializeBankLine(created);
      } catch (error) {
        req.log.error({ err: error }, "failed to serialize created bank line");
        return rep.code(500).send({ error: "response_serialization_failed" });
      }
      const responseValidation = bankLineEntitySchema.safeParse(serialized);
      if (!responseValidation.success) {
        req.log.error(
          { issues: responseValidation.error.issues },
          "bank line create response validation failed",
        );
        return rep.code(500).send({ error: "response_validation_failed" });
      }
      return rep.code(201).send(responseValidation.data);
    } catch (e) {
      req.log.error(e);
      return rep.code(500).send({ error: "bank_line_create_failed" });
    }
  });

  if (process.env.NODE_ENV !== "test") {
    app.ready(() => {
      app.log.info(app.printRoutes());
    });
  }

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
