import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z, ZodError } from "zod";
import { prisma } from "../../../shared/src/db";
import { AuditLogWriter, PrismaAuditEventRepository } from "./audit-log";
import { ManifestChain, PrismaManifestRepository } from "./manifest-chain";
import { PrismaRptRepository, RptService } from "./rpt-service";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const auditLogWriter = new AuditLogWriter(
  new PrismaAuditEventRepository(prisma),
);
const manifestChain = new ManifestChain(new PrismaManifestRepository(prisma));
const rptService = new RptService({
  manifestChain,
  auditLog: auditLogWriter,
  repository: new PrismaRptRepository(prisma),
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

const mintSchema = z.object({
  orgId: z.string().min(1),
  period: z.string().min(1),
  actor: z.string().min(1),
  manifest: z
    .object({})
    .catchall(z.unknown())
    .default({}),
});

app.post("/rpt/mint", async (req, rep) => {
  try {
    const body = mintSchema.parse(req.body ?? {});
    const result = await rptService.mint({
      orgId: body.orgId,
      period: body.period,
      actor: body.actor,
      payload: body.manifest as Record<string, unknown>,
    });
    return rep.code(201).send({
      token: result.token,
      manifest: {
        id: result.manifest.id,
        orgId: result.manifest.orgId,
        period: result.manifest.period,
        sequence: result.manifest.sequence,
        digest: result.manifest.digest,
        prevDigest: result.manifest.prevDigest,
        createdAt: result.manifest.createdAt.toISOString(),
        payload: result.manifest.payload,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return rep.status(400).send({
        error: "validation_error",
        issues: err.format(),
      });
    }
    req.log.error(err);
    return rep.status(500).send({ error: "internal_error" });
  }
});

const verifySchema = z.object({ token: z.string().min(1) });

app.post("/rpt/verify", async (req, rep) => {
  try {
    const body = verifySchema.parse(req.body ?? {});
    const result = await rptService.verify({ token: body.token });
    if (!result.valid) {
      return rep.status(200).send({
        valid: false,
        reason: result.reason,
        revokedAt: result.revokedAt?.toISOString(),
        revokedReason: result.revokedReason ?? undefined,
      });
    }
    return rep.status(200).send({
      valid: true,
      orgId: result.orgId,
      period: result.period,
      manifestDigest: result.manifestDigest,
      mintedAt: result.mintedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return rep.status(400).send({
        error: "validation_error",
        issues: err.format(),
      });
    }
    req.log.error(err);
    return rep.status(500).send({ error: "internal_error" });
  }
});

const revokeSchema = z.object({
  token: z.string().min(1),
  actor: z.string().min(1),
  reason: z.string().max(512).optional(),
});

app.post("/rpt/revoke", async (req, rep) => {
  try {
    const body = revokeSchema.parse(req.body ?? {});
    const result = await rptService.revoke({
      token: body.token,
      actor: body.actor,
      reason: body.reason,
    });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return rep.status(404).send({ error: "not_found" });
      }
      return rep.status(409).send({
        error: "already_revoked",
        revokedAt: result.revokedAt?.toISOString(),
      });
    }
    return rep.status(200).send({
      ok: true,
      revokedAt: result.revokedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return rep.status(400).send({
        error: "validation_error",
        issues: err.format(),
      });
    }
    req.log.error(err);
    return rep.status(500).send({ error: "internal_error" });
  }
});

app.get("/manifests/:orgId/:period", async (req, rep) => {
  try {
    const paramsSchema = z.object({
      orgId: z.string().min(1),
      period: z.string().min(1),
    });
    const params = paramsSchema.parse(req.params ?? {});
    const chain = await manifestChain.getChain(params.orgId, params.period);
    return rep.status(200).send({
      chain: chain.map((entry) => ({
        id: entry.id,
        sequence: entry.sequence,
        digest: entry.digest,
        prevDigest: entry.prevDigest,
        createdAt: entry.createdAt.toISOString(),
        payload: entry.payload,
      })),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return rep.status(400).send({
        error: "validation_error",
        issues: err.format(),
      });
    }
    req.log.error(err);
    return rep.status(500).send({ error: "internal_error" });
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

