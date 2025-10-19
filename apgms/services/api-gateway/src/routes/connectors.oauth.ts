import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/src/db";
import { getConnector } from "../connectors";
import { OAuthCallbackSchema, OAuthStartSchema } from "../schemas/connectors";

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

export function registerConnectorOAuthRoutes(app: FastifyInstance) {
  app.get("/connect/:provider/start", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const connector = getConnector(provider);
    if (!connector) {
      return reply.code(404).send({ error: "unknown_provider" });
    }
    const query = OAuthStartSchema.safeParse(request.query ?? {});
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_request", details: query.error.flatten() });
    }
    const state = randomState();
    const redirectUri = query.data.redirectUri ?? `${process.env.CONNECT_REDIRECT_BASE ?? "https://app.local"}/connect/${provider}/callback`;
    const existing = await prisma.providerConnection.findFirst({
      where: { provider, orgId: query.data.orgId },
    });
    const nextMeta = {
      ...(existing?.meta as Record<string, unknown> | null | undefined ?? {}),
      oauthState: state,
      oauthStateCreatedAt: new Date().toISOString(),
    };
    const connection = existing
      ? await prisma.providerConnection.update({
          where: { id: existing.id },
          data: { status: "PENDING", meta: nextMeta },
        })
      : await prisma.providerConnection.create({
          data: {
            orgId: query.data.orgId,
            provider,
            status: "PENDING",
            meta: nextMeta,
          },
        });
    const authorizeUrl = await connector.authorizeURL({
      orgId: query.data.orgId,
      state,
      redirectUri,
    });
    return reply.send({ redirectUrl: authorizeUrl, state, connectionId: connection.id });
  });

  app.get("/connect/:provider/callback", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const connector = getConnector(provider);
    if (!connector) {
      return reply.code(404).send({ error: "unknown_provider" });
    }
    const parsed = OAuthCallbackSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    if (parsed.data.error) {
      return reply.code(400).send({ error: parsed.data.error });
    }
    const connection = await prisma.providerConnection.findFirst({
      where: { provider, orgId: parsed.data.orgId },
    });
    if (!connection) {
      return reply.code(404).send({ error: "connection_not_found" });
    }
    const meta = (connection.meta as Record<string, unknown> | null | undefined) ?? {};
    if (meta.oauthState !== parsed.data.state) {
      return reply.code(400).send({ error: "state_mismatch" });
    }
    try {
      const tokenSet = await connector.exchangeCode({
        orgId: parsed.data.orgId,
        code: parsed.data.code,
        redirectUri: parsed.data.redirectUri ?? "",
      });
      const updatedMeta = {
        ...meta,
        oauthState: null,
        connectedAt: new Date().toISOString(),
        scope: tokenSet.scope ?? [],
      };
      const updated = await prisma.providerConnection.update({
        where: { id: connection.id },
        data: {
          status: "CONNECTED",
          accessToken: tokenSet.accessToken,
          refreshToken: tokenSet.refreshToken ?? null,
          expiresAt: tokenSet.expiresAt ?? null,
          meta: updatedMeta,
        },
      });
      return reply.send({ ok: true, provider, connectionId: updated.id });
    } catch (err) {
      request.log.error({ err }, "oauth_exchange_failed");
      return reply.code(502).send({ error: "oauth_exchange_failed" });
    }
  });
}
