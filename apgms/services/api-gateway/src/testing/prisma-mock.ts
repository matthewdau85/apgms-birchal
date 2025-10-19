import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Middleware = (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => Promise<unknown>;

type Selection<T> = Partial<Record<keyof T, boolean>>;

interface Org {
  id: string;
  name: string;
  createdAt: Date;
}

interface User {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
}

interface BankLine {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

function applySelect<T extends Record<string, unknown>>(item: T, select?: Selection<T>): Partial<T> {
  if (!select) {
    return { ...item };
  }

  return Object.entries(select).reduce<Partial<T>>((acc, [key, enabled]) => {
    if (enabled) {
      acc[key as keyof T] = item[key as keyof T];
    }
    return acc;
  }, {});
}

class PrismaMock {
  private readonly middlewares: Middleware[] = [];
  private readonly orgs: Org[] = [];
  private readonly users: User[] = [];
  private readonly bankLines: BankLine[] = [];

  constructor() {
    const org: Org = { id: "demo-org", name: "Demo Org", createdAt: new Date() };
    this.orgs.push(org);

    this.users.push({
      id: randomUUID(),
      email: "founder@example.com",
      password: "password123",
      orgId: org.id,
      createdAt: new Date(),
    });

    const today = new Date();
    this.bankLines.push(
      {
        id: randomUUID(),
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        amount: 1250.75,
        payee: "Acme",
        desc: "Office fit-out",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        amount: -299.99,
        payee: "CloudCo",
        desc: "Monthly sub",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        orgId: org.id,
        date: today,
        amount: 5000,
        payee: "Birchal",
        desc: "Investment received",
        createdAt: new Date(),
      },
    );
  }

  $use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  async $disconnect() {}

  private async execute<T>(params: Prisma.MiddlewareParams, handler: (params: Prisma.MiddlewareParams) => Promise<T>): Promise<T> {
    let index = -1;
    const dispatch = async (current: Prisma.MiddlewareParams): Promise<T> => {
      index += 1;
      const middleware = this.middlewares[index];
      if (middleware) {
        return middleware(current, dispatch) as Promise<T>;
      }
      return handler(current);
    };
    return dispatch(params);
  }

  user = {
    findMany: (args: Prisma.UserFindManyArgs = {}) => {
      const params: Prisma.MiddlewareParams = { action: "findMany", model: "User", args };
      return this.execute(params, async () => {
        const { orderBy, select } = args;
        let items = [...this.users];
        if (orderBy && "createdAt" in orderBy) {
          const direction = orderBy.createdAt === "desc" ? -1 : 1;
          items.sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * direction);
        }
        return items.map((item) => applySelect(item, select as Selection<User> | undefined));
      });
    },
    upsert: (args: Prisma.UserUpsertArgs) => {
      const params: Prisma.MiddlewareParams = { action: "upsert", model: "User", args };
      return this.execute(params, async () => {
        const { where, update, create, select } = args;
        const existing = this.users.find((user) => user.email === where.email);
        if (existing) {
          Object.assign(existing, update);
          return applySelect(existing, select as Selection<User> | undefined);
        }
        const created: User = {
          id: create.id ?? randomUUID(),
          email: create.email,
          password: create.password,
          orgId: create.orgId,
          createdAt: create.createdAt ? new Date(create.createdAt as Date | string) : new Date(),
        };
        this.users.push(created);
        return applySelect(created, select as Selection<User> | undefined);
      });
    },
  };

  org = {
    upsert: (args: Prisma.OrgUpsertArgs) => {
      const params: Prisma.MiddlewareParams = { action: "upsert", model: "Org", args };
      return this.execute(params, async () => {
        const { where, update, create } = args;
        const existing = this.orgs.find((org) => org.id === where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created: Org = {
          id: create.id ?? randomUUID(),
          name: create.name,
          createdAt: new Date(),
        };
        this.orgs.push(created);
        return created;
      });
    },
  };

  bankLine = {
    findMany: (args: Prisma.BankLineFindManyArgs = {}) => {
      const params: Prisma.MiddlewareParams = { action: "findMany", model: "BankLine", args };
      return this.execute(params, async () => {
        const { orderBy, take, select } = args;
        let items = [...this.bankLines];
        if (orderBy && "date" in orderBy) {
          const direction = orderBy.date === "desc" ? -1 : 1;
          items.sort((a, b) => (a.date.getTime() - b.date.getTime()) * direction);
        }
        const limited = typeof take === "number" ? items.slice(0, take) : items;
        return limited.map((item) => applySelect(item, select as Selection<BankLine> | undefined));
      });
    },
    create: (args: Prisma.BankLineCreateArgs) => {
      const params: Prisma.MiddlewareParams = { action: "create", model: "BankLine", args };
      return this.execute(params, async () => {
        const { data, select } = args;
        if (!data.orgId || !data.date || data.amount === undefined || !data.payee || !data.desc) {
          throw new Error("Invalid bank line payload");
        }
        const created: BankLine = {
          id: randomUUID(),
          orgId: data.orgId,
          date: data.date instanceof Date ? data.date : new Date(data.date),
          amount: typeof data.amount === "object" ? Number(data.amount as Prisma.Decimal) : (data.amount as number),
          payee: data.payee,
          desc: data.desc,
          createdAt: new Date(),
        };
        this.bankLines.push(created);
        return applySelect(created, select as Selection<BankLine> | undefined);
      });
    },
    createMany: (args: Prisma.BankLineCreateManyArgs) => {
      const params: Prisma.MiddlewareParams = { action: "createMany", model: "BankLine", args };
      return this.execute(params, async () => {
        const entries = Array.isArray(args.data) ? args.data : [args.data];
        let count = 0;
        for (const entry of entries) {
          if (args.skipDuplicates && this.bankLines.some((line) => line.id === entry.id)) {
            continue;
          }
          const created: BankLine = {
            id: entry.id ?? randomUUID(),
            orgId: entry.orgId,
            date: entry.date instanceof Date ? entry.date : new Date(entry.date),
            amount: typeof entry.amount === "object" ? Number(entry.amount as Prisma.Decimal) : (entry.amount as number),
            payee: entry.payee,
            desc: entry.desc,
            createdAt: new Date(),
          };
          this.bankLines.push(created);
          count += 1;
        }
        return { count };
      });
    },
  };
}

export const prisma = new PrismaMock() as unknown as PrismaClient;
