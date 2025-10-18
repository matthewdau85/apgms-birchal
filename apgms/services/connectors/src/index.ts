import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

type ConnectorStatus = "online" | "degraded" | "offline";

interface ConnectorProvider {
  id: string;
  name: string;
  status: ConnectorStatus;
  capabilities: string[];
  lastSyncedAt: Date | null;
}

interface ConnectorConnection {
  id: string;
  orgId: string;
  providerId: string;
  createdAt: Date;
  lastSyncStatus: ConnectorStatus;
  lastSyncAt: Date | null;
  accountMask: string;
}

const providers: ConnectorProvider[] = [
  {
    id: "plaid",
    name: "Plaid",
    status: "online",
    capabilities: ["transactions", "identity", "balance"],
    lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "finicity",
    name: "Finicity",
    status: "degraded",
    capabilities: ["transactions"],
    lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: "mono",
    name: "Mono (AU Open Banking)",
    status: "online",
    capabilities: ["cdr"],
    lastSyncedAt: new Date(Date.now() - 60 * 60 * 1000),
  },
];

const connections: ConnectorConnection[] = [
  {
    id: "conn_001",
    orgId: "org-birchal",
    providerId: "plaid",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    lastSyncStatus: "online",
    lastSyncAt: new Date(Date.now() - 10 * 60 * 1000),
    accountMask: "***6789",
  },
  {
    id: "conn_002",
    orgId: "org-birchal",
    providerId: "mono",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lastSyncStatus: "online",
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
    accountMask: "***4123",
  },
];

const syncRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
});

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "connectors" }));

app.get("/providers", async () => ({
  providers: providers.map((provider) => ({
    ...provider,
    lastSyncedAt: provider.lastSyncedAt?.toISOString() ?? null,
  })),
}));

app.get("/providers/:providerId/connections", async (req, rep) => {
  const { providerId } = req.params as { providerId: string };
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) {
    return rep.code(404).send({ error: "not_found", message: "Unknown provider" });
  }

  const { limit, cursor } = paginationQuerySchema.parse(req.query);
  const startIndex = cursor ? connections.findIndex((c) => c.id === cursor) + 1 : 0;
  const slice = connections
    .filter((c) => c.providerId === providerId)
    .slice(startIndex, startIndex + limit);

  const nextCursor = slice.length === limit ? slice[slice.length - 1].id : null;

  return {
    connections: slice.map((connection) => ({
      ...connection,
      createdAt: connection.createdAt.toISOString(),
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    })),
    nextCursor,
  };
});

app.post("/providers/:providerId/sync", async (req, rep) => {
  const { providerId } = req.params as { providerId: string };
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) {
    return rep.code(404).send({ error: "not_found", message: "Unknown provider" });
  }

  const body = syncRequestSchema.safeParse(req.body ?? {});
  if (!body.success) {
    return rep.code(400).send({ error: "validation_error", issues: body.error.issues });
  }

  const orgConnections = connections.filter(
    (connection) => connection.providerId === providerId && connection.orgId === body.data.orgId,
  );

  if (orgConnections.length === 0) {
    return rep.code(404).send({ error: "not_found", message: "No connections for org" });
  }

  const syncedAt = new Date();
  orgConnections.forEach((connection) => {
    connection.lastSyncAt = syncedAt;
    connection.lastSyncStatus = "online";
  });
  provider.lastSyncedAt = syncedAt;

  return {
    syncedConnections: orgConnections.map((connection) => ({
      ...connection,
      createdAt: connection.createdAt.toISOString(),
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    })),
    provider: {
      ...provider,
      lastSyncedAt: provider.lastSyncedAt?.toISOString() ?? null,
    },
  };
});

const port = Number(process.env.PORT ?? 4001);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
