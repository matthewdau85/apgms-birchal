import { randomUUID } from "node:crypto";
import { vi } from "vitest";

export interface MockProviderConnectionRecord {
  id: string;
  orgId: string;
  provider: string;
  status: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockBankLineRecord {
  id: string;
  orgId: string;
  externalId: string;
  date: Date;
  amount: any;
  payee: string;
  desc: string;
  provider?: string | null;
  createdAt: Date;
}

export interface MockAuditBlobRecord {
  id: string;
  provider: string;
  externalId: string;
  type: string;
  orgId: string;
  payload: unknown;
  createdAt: Date;
}

function matchesWhere<T extends Record<string, any>>(where: Record<string, any> | undefined, record: T) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return matchesWhere(value as Record<string, any>, record[key] ?? record);
    }
    return record[key] === value;
  });
}

export function createMockPrisma() {
  const connections = new Map<string, MockProviderConnectionRecord>();
  const bankLines = new Map<string, MockBankLineRecord>();
  const auditBlobs = new Map<string, MockAuditBlobRecord>();

  const prisma = {
    __stores: { connections, bankLines, auditBlobs },
    providerConnection: {
      create: vi.fn(async ({ data }: { data: Partial<MockProviderConnectionRecord> }) => {
        const record: MockProviderConnectionRecord = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId!,
          provider: data.provider!,
          status: data.status ?? "PENDING",
          accessToken: (data.accessToken as string | null) ?? null,
          refreshToken: (data.refreshToken as string | null) ?? null,
          expiresAt: (data.expiresAt as Date | null) ?? null,
          meta: (data.meta as Record<string, unknown> | null) ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        connections.set(record.id, record);
        return structuredClone(record);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockProviderConnectionRecord> }) => {
        const existing = connections.get(where.id);
        if (!existing) throw new Error("connection_not_found");
        const updated: MockProviderConnectionRecord = {
          ...existing,
          ...data,
          meta: (data.meta as Record<string, unknown> | null) ?? (existing.meta ?? null),
          updatedAt: new Date(),
        };
        connections.set(updated.id, updated);
        return structuredClone(updated);
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
        for (const record of connections.values()) {
          if (matchesWhere(where, record)) {
            return structuredClone(record);
          }
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
        const results: MockProviderConnectionRecord[] = [];
        for (const record of connections.values()) {
          if (matchesWhere(where, record)) {
            results.push(structuredClone(record));
          }
        }
        return results;
      }),
    },
    bankLine: {
      upsert: vi.fn(async ({
        where,
        create,
        update,
      }: {
        where: { orgId_externalId: { orgId: string; externalId: string } };
        create: Partial<MockBankLineRecord>;
        update: Partial<MockBankLineRecord>;
      }) => {
        const key = `${where.orgId_externalId.orgId}:${where.orgId_externalId.externalId}`;
        const existing = bankLines.get(key);
        if (existing) {
          const next: MockBankLineRecord = {
            ...existing,
            ...update,
            createdAt: existing.createdAt,
          };
          bankLines.set(key, next);
          return structuredClone(next);
        }
        const record: MockBankLineRecord = {
          id: randomUUID(),
          orgId: create.orgId!,
          externalId: create.externalId!,
          date: create.date as Date,
          amount: create.amount,
          payee: create.payee!,
          desc: create.desc!,
          provider: create.provider ?? null,
          createdAt: new Date(),
        };
        bankLines.set(key, record);
        return structuredClone(record);
      }),
      findMany: vi.fn(async () => Array.from(bankLines.values()).map((item) => structuredClone(item))),
      create: vi.fn(async ({ data }: { data: Partial<MockBankLineRecord> }) => {
        const record: MockBankLineRecord = {
          id: randomUUID(),
          orgId: data.orgId!,
          externalId: data.externalId ?? randomUUID(),
          date: data.date as Date,
          amount: data.amount,
          payee: data.payee!,
          desc: data.desc!,
          provider: data.provider ?? null,
          createdAt: new Date(),
        };
        bankLines.set(`${record.orgId}:${record.externalId}`, record);
        return structuredClone(record);
      }),
    },
    auditBlob: {
      upsert: vi.fn(async ({
        where,
        create,
        update,
      }: {
        where: { provider_externalId_type: { provider: string; externalId: string; type: string } };
        create: Partial<MockAuditBlobRecord>;
        update: Partial<MockAuditBlobRecord>;
      }) => {
        const key = `${where.provider_externalId_type.provider}:${where.provider_externalId_type.externalId}:${where.provider_externalId_type.type}`;
        const existing = auditBlobs.get(key);
        if (existing) {
          const next: MockAuditBlobRecord = {
            ...existing,
            ...update,
            createdAt: existing.createdAt,
          };
          auditBlobs.set(key, next);
          return structuredClone(next);
        }
        const record: MockAuditBlobRecord = {
          id: randomUUID(),
          provider: create.provider!,
          externalId: create.externalId!,
          type: create.type!,
          orgId: create.orgId!,
          payload: create.payload,
          createdAt: new Date(),
        };
        auditBlobs.set(key, record);
        return structuredClone(record);
      }),
    },
    user: {
      findMany: vi.fn(async () => []),
    },
  };

  return prisma;
}

export type MockPrismaClient = ReturnType<typeof createMockPrisma>;
