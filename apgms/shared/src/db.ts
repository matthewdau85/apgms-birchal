import { randomUUID } from "node:crypto";

type OrgRecord = {
  id: string;
  name: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

type UserRecord = {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
};

type FindManyOptions<T> = {
  select?: Partial<Record<keyof T, boolean>>;
  orderBy?: { [P in keyof T]?: "asc" | "desc" };
  take?: number;
};

function applySelect<T extends Record<string, unknown>>(record: T, select?: Partial<Record<keyof T, boolean>>): Partial<T> | T {
  if (!select || Object.keys(select).length === 0) {
    return { ...record };
  }
  const result: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key]) {
      result[key] = record[key];
    }
  }
  return result;
}

function sortRecords<T>(records: T[], orderBy?: { [P in keyof T]?: "asc" | "desc" }): T[] {
  if (!orderBy) return records;
  const entries = Object.entries(orderBy) as [keyof T, "asc" | "desc"][];
  return [...records].sort((a, b) => {
    for (const [key, direction] of entries) {
      const left = a[key];
      const right = b[key];
      if (left === right) continue;
      if (left instanceof Date && right instanceof Date) {
        const diff = left.getTime() - right.getTime();
        if (diff !== 0) {
          return direction === "asc" ? diff : -diff;
        }
        continue;
      }
      if (left! < right!) {
        return direction === "asc" ? -1 : 1;
      }
      if (left! > right!) {
        return direction === "asc" ? 1 : -1;
      }
    }
    return 0;
  });
}

class InMemoryPrismaClient {
  #orgs = new Map<string, OrgRecord>();
  #bankLines = new Map<string, BankLineRecord>();
  #users = new Map<string, UserRecord>();

  org = {
    create: async ({ data }: { data: Partial<OrgRecord> & { name: string } }) => {
      const now = new Date();
      const record: OrgRecord = {
        id: data.id ?? randomUUID(),
        name: data.name,
        createdAt: data.createdAt ?? now,
      };
      this.#orgs.set(record.id, record);
      return { ...record };
    },
    findUnique: async ({ where: { id } }: { where: { id: string } }) => {
      const record = this.#orgs.get(id);
      return record ? { ...record } : null;
    },
  };

  user = {
    findMany: async (options: FindManyOptions<UserRecord> = {}) => {
      const items = Array.from(this.#users.values());
      const sorted = sortRecords(items, options.orderBy);
      return sorted.map((record) => applySelect(record, options.select));
    },
  };

  bankLine = {
    findMany: async (options: FindManyOptions<BankLineRecord> = {}) => {
      const items = Array.from(this.#bankLines.values());
      const sorted = sortRecords(items, options.orderBy);
      const limited = typeof options.take === "number" ? sorted.slice(0, options.take) : sorted;
      return limited.map((record) => ({ ...record }));
    },
    findUnique: async ({ where: { id } }: { where: { id: string } }) => {
      const record = this.#bankLines.get(id);
      return record ? { ...record } : null;
    },
    create: async ({ data }: { data: Partial<BankLineRecord> & { orgId: string; date: Date; amount: number; payee: string; desc: string } }) => {
      const now = new Date();
      const record: BankLineRecord = {
        id: data.id ?? randomUUID(),
        orgId: data.orgId,
        date: data.date,
        amount: Number(data.amount),
        payee: data.payee,
        desc: data.desc,
        createdAt: data.createdAt ?? now,
      };
      this.#bankLines.set(record.id, record);
      return { ...record };
    },
  };

  _$reset() {
    this.#orgs.clear();
    this.#bankLines.clear();
    this.#users.clear();
  }

  async $disconnect() {
    this._$reset();
  }
}

export const prisma = new InMemoryPrismaClient();
export type PrismaLikeClient = InMemoryPrismaClient;
