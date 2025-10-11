import path from "node:path";

import cors from "@fastify/cors";
import Fastify from "fastify";
import dotenv from "dotenv";
import { z } from "zod";
import { prisma, seedDemoData } from "@apgms/shared";

type RawBankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: { toNumber(): number };
  payee: string;
  desc: string;
  createdAt: Date;
};

type SerializableBankLine = {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
  createdAt: string;
};

type SerializableUser = {
  email: string;
  orgId: string;
  createdAt: string;
};

const envFiles = [
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), ".env"),
];
for (const file of envFiles) {
  dotenv.config({ path: file });
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().optional(),
});

const env = envSchema.parse(process.env);

const serializeBankLine = (line: RawBankLine): SerializableBankLine => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  createdAt: line.createdAt.toISOString(),
  amount: line.amount.toNumber(),
  payee: line.payee,
  desc: line.desc,
});

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/users", async () => {
  const users = (await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })) as Array<{ email: string; orgId: string; createdAt: Date }>;

  const serialized: SerializableUser[] = users.map((user) => ({
    email: user.email,
    orgId: user.orgId,
    createdAt: user.createdAt.toISOString(),
  }));

  return { users: serialized };
});

app.get("/bank-lines", async (request) => {
  const querySchema = z.object({
    take: z.coerce.number().int().positive().max(200).default(20),
  });
  const query = querySchema.parse(request.query);

  const lines = (await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: query.take,
  })) as RawBankLine[];

  return { lines: lines.map(serializeBankLine) };
});

app.post("/bank-lines", async (request, reply) => {
  const bodySchema = z.object({
    orgId: z.string().min(1),
    date: z.string().transform((value) => new Date(value)),
    amount: z.coerce.number(),
    payee: z.string().min(1),
    desc: z.string().min(1),
  });

  const body = bodySchema.parse(request.body);

  const created = (await prisma.bankLine.create({
    data: {
      orgId: body.orgId,
      date: body.date,
      amount: body.amount,
      payee: body.payee,
      desc: body.desc,
    },
  })) as RawBankLine;

  return reply.code(201).send(serializeBankLine(created));
});

await seedDemoData();

const port = env.PORT;
const host = env.HOST ?? "0.0.0.0";

app.addHook("onReady", () => {
  app.log.info(app.printRoutes());
});

app
  .listen({ port, host })
  .then(() => {
    app.log.info(
      { port, host, databaseUrl: env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@") },
      "api-gateway listening",
    );
  })
  .catch((error) => {
    app.log.error(error, "failed to start api-gateway");
    process.exitCode = 1;
  });
