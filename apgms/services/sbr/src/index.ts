import path from "node:path";
import fs from "node:fs/promises";

import Fastify from "fastify";

import { buildEnvelope } from "./as4/envelope";
import { signCanonicalUserMessage } from "./as4/sign";
import { verifyNonRepudiation, writeReceiptArtifacts } from "./as4/receipt";

const ARTIFACT_BASE = path.join(process.cwd(), "tmp", "as4-artifacts");
const ADMIN_TOKEN = process.env.SBR_ADMIN_TOKEN ?? "dev-admin-token";
const ALLOWED_ARTIFACTS = new Set([
  "envelope.xml",
  "signature.bin",
  "receipt.xml",
  "receipt-verification.json",
  "digest.txt",
  "meta.json",
]);

const CONTENT_TYPES: Record<string, string> = {
  "envelope.xml": "application/xml",
  "receipt.xml": "application/xml",
  "signature.bin": "application/octet-stream",
  "digest.txt": "text/plain",
  "meta.json": "application/json",
  "receipt-verification.json": "application/json",
};

async function ensureArtifactsDir(messageId: string): Promise<string> {
  const safeMessageId = messageId.replace(/[^A-Za-z0-9:_-]/g, "_");
  const dir = path.join(ARTIFACT_BASE, safeMessageId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeArtifacts(
  dir: string,
  envelopeXml: string,
  digestHex: string,
  signature: Buffer,
  meta: Record<string, unknown>,
): Promise<void> {
  await Promise.all([
    fs.writeFile(path.join(dir, "envelope.xml"), envelopeXml, "utf8"),
    fs.writeFile(path.join(dir, "digest.txt"), `${digestHex}\n`, "utf8"),
    fs.writeFile(path.join(dir, "signature.bin"), signature),
    fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8"),
  ]);
}

const app = Fastify({ logger: true });

app.post("/sbr/send", async (req, rep) => {
  const body = req.body as {
    orgId?: string;
    docType?: string;
    payload?: string;
    service?: string;
    action?: string;
    receiverPartyId?: string;
    receiverRole?: string;
    messageId?: string;
    timestamp?: string;
  };

  if (!body?.orgId || !body?.docType || typeof body.payload !== "string") {
    return rep.code(400).send({ error: "invalid_request" });
  }

  const envelope = buildEnvelope({
    orgId: body.orgId,
    docType: body.docType,
    payload: body.payload,
    service: body.service,
    action: body.action,
    receiverPartyId: body.receiverPartyId,
    receiverRole: body.receiverRole,
    messageId: body.messageId,
    timestamp: body.timestamp,
  });

  const signature = signCanonicalUserMessage(envelope.userMessageCanonical);

  const dir = await ensureArtifactsDir(envelope.messageId);
  const meta = {
    messageId: envelope.messageId,
    timestamp: envelope.timestamp,
    orgId: body.orgId,
    docType: body.docType,
    receiverPartyId: envelope.receiverPartyId,
    receiverRole: envelope.receiverRole,
    service: envelope.service,
    action: envelope.action,
    digestHex: signature.digestHex,
    digestBase64: signature.digestBase64,
    signatureBase64: signature.signatureBase64,
    publicKeyPem: signature.publicKeyPem,
  };
  await writeArtifacts(dir, envelope.envelopeXml, signature.digestHex, signature.signature, meta);

  return rep.code(202).send({ messageId: envelope.messageId, timestamp: envelope.timestamp });
});

app.post("/sbr/receive-receipt", async (req, rep) => {
  const body = req.body as { messageId?: string; receiptXml?: string };
  if (!body?.messageId || typeof body.receiptXml !== "string") {
    return rep.code(400).send({ error: "invalid_request" });
  }

  const dir = await ensureArtifactsDir(body.messageId);
  const digestPath = path.join(dir, "digest.txt");
  let expectedDigest = "";
  try {
    expectedDigest = (await fs.readFile(digestPath, "utf8")).trim();
  } catch (err) {
    req.log.error(err);
    return rep.code(404).send({ error: "unknown_message" });
  }

  const verification = verifyNonRepudiation(body.receiptXml, expectedDigest);
  await writeReceiptArtifacts(dir, body.receiptXml, verification);

  const metaPath = path.join(dir, "meta.json");
  let meta: Record<string, unknown> = {};
  try {
    const metaRaw = await fs.readFile(metaPath, "utf8");
    meta = JSON.parse(metaRaw) as Record<string, unknown>;
  } catch (err) {
    req.log.warn({ err }, "meta missing for message");
  }

  meta.receiptDigestHex = verification.digestValue;
  meta.receiptVerified = verification.matches;
  meta.receiptVerifiedAt = new Date().toISOString();
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  return rep.send({ messageId: body.messageId, verified: verification.matches, digest: verification.digestValue });
});

app.get("/sbr/artifact/:messageId/:name", async (req, rep) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return rep.code(403).send({ error: "forbidden" });
  }

  const params = req.params as { messageId: string; name: string };
  if (!ALLOWED_ARTIFACTS.has(params.name)) {
    return rep.code(404).send({ error: "not_found" });
  }

  const dir = path.join(ARTIFACT_BASE, params.messageId.replace(/[^A-Za-z0-9:_-]/g, "_"));
  const filePath = path.join(dir, params.name);

  try {
    const data = await fs.readFile(filePath);
    const contentType = CONTENT_TYPES[params.name] ?? "application/octet-stream";
    return rep.type(contentType).send(data);
  } catch (err) {
    req.log.error({ err }, "failed to read artifact");
    return rep.code(404).send({ error: "not_found" });
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
