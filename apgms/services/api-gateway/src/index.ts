import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { getSigner, loadKeyMaterial, rotateKey } from "./kms";

const ADMIN_ROLES_HEADER = "x-actor-roles";

function requestHasAdminRole(request: FastifyRequest): boolean {
  const header = request.headers[ADMIN_ROLES_HEADER];
  if (!header) {
    return false;
  }
  const raw = Array.isArray(header) ? header.join(",") : header;
  return raw
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)
    .includes("admin");
}

async function ensureAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (requestHasAdminRole(request)) {
    return true;
  }
  await reply.code(403).send({ error: "forbidden" });
  return false;
}

export interface PrismaLike {
  user: { findMany(args: unknown): Promise<any[]> };
  bankLine: {
    findMany(args: unknown): Promise<any[]>;
    create(args: unknown): Promise<any>;
  };
}

export interface BuildAppOptions {
  logger?: boolean;
  prisma?: PrismaLike;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, { origin: true });

  const prisma: PrismaLike =
    options.prisma ?? ((await import("../../../shared/src/db")).prisma as PrismaLike);

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
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

  app.post("/admin/keys/rotate", async (req, rep) => {
    if (!(await ensureAdmin(req, rep))) {
      return;
    }
    const body = req.body as { alias?: string } | undefined;
    if (!body?.alias) {
      return rep.code(400).send({ error: "invalid_alias" });
    }
    const material = await rotateKey(body.alias);
    return rep.send({ alias: material.alias, version: material.version, publicKey: material.publicKey });
  });

  app.get("/admin/keys/:alias/pub", async (req, rep) => {
    if (!(await ensureAdmin(req, rep))) {
      return;
    }
    const params = req.params as { alias: string };
    const query = req.query as { version?: string };
    const version = query.version === undefined ? undefined : Number(query.version);
    if (query.version !== undefined && Number.isNaN(version)) {
      return rep.code(400).send({ error: "invalid_version" });
    }
    const material = await loadKeyMaterial(params.alias, version);
    if (!material) {
      return rep.code(404).send({ error: "not_found" });
    }
    return rep.send({ alias: material.alias, version: material.version, publicKey: material.publicKey });
  });

  app.addHook("onReady", async () => {
    app.log.info(app.printRoutes());
    await getSigner("rpt");
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMain = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
})();

if (isMain) {
  start();
}
