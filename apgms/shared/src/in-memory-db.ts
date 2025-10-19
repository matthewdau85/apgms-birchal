import { randomUUID } from "node:crypto";

export type GateStatus = "OPEN" | "CLOSED";

type Agreement = {
  id: string;
  orgId: string;
  maskedBsb: string;
  maskedAcc: string;
  createdAt: Date;
};

type Remittance = {
  id: string;
  orgId: string;
  amountCents: number;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
  failureReason?: string | null;
  auditBlobId?: string | null;
};

type Audit = {
  id: string;
  scope: string;
  orgId?: string | null;
  payload: any;
  createdAt: Date;
};

type Org = {
  id: string;
  name: string;
  createdAt: Date;
};

type User = {
  id: string;
  orgId: string;
  email: string;
  password: string;
  createdAt: Date;
  deletedAt: Date | null;
};

type BankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
  deletedAt: Date | null;
};

export const inMemoryStore = {
  gateStates: new Map<string, GateStatus>(),
  auditBlobs: [] as Audit[],
  agreements: [] as Agreement[],
  remittances: [] as Remittance[],
  orgs: new Map<string, Org>(),
  users: [] as User[],
  bankLines: [] as BankLine[],
};

export function resetInMemoryStore() {
  inMemoryStore.gateStates.clear();
  inMemoryStore.auditBlobs.length = 0;
  inMemoryStore.agreements.length = 0;
  inMemoryStore.remittances.length = 0;
  inMemoryStore.orgs.clear();
  inMemoryStore.users.length = 0;
  inMemoryStore.bankLines.length = 0;

  const now = new Date();
  const org: Org = { id: "org-1", name: "Example Org", createdAt: now };
  inMemoryStore.orgs.set(org.id, org);
  inMemoryStore.users.push({
    id: "user-1",
    orgId: org.id,
    email: "user@example.com",
    password: "hashed",
    createdAt: now,
    deletedAt: null,
  });
  inMemoryStore.bankLines.push({
    id: "line-1",
    orgId: org.id,
    date: now,
    amount: 1000,
    payee: "Vendor",
    desc: "Subscription",
    createdAt: now,
    deletedAt: null,
  });
}

resetInMemoryStore();

function clone<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = clone(entry);
    }
    return result as T;
  }
  return value;
}

export const inMemoryPrisma = {
  gateState: {
    findUnique: async ({ where: { gateId } }: any) => {
      const status = inMemoryStore.gateStates.get(gateId);
      return status ? { gateId, status } : null;
    },
    upsert: async ({ where: { gateId }, create, update }: any) => {
      const status = (create?.status ?? update?.status) as GateStatus;
      inMemoryStore.gateStates.set(gateId, status);
      return { gateId, status };
    },
  },
  payToAgreement: {
    create: async ({ data }: any) => {
      const record: Agreement = {
        id: randomUUID(),
        createdAt: new Date(),
        ...data,
      };
      inMemoryStore.agreements.push(record);
      return clone(record);
    },
  },
  payToRemittance: {
    create: async ({ data }: any) => {
      const record: Remittance = {
        id: randomUUID(),
        createdAt: new Date(),
        processedAt: null,
        failureReason: null,
        auditBlobId: null,
        ...data,
      };
      inMemoryStore.remittances.push(record);
      return clone(record);
    },
    findMany: async ({ where, orderBy }: any = {}) => {
      let results = inMemoryStore.remittances.filter((item) => {
        if (where?.status && item.status !== where.status) return false;
        return true;
      });
      if (orderBy?.createdAt === "asc") {
        results = results
          .slice()
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
      return results.map(clone);
    },
    update: async ({ where: { id }, data }: any) => {
      const record = inMemoryStore.remittances.find((item) => item.id === id);
      if (!record) throw new Error("remittance_not_found");
      Object.assign(record, data);
      return clone(record);
    },
  },
  auditBlob: {
    create: async ({ data }: any) => {
      const record: Audit = {
        id: randomUUID(),
        createdAt: new Date(),
        ...data,
      };
      inMemoryStore.auditBlobs.push(record);
      return clone(record);
    },
    findMany: async () => inMemoryStore.auditBlobs.map(clone),
  },
  org: {
    findUnique: async ({ where: { id }, include }: any) => {
      const org = inMemoryStore.orgs.get(id);
      if (!org) return null;
      const result: any = { ...org };
      if (include?.users) {
        result.users = inMemoryStore.users
          .filter((u) => u.orgId === id)
          .map(clone);
      }
      if (include?.lines) {
        result.lines = inMemoryStore.bankLines
          .filter((line) => line.orgId === id)
          .map(clone);
      }
      if (include?.agreements) {
        result.agreements = inMemoryStore.agreements
          .filter((a) => a.orgId === id)
          .map(clone);
      }
      if (include?.remittances) {
        result.remittances = inMemoryStore.remittances
          .filter((r) => r.orgId === id)
          .map(clone);
      }
      return result;
    },
  },
  user: {
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const user of inMemoryStore.users) {
        if (where?.orgId && user.orgId !== where.orgId) continue;
        if (where?.deletedAt === null && user.deletedAt) continue;
        Object.assign(user, data);
        count += 1;
      }
      return { count };
    },
    findMany: async ({ where }: any = {}) => {
      return inMemoryStore.users
        .filter((user) => {
          if (where?.orgId && user.orgId !== where.orgId) return false;
          if (where?.deletedAt === null && user.deletedAt) return false;
          return true;
        })
        .map(clone);
    },
  },
  bankLine: {
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const line of inMemoryStore.bankLines) {
        if (where?.orgId && line.orgId !== where.orgId) continue;
        if (where?.deletedAt === null && line.deletedAt) continue;
        Object.assign(line, data);
        count += 1;
      }
      return { count };
    },
    findMany: async ({ where }: any = {}) => {
      return inMemoryStore.bankLines
        .filter((line) => {
          if (where?.orgId && line.orgId !== where.orgId) return false;
          if (where?.deletedAt === null && line.deletedAt) return false;
          return true;
        })
        .map(clone);
    },
  },
};
