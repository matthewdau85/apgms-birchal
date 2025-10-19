import { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/src/db";
import { getConnector } from "../connectors";
import { enqueueSyncJob } from "../jobs/sync";

class WebhookNonceStore {
  private cache = new Map<string, number>();
  constructor(private ttlMs: number) {}

  purge(now: number) {
    for (const [nonce, ts] of this.cache.entries()) {
      if (now - ts > this.ttlMs) {
        this.cache.delete(nonce);
      }
    }
  }

  check(nonce: string, timestamp: Date) {
    const now = Date.now();
    if (!nonce) {
      return { ok: false, reason: "missing_nonce" } as const;
    }
    if (now - timestamp.getTime() > this.ttlMs) {
      return { ok: false, reason: "stale" } as const;
    }
    const existing = this.cache.get(nonce);
    if (existing && now - existing < this.ttlMs) {
      return { ok: false, reason: "replay" } as const;
    }
    this.cache.set(nonce, now);
    this.purge(now);
    return { ok: true } as const;
  }
}

const nonceStore = new WebhookNonceStore(5 * 60 * 1000);

export function registerConnectorWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/:provider", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const connector = getConnector(provider);
    if (!connector) {
      return reply.code(404).send({ error: "unknown_provider" });
    }
    const rawBody = (request as any).rawBody as Buffer | undefined;
    const bodyBuffer = rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    let verification;
    try {
      verification = await connector.verifyWebhook(bodyBuffer, request.headers);
    } catch (err) {
      request.log.error({ err }, "webhook_verification_failed");
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.valid || !verification.orgId) {
      return reply.code(401).send({ error: verification.reason ?? "unauthorized" });
    }
    const nonce = verification.nonce ?? "";
    const timestamp = verification.timestamp ?? new Date();
    const nonceResult = nonceStore.check(nonce, timestamp);
    if (!nonceResult.ok) {
      return reply.code(409).send({ error: nonceResult.reason });
    }
    const connection = verification.connectionId
      ? await prisma.providerConnection.findFirst({ where: { id: verification.connectionId } })
      : await prisma.providerConnection.findFirst({ where: { provider, orgId: verification.orgId } });
    if (!connection) {
      return reply.code(202).send({ ok: true, ignored: true });
    }
    await enqueueSyncJob({
      provider,
      orgId: connection.orgId,
      connectionId: connection.id,
      reason: "webhook",
      events: verification.events,
    });
    return reply.code(202).send({ ok: true });
  });
}
