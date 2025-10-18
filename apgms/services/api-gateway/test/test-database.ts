import { randomUUID } from "node:crypto";
import { PrismaLikeClient } from "../src/app";

type Org = {
  id: string;
  name: string;
  createdAt: Date;
};

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
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

export class InMemoryDatabase implements PrismaLikeClient {
  private orgs = new Map<string, Org>();
  private users = new Map<string, User>();
  private bankLines = new Map<string, BankLine>();

  seedOrg(name: string, createdAt = new Date()): Org {
    const org: Org = { id: randomUUID(), name, createdAt };
    this.orgs.set(org.id, org);
    return org;
  }

  seedUser(data: Partial<User> & { email: string; orgId: string }): User {
    const user: User = {
      id: data.id ?? randomUUID(),
      email: data.email,
      password: data.password ?? "secret",
      orgId: data.orgId,
      createdAt: data.createdAt ?? new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  seedBankLine(
    data: Partial<BankLine> & {
      orgId: string;
      date?: Date;
      amount?: number;
      payee?: string;
      desc?: string;
    },
  ): BankLine {
    const bankLine: BankLine = {
      id: data.id ?? randomUUID(),
      orgId: data.orgId,
      date: data.date ?? new Date(),
      amount: data.amount ?? 0,
      payee: data.payee ?? "unknown",
      desc: data.desc ?? "",
      createdAt: data.createdAt ?? new Date(),
    };
    this.bankLines.set(bankLine.id, bankLine);
    return bankLine;
  }

  reset() {
    this.orgs.clear();
    this.users.clear();
    this.bankLines.clear();
  }

  async $disconnect() {
    this.reset();
  }

  user = {
    findMany: async ({ orderBy }: { orderBy?: { createdAt?: "asc" | "desc" } }) => {
      const records = Array.from(this.users.values());
      if (orderBy?.createdAt) {
        const direction = orderBy.createdAt === "desc" ? -1 : 1;
        records.sort((a, b) =>
          a.createdAt.getTime() === b.createdAt.getTime()
            ? 0
            : a.createdAt.getTime() > b.createdAt.getTime()
              ? direction * 1
              : direction * -1,
        );
      }
      return records.map(({ email, orgId, createdAt }) => ({ email, orgId, createdAt }));
    },
  };

  bankLine = {
    findMany: async ({
      orderBy,
      take,
    }: {
      orderBy?: { date?: "asc" | "desc" };
      take?: number;
    }) => {
      let records = Array.from(this.bankLines.values());
      if (orderBy?.date) {
        const direction = orderBy.date === "desc" ? -1 : 1;
        records = records.sort((a, b) =>
          a.date.getTime() === b.date.getTime()
            ? 0
            : a.date.getTime() > b.date.getTime()
              ? direction * 1
              : direction * -1,
        );
      }
      if (take !== undefined) {
        records = records.slice(0, take);
      }
      return records;
    },
    create: async ({
      data,
    }: {
      data: {
        orgId: string;
        date: Date;
        amount: number;
        payee: string;
        desc: string;
      };
    }) => {
      const bankLine: BankLine = {
        id: randomUUID(),
        createdAt: new Date(),
        ...data,
      };
      this.bankLines.set(bankLine.id, bankLine);
      return bankLine;
    },
  };
}
