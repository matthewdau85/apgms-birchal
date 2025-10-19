import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
<<<<<<< HEAD
import piiSchema from "./schemas/pii.schema.json" assert { type: "json" };
import {
  configurePIIProviders,
  encryptPII,
  registerPIIRoutes,
  tokenizeTFN,
  type KeyManagementService,
  type TokenSaltProvider,
  type AuditLogger,
} from "./lib/pii";
import { isValidABN, normalizeAbn } from "@apgms/shared-au/abn";
import { isValidTFN } from "@apgms/shared-au/tfn";
=======
import { registerAdminDataRoutes } from "./routes/admin.data";
>>>>>>> origin/codex/add-admin-gated-subject-data-delete-endpoint

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
app.addSchema(piiSchema);

const keyId = process.env.PII_KEY_ID ?? "local-default";
const keyMaterialEnv = process.env.PII_KEY_MATERIAL;
const keyMaterial = (() => {
  if (keyMaterialEnv) {
    const buffer = Buffer.from(keyMaterialEnv, "base64");
    if (buffer.length === 32) {
      return buffer;
    }
  }
  return randomBytes(32);
})();

const kms: KeyManagementService = {
  getActiveKey: () => ({ kid: keyId, material: keyMaterial }),
  getKeyById: (kid: string) => (kid === keyId ? { kid, material: keyMaterial } : undefined),
};

const saltId = process.env.TFN_SALT_ID ?? "local-1";
const saltSecretEnv = process.env.TFN_SALT_SECRET;
const saltSecret = (() => {
  if (saltSecretEnv) {
    const buffer = Buffer.from(saltSecretEnv, "base64");
    if (buffer.length > 0) {
      return buffer;
    }
  }
  return randomBytes(32);
})();

const saltProvider: TokenSaltProvider = {
  getActiveSalt: () => ({ sid: saltId, secret: saltSecret }),
  getSaltById: (id: string) => (id === saltId ? { sid: saltId, secret: saltSecret } : undefined),
};

const auditLogger: AuditLogger = {
  record: async (event) => {
    app.log.info({ audit: { actorId: event.actorId, action: event.action, metadata: event.metadata } }, "audit_event");
  },
};

configurePIIProviders({ kms, saltProvider, auditLogger });

const adminGuard = (request: FastifyRequest): { allowed: boolean; actorId: string } => {
  const isAdmin = request.headers["x-admin"] === "true";
  const actorId = String(request.headers["x-actor-id"] ?? "unknown");
  return { allowed: Boolean(isAdmin), actorId };
};

registerPIIRoutes(app, adminGuard);

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.post(
  "/pii",
  {
    schema: {
      body: {
        type: "object",
        required: ["abn", "tfn"],
        additionalProperties: false,
        properties: {
          abn: { type: "string" },
          tfn: { type: "string" },
          payload: { type: "string" },
        },
      },
      response: {
        201: { $ref: "https://apgms.example.com/schemas/pii.schema.json" },
      },
    },
  },
  async (request, reply) => {
    const body = request.body as { abn: string; tfn: string; payload?: string };
    if (!isValidABN(body.abn)) {
      return reply.code(400).send({ error: "invalid_abn" });
    }
    if (!isValidTFN(body.tfn)) {
      return reply.code(400).send({ error: "invalid_tfn" });
    }

    const abn = normalizeAbn(body.abn);
    const tfnToken = tokenizeTFN(body.tfn);
    const secret = encryptPII(body.payload ?? "");

    return reply.code(201).send({ abn, tfnToken, secret });
  },
);

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

await registerAdminDataRoutes(app);

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
