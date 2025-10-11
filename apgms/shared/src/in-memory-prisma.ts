import { randomUUID } from "node:crypto";

export interface OrgRecord {
  id: string;
  name: string;
  createdAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
  orgId: string;
}

export interface BankLineRecord {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

type CreateManyInput<T> = {
  data: T[];
};

type DeleteManyResult = {
  count: number;
};

export class InMemoryPrismaClient {
  private orgs: OrgRecord[] = [];
  private users: UserRecord[] = [];
  private bankLines: BankLineRecord[] = [];

  readonly org = {
    create: async ({ data }: { data: Omit<OrgRecord, "id" | "createdAt"> & Partial<Pick<OrgRecord, "id" | "createdAt">> }) => {
      const record: OrgRecord = {
        id: data.id ?? randomUUID(),
        createdAt: data.createdAt ?? new Date(),
        name: data.name,
      };
      this.orgs.push(record);
      return structuredClone(record);
    },
    deleteMany: async () => this.deleteAll("org"),
    findMany: async () => structuredClone(this.orgs),
  } as const;

  readonly user = {
    createMany: async ({ data }: CreateManyInput<Omit<UserRecord, "id" | "createdAt"> & Partial<Pick<UserRecord, "id" | "createdAt">>>) => {
      let count = 0;
      for (const entry of data) {
        const record: UserRecord = {
          id: entry.id ?? randomUUID(),
          createdAt: entry.createdAt ?? new Date(),
          email: entry.email,
          password: entry.password,
          orgId: entry.orgId,
        };
        this.users.push(record);
        count += 1;
      }
      return { count };
    },
    deleteMany: async () => this.deleteAll("user"),
    findMany: async (args?: { select?: Partial<Record<keyof UserRecord, boolean>>; orderBy?: { createdAt?: "desc" | "asc" } }) => {
      let result = [...this.users];
      if (args?.orderBy?.createdAt) {
        const direction = args.orderBy.createdAt === "desc" ? -1 : 1;
        result.sort((a, b) => (a.createdAt > b.createdAt ? direction : -direction));
      }
      if (args?.select) {
        const select = args.select;
        return result.map((record) => {
          const picked: Partial<UserRecord> = {};
          for (const key of Object.keys(select) as (keyof UserRecord)[]) {
            if (select[key]) {
              (picked as Record<keyof UserRecord, UserRecord[keyof UserRecord]>)[
                key
              ] = record[key];
            }
          }
          return picked;
        });
      }
      return structuredClone(result);
    },
  } as const;

  readonly bankLine = {
    create: async ({ data }: { data: Omit<BankLineRecord, "id" | "createdAt"> & Partial<Pick<BankLineRecord, "id" | "createdAt">> }) => {
      const record: BankLineRecord = {
        id: data.id ?? randomUUID(),
        createdAt: data.createdAt ?? new Date(),
        orgId: data.orgId,
        date: data.date,
        amount: data.amount,
        payee: data.payee,
        desc: data.desc,
      };
      this.bankLines.push(record);
      return structuredClone(record);
    },
    createMany: async ({ data }: CreateManyInput<Omit<BankLineRecord, "id" | "createdAt"> & Partial<Pick<BankLineRecord, "id" | "createdAt">>>) => {
      let count = 0;
      for (const entry of data) {
        await this.bankLine.create({ data: entry });
        count += 1;
      }
      return { count };
    },
    deleteMany: async () => this.deleteAll("bankLine"),
    findMany: async (args?: { take?: number; orderBy?: { date?: "desc" | "asc" } }) => {
      let result = [...this.bankLines];
      if (args?.orderBy?.date) {
        const direction = args.orderBy.date === "desc" ? -1 : 1;
        result.sort((a, b) => (a.date > b.date ? direction : -direction));
      }
      if (typeof args?.take === "number") {
        result = result.slice(0, args.take);
      }
      return structuredClone(result);
    },
  } as const;

  async $disconnect() {
    return;
  }

  private async deleteAll(scope: "org" | "user" | "bankLine"): Promise<DeleteManyResult> {
    switch (scope) {
      case "org": {
        const count = this.orgs.length;
        this.orgs = [];
        return { count };
      }
      case "user": {
        const count = this.users.length;
        this.users = [];
        return { count };
      }
      case "bankLine": {
        const count = this.bankLines.length;
        this.bankLines = [];
        return { count };
      }
    }
  }
}

export type PrismaClientLike = InMemoryPrismaClient;
