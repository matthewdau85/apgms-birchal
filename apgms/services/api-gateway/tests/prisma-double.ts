import type { PrismaClientLike } from "../src/app";

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
};

export function createPrismaDouble(): PrismaClientLike {
  const bankLines: BankLineRecord[] = [];

  return {
    bankLine: {
      async create({ data }: any) {
        const entry: BankLineRecord = {
          id: String(bankLines.length + 1),
          orgId: data.orgId,
          date: data.date instanceof Date ? data.date : new Date(data.date),
          amount: Number(data.amount),
          payee: data.payee,
          desc: data.desc,
        };
        bankLines.push(entry);
        return entry as any;
      },
      async findMany({ take }: any) {
        const limit = typeof take === "number" ? take : bankLines.length;
        return [...bankLines]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, limit) as any;
      },
    },
    user: {
      async findMany() {
        return [] as any;
      },
    },
  } as PrismaClientLike;
}
