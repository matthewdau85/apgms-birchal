import { Prisma, ProviderConnection } from "@prisma/client";
import { prisma } from "@apgms/shared/src/db";
import { connectors, getConnector } from "../connectors";
import { Connector } from "../connectors/types";
import {
  NormalizedEmployeeSchema,
  NormalizedInvoiceSchema,
  NormalizedPaymentSchema,
  WebhookEvent,
} from "../schemas/connectors";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export interface SyncResult {
  connectionId: string;
  provider: string;
  orgId: string;
  counts: {
    invoices: number;
    payments: number;
    employees: number;
  };
  reason: string;
}

export interface SyncContext {
  reason: string;
  events?: WebhookEvent[];
}

export async function ensureFreshAccessToken(connection: ProviderConnection, connector: Connector) {
  if (!connection.accessToken) {
    throw new Error("missing_access_token");
  }
  const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : null;
  const shouldRefresh =
    !!connection.refreshToken && (!expiresAt || expiresAt - Date.now() < REFRESH_THRESHOLD_MS);
  if (!shouldRefresh) {
    return { accessToken: connection.accessToken, connection };
  }
  const refreshed = await connector.refreshToken({
    orgId: connection.orgId,
    refreshToken: connection.refreshToken!,
  });
  const meta = (connection.meta as Record<string, unknown> | null | undefined) ?? {};
  const updated = await prisma.providerConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? connection.refreshToken,
      expiresAt: refreshed.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      meta: { ...meta, refreshedAt: new Date().toISOString() },
    },
  });
  return { accessToken: updated.accessToken!, connection: updated };
}

async function persistInvoices(connection: ProviderConnection, invoices: unknown[]) {
  const parsed = NormalizedInvoiceSchema.array().parse(invoices);
  for (const invoice of parsed) {
    await prisma.auditBlob.upsert({
      where: {
        provider_externalId_type: {
          provider: connection.provider,
          externalId: invoice.externalId,
          type: "invoice",
        },
      },
      create: {
        orgId: connection.orgId,
        provider: connection.provider,
        type: "invoice",
        externalId: invoice.externalId,
        payload: invoice,
      },
      update: {
        payload: invoice,
      },
    });
  }
  return parsed.length;
}

async function persistEmployees(connection: ProviderConnection, employees: unknown[]) {
  const parsed = NormalizedEmployeeSchema.array().parse(employees);
  for (const employee of parsed) {
    await prisma.auditBlob.upsert({
      where: {
        provider_externalId_type: {
          provider: connection.provider,
          externalId: employee.externalId,
          type: "employee",
        },
      },
      create: {
        orgId: connection.orgId,
        provider: connection.provider,
        type: "employee",
        externalId: employee.externalId,
        payload: employee,
      },
      update: {
        payload: employee,
      },
    });
  }
  return parsed.length;
}

async function persistPayments(connection: ProviderConnection, payments: unknown[]) {
  const parsed = NormalizedPaymentSchema.array().parse(payments);
  for (const payment of parsed) {
    await prisma.bankLine.upsert({
      where: {
        orgId_externalId: {
          orgId: connection.orgId,
          externalId: payment.externalId,
        },
      },
      create: {
        orgId: connection.orgId,
        date: payment.occurredAt,
        amount: new Prisma.Decimal(payment.amount),
        payee: payment.counterpartyName,
        desc: payment.description ?? payment.type,
        externalId: payment.externalId,
        provider: connection.provider,
      },
      update: {
        date: payment.occurredAt,
        amount: new Prisma.Decimal(payment.amount),
        payee: payment.counterpartyName,
        desc: payment.description ?? payment.type,
        provider: connection.provider,
      },
    });
  }
  return parsed.length;
}

export async function syncConnection(
  connection: ProviderConnection,
  connector: Connector,
  context: SyncContext
): Promise<SyncResult> {
  const { accessToken, connection: ensured } = await ensureFreshAccessToken(connection, connector);
  const [invoices, payments, employees] = await Promise.all([
    connector.listInvoices({ orgId: ensured.orgId, accessToken }),
    connector.listPayments({ orgId: ensured.orgId, accessToken }),
    connector.listEmployees({ orgId: ensured.orgId, accessToken }),
  ]);

  const invoiceCount = await persistInvoices(ensured, invoices);
  const paymentCount = await persistPayments(ensured, payments);
  const employeeCount = await persistEmployees(ensured, employees);

  const meta = (ensured.meta as Record<string, unknown> | null | undefined) ?? {};
  await prisma.providerConnection.update({
    where: { id: ensured.id },
    data: {
      meta: {
        ...meta,
        lastSyncAt: new Date().toISOString(),
        lastSyncReason: context.reason,
        lastSyncCounts: {
          invoices: invoiceCount,
          payments: paymentCount,
          employees: employeeCount,
        },
      },
    },
  });

  return {
    connectionId: ensured.id,
    provider: ensured.provider,
    orgId: ensured.orgId,
    counts: {
      invoices: invoiceCount,
      payments: paymentCount,
      employees: employeeCount,
    },
    reason: context.reason,
  };
}

export async function runSyncForConnection(connectionId: string, context: Partial<SyncContext> = {}) {
  const connection = await prisma.providerConnection.findFirst({ where: { id: connectionId } });
  if (!connection) {
    throw new Error("connection_not_found");
  }
  const connector = getConnector(connection.provider);
  if (!connector) {
    throw new Error("connector_not_found");
  }
  return syncConnection(connection, connector, {
    reason: context.reason ?? "manual",
    events: context.events,
  });
}

export async function runScheduledSync(): Promise<SyncResult[]> {
  const connections = await prisma.providerConnection.findMany({
    where: { status: "CONNECTED" },
  });
  const results: SyncResult[] = [];
  for (const connection of connections) {
    const connector = getConnector(connection.provider);
    if (!connector) {
      continue;
    }
    const result = await syncConnection(connection, connector, { reason: "schedule" });
    results.push(result);
  }
  return results;
}

export function scheduleSyncJobs(intervalMs = 15 * 60 * 1000) {
  let timer: NodeJS.Timeout | null = setInterval(() => {
    runScheduledSync().catch((err) => {
      console.error("sync job failed", err);
    });
  }, intervalMs);
  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

const pendingKeys = new Set<string>();

export interface EnqueueSyncOptions {
  provider: string;
  orgId: string;
  connectionId?: string;
  reason: string;
  events?: WebhookEvent[];
}

export async function enqueueSyncJob(options: EnqueueSyncOptions) {
  const key = options.connectionId ?? `${options.provider}:${options.orgId}`;
  if (pendingKeys.has(key)) {
    return;
  }
  pendingKeys.add(key);
  queueMicrotask(async () => {
    try {
      const connection = options.connectionId
        ? await prisma.providerConnection.findFirst({ where: { id: options.connectionId } })
        : await prisma.providerConnection.findFirst({ where: { provider: options.provider, orgId: options.orgId } });
      if (!connection) {
        return;
      }
      const connector = getConnector(connection.provider);
      if (!connector) {
        return;
      }
      await syncConnection(connection, connector, { reason: options.reason, events: options.events });
    } finally {
      pendingKeys.delete(key);
    }
  });
}

export function getRegisteredProviders() {
  return Object.keys(connectors);
}
