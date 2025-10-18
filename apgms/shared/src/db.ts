import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export interface PrismaClientLike {
  user: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
  bankLine: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
  auditLog: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
  auditAnchor: {
    findUnique: (...args: any[]) => Promise<any | null>;
    upsert: (...args: any[]) => Promise<any>;
  };
  $disconnect?: () => Promise<void>;
}

interface InMemoryUser {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
}

interface InMemoryBankLine {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface InMemoryAuditLog {
  id: string;
  actorRole: string;
  action: string;
  resource: string;
  metadata: JsonValue;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
  anchorDate: Date;
}

interface InMemoryAuditAnchor {
  date: Date;
  hash: string;
  createdAt: Date;
}

export class InMemoryPrismaClient implements PrismaClientLike {
  #users: InMemoryUser[] = [];
  #bankLines: InMemoryBankLine[] = [];
  #auditLogs: InMemoryAuditLog[] = [];
  #anchors = new Map<string, InMemoryAuditAnchor>();

  user = {
    findMany: async (args: any = {}) => {
      const select = args.select as Record<string, boolean> | undefined;
      const orderBy = args.orderBy as { createdAt?: "asc" | "desc" } | undefined;
      const take = typeof args.take === "number" ? args.take : undefined;
      let result = [...this.#users];
      if (orderBy?.createdAt === "desc") {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (orderBy?.createdAt === "asc") {
        result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
      if (typeof take === "number") {
        result = result.slice(0, take);
      }
      if (!select) {
        return result.map((user) => ({ ...user }));
      }
      return result.map((user) => {
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          if (select[key as keyof InMemoryUser]) {
            const value = user[key as keyof InMemoryUser];
            picked[key] = value instanceof Date ? value.toISOString() : value;
          }
        }
        return picked;
      });
    },
    create: async ({ data }: { data: Partial<InMemoryUser> }) => {
      const created: InMemoryUser = {
        id: data.id ?? randomUUID(),
        email: data.email ?? "user@example.com",
        password: data.password ?? "password",
        orgId: data.orgId ?? randomUUID(),
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      this.#users.push(created);
      return { ...created, createdAt: created.createdAt.toISOString() };
    },
  };

  bankLine = {
    findMany: async (args: any = {}) => {
      const orderBy = args.orderBy as { date?: "asc" | "desc" } | undefined;
      const take = typeof args.take === "number" ? args.take : undefined;
      let result = [...this.#bankLines];
      if (orderBy?.date === "desc") {
        result.sort((a, b) => b.date.getTime() - a.date.getTime());
      } else if (orderBy?.date === "asc") {
        result.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
      if (typeof take === "number") {
        result = result.slice(0, take);
      }
      return result.map((line) => ({
        ...line,
        date: line.date.toISOString(),
        createdAt: line.createdAt.toISOString(),
      }));
    },
    create: async ({ data }: { data: Partial<InMemoryBankLine> }) => {
      const created: InMemoryBankLine = {
        id: data.id ?? randomUUID(),
        orgId: data.orgId ?? randomUUID(),
        date: data.date ? new Date(data.date as unknown as string) : new Date(),
        amount: typeof data.amount === "number" ? data.amount : Number(data.amount ?? 0),
        payee: data.payee ?? "",
        desc: data.desc ?? "",
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      this.#bankLines.push(created);
      return {
        ...created,
        date: created.date.toISOString(),
        createdAt: created.createdAt.toISOString(),
      };
    },
  };

  auditLog = {
    findMany: async (args: any = {}) => {
      const where = args.where as { anchorDate?: Date } | undefined;
      const orderBy = args.orderBy as { createdAt?: "asc" | "desc" } | undefined;
      const take = typeof args.take === "number" ? args.take : undefined;
      let result = [...this.#auditLogs];
      if (where?.anchorDate) {
        const target = where.anchorDate;
        const targetTime = target instanceof Date ? target.getTime() : new Date(target).getTime();
        result = result.filter((log) => log.anchorDate.getTime() === targetTime);
      }
      if (orderBy?.createdAt === "asc") {
        result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else if (orderBy?.createdAt === "desc") {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (typeof take === "number") {
        result = result.slice(0, take);
      }
      return result.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        anchorDate: log.anchorDate.toISOString(),
      }));
    },
    create: async ({ data }: { data: Partial<InMemoryAuditLog> }) => {
      const created: InMemoryAuditLog = {
        id: data.id ?? randomUUID(),
        actorRole: data.actorRole ?? "unknown",
        action: data.action ?? "unknown",
        resource: data.resource ?? "unknown",
        metadata: data.metadata ?? {},
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        prevHash: data.prevHash ?? null,
        hash: data.hash ?? "",
        anchorDate: data.anchorDate ? new Date(data.anchorDate) : new Date(),
      };
      this.#auditLogs.push(created);
      return {
        ...created,
        createdAt: created.createdAt.toISOString(),
        anchorDate: created.anchorDate.toISOString(),
      };
    },
  };

  auditAnchor = {
    findUnique: async ({ where }: { where: { date: Date } }) => {
      const key = where.date.toISOString();
      const anchor = this.#anchors.get(key);
      if (!anchor) {
        return null;
      }
      return {
        ...anchor,
        date: anchor.date.toISOString(),
        createdAt: anchor.createdAt.toISOString(),
      };
    },
    upsert: async ({ where, create, update }: any) => {
      const key = where.date.toISOString();
      const existing = this.#anchors.get(key);
      if (existing) {
        const next: InMemoryAuditAnchor = {
          date: existing.date,
          hash: update.hash ?? existing.hash,
          createdAt: existing.createdAt,
        };
        this.#anchors.set(key, next);
        return {
          ...next,
          date: next.date.toISOString(),
          createdAt: next.createdAt.toISOString(),
        };
      }
      const created: InMemoryAuditAnchor = {
        date: new Date(create.date),
        hash: create.hash,
        createdAt: create.createdAt ? new Date(create.createdAt) : new Date(),
      };
      this.#anchors.set(key, created);
      return {
        ...created,
        date: created.date.toISOString(),
        createdAt: created.createdAt.toISOString(),
      };
    },
  };
}

function shouldUseInMemory(): boolean {
  return process.env.NODE_ENV === "test" || process.env.USE_PRISMA_MOCK === "true";
}

const prisma: PrismaClientLike = shouldUseInMemory()
  ? new InMemoryPrismaClient()
  : (new PrismaClient() as unknown as PrismaClientLike);

export { prisma };
