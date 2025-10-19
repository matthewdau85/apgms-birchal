import { createRequire } from "node:module";
import { generateId } from "./id";

type FindManyArgs<T> = {
  select?: Partial<Record<keyof T, boolean>>;
  orderBy?: Record<string, "asc" | "desc">;
  take?: number;
};

type CreateArgs<T> = {
  data: T;
};

type UserRecord = {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
};

type AuditRecord = {
  id: string;
  kind: string;
  payloadJson: unknown;
  orgId?: string | null;
  gateId?: string | null;
  createdAt: Date;
};

const userRecords: UserRecord[] = [];
const bankLineRecords: BankLineRecord[] = [];
const auditRecords: AuditRecord[] = [];

type InMemoryClient = {
  user: {
    findMany: (args?: FindManyArgs<UserRecord>) => Promise<Partial<UserRecord>[]>;
  };
  bankLine: {
    findMany: (args?: FindManyArgs<BankLineRecord>) => Promise<BankLineRecord[]>;
    create: (args: CreateArgs<Omit<BankLineRecord, "id" | "createdAt">>) => Promise<BankLineRecord>;
  };
  auditBlob: {
    create: (args: CreateArgs<AuditRecord>) => Promise<AuditRecord>;
  };
};

function applySelect<T extends Record<string, unknown>>(record: T, select?: Partial<Record<keyof T, boolean>>): Partial<T> {
  if (!select) {
    return { ...record };
  }
  const picked: Partial<T> = {};
  for (const key of Object.keys(select) as Array<keyof T>) {
    if (select[key]) {
      picked[key] = record[key];
    }
  }
  return picked;
}

function sortRecords<T extends Record<string, unknown>>(records: T[], orderBy?: Record<string, "asc" | "desc">): T[] {
  if (!orderBy) {
    return [...records];
  }
  const [field, direction] = Object.entries(orderBy)[0];
  return [...records].sort((a, b) => {
    const av = a[field as keyof T] as unknown as number | string | Date;
    const bv = b[field as keyof T] as unknown as number | string | Date;
    if (av instanceof Date && bv instanceof Date) {
      return direction === "desc" ? bv.getTime() - av.getTime() : av.getTime() - bv.getTime();
    }
    if (typeof av === "number" && typeof bv === "number") {
      return direction === "desc" ? bv - av : av - bv;
    }
    const as = String(av);
    const bs = String(bv);
    return direction === "desc" ? bs.localeCompare(as) : as.localeCompare(bs);
  });
}

function createInMemoryClient(): InMemoryClient {
  return {
    user: {
      async findMany(args?: FindManyArgs<UserRecord>) {
        const ordered = sortRecords(userRecords, args?.orderBy);
        return ordered.map((record) => applySelect(record, args?.select));
      },
    },
    bankLine: {
      async findMany(args?: FindManyArgs<BankLineRecord>) {
        const ordered = sortRecords(bankLineRecords, args?.orderBy);
        const sliced = typeof args?.take === "number" ? ordered.slice(0, args.take) : ordered;
        return sliced.map((record) => ({ ...record }));
      },
      async create(args: CreateArgs<Omit<BankLineRecord, "id" | "createdAt">>) {
        const record: BankLineRecord = {
          id: generateId("bankline"),
          createdAt: new Date(),
          ...args.data,
        };
        bankLineRecords.push(record);
        return { ...record };
      },
    },
    auditBlob: {
      async create(args: CreateArgs<AuditRecord>) {
        const record: AuditRecord = { ...args.data };
        auditRecords.push(record);
        return { ...record };
      },
    },
  };
}

const require = createRequire(import.meta.url);
let prisma: InMemoryClient;

try {
  const { PrismaClient } = require("@prisma/client") as { PrismaClient: new () => InMemoryClient };
  prisma = new PrismaClient();
} catch {
  prisma = createInMemoryClient();
}

export { prisma };
