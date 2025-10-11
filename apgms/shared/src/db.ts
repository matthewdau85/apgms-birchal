import { randomUUID } from "node:crypto";

type Select<T> = Partial<Record<keyof T, boolean>> | undefined;

type User = {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
};

type BankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: string;
  payee: string;
  desc: string;
  createdAt: Date;
};

type UserWhereUnique = {
  email?: string;
  id?: string;
};

type UserFindManyArgs = {
  where?: {
    orgId?: string;
  };
  select?: Select<User>;
  orderBy?: {
    createdAt?: "asc" | "desc";
  };
};

type BankLineFindManyArgs = {
  where?: {
    orgId?: string;
  };
  orderBy?: {
    date?: "asc" | "desc";
  };
  take?: number;
};

type BankLineCreateArgs = {
  data: {
    orgId: string;
    date: Date;
    amount: number | string;
    payee: string;
    desc: string;
  };
};

const pick = <T extends Record<string, unknown>>(row: T, select: Select<T>): Partial<T> => {
  if (!select) {
    return { ...row };
  }
  const entries = Object.entries(select).filter(([, value]) => Boolean(value)) as [keyof T, boolean][];
  if (!entries.length) {
    return {};
  }
  return entries.reduce<Partial<T>>((acc, [key]) => {
    acc[key] = row[key];
    return acc;
  }, {});
};

class InMemoryPrismaClient {
  #users: User[] = [];
  #bankLines: BankLine[] = [];

  constructor() {
    const now = new Date();
    const orgId = "demo-org";
    this.#users.push({
      id: "user-demo",
      email: "founder@example.com",
      password: "password123",
      orgId,
      createdAt: now,
    });
    this.#bankLines.push(
      {
        id: "line-1",
        orgId,
        date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
        amount: "1250.75",
        payee: "Acme",
        desc: "Office fit-out",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
      },
      {
        id: "line-2",
        orgId,
        date: new Date(now.getTime() - 1000 * 60 * 60 * 24),
        amount: "-299.99",
        payee: "CloudCo",
        desc: "Monthly sub",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      },
      {
        id: "line-3",
        orgId,
        date: now,
        amount: "5000.00",
        payee: "Birchal",
        desc: "Investment received",
        createdAt: now,
      },
    );
  }

  user = {
    findUnique: async ({ where }: { where: UserWhereUnique }) => {
      if (where.email) {
        return this.#users.find((user) => user.email === where.email) ?? null;
      }
      if (where.id) {
        return this.#users.find((user) => user.id === where.id) ?? null;
      }
      return null;
    },
    findMany: async ({ where, select, orderBy }: UserFindManyArgs = {}) => {
      let results = [...this.#users];
      if (where?.orgId) {
        results = results.filter((user) => user.orgId === where.orgId);
      }
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === "asc" ? 1 : -1;
        results.sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * direction);
      }
      return results.map((user) => pick(user, select));
    },
  };

  bankLine = {
    findMany: async ({ where, orderBy, take }: BankLineFindManyArgs = {}) => {
      let results = [...this.#bankLines];
      if (where?.orgId) {
        results = results.filter((line) => line.orgId === where.orgId);
      }
      if (orderBy?.date) {
        const direction = orderBy.date === "asc" ? 1 : -1;
        results.sort((a, b) => (a.date.getTime() - b.date.getTime()) * direction);
      }
      if (typeof take === "number") {
        results = results.slice(0, Math.max(0, take));
      }
      return results.map((line) => ({ ...line }));
    },
    create: async ({ data }: BankLineCreateArgs) => {
      const entry: BankLine = {
        id: randomUUID(),
        orgId: data.orgId,
        date: new Date(data.date),
        amount: typeof data.amount === "number" ? data.amount.toString() : data.amount,
        payee: data.payee,
        desc: data.desc,
        createdAt: new Date(),
      };
      this.#bankLines.unshift(entry);
      return { ...entry };
    },
  };

  async $disconnect() {
    return;
  }
}

let prisma: any;

try {
  const pkg = await import("@prisma/client");
  const PrismaClient = (pkg as any).PrismaClient ?? (pkg as any).default?.PrismaClient;
  if (!PrismaClient) {
    throw new Error("PrismaClient export not found");
  }
  prisma = new PrismaClient();
} catch (error) {
  const usingFallbackMessage = "Falling back to in-memory Prisma test double";
  if (process?.env?.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(usingFallbackMessage, error);
  }
  prisma = new InMemoryPrismaClient();
}

export { prisma };
