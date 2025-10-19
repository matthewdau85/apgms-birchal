class MockDecimal {
  private readonly value: string;

  constructor(value: unknown) {
    this.value = value != null ? value.toString() : "0";
  }

  toString() {
    return this.value;
  }
}

class MockPrismaClient {
  user = {
    async findMany() {
      return [] as Array<{
        email: string;
        orgId: string;
        createdAt: Date;
      }>;
    },
  };

  bankLine = {
    async findMany() {
      return [] as Array<{
        id: string;
        orgId: string;
        date: Date;
        amount: MockDecimal;
        payee: string;
        desc: string;
        createdAt: Date;
      }>;
    },
    async create({ data }: { data: any }) {
      const now = new Date();
      return {
        id: `mock-${Math.random().toString(36).slice(2, 10)}`,
        orgId: data.orgId,
        date: new Date(data.date),
        amount: new MockDecimal(data.amount),
        payee: data.payee,
        desc: data.desc,
        createdAt: now,
      };
    },
  };

  async $disconnect() {
    // no-op
  }

  async $connect() {
    // no-op
  }
}

let PrismaClientCtor: new () => any;

try {
  const mod = await import("@prisma/client");
  PrismaClientCtor = mod.PrismaClient;
} catch (error) {
  PrismaClientCtor = MockPrismaClient;
}

export const prisma = new PrismaClientCtor();
