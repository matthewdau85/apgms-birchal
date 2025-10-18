type UserClient = {
  findMany: (args?: unknown) => Promise<unknown[]>;
};

type BankLineClient = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  user: UserClient;
  bankLine: BankLineClient;
};

let PrismaClientCtor: new () => PrismaClientLike;

try {
  const pkg = await import("@prisma/client");
  const candidate = (pkg as Record<string, unknown>).PrismaClient as (new () => PrismaClientLike) | undefined;
  if (!candidate) {
    throw new Error("PrismaClient export missing");
  }
  PrismaClientCtor = candidate;
} catch (error) {
  console.warn("Falling back to PrismaClient stub:", error);
  class PrismaClientStub implements PrismaClientLike {
    user: UserClient = {
      findMany: async () => [],
    };
    bankLine: BankLineClient = {
      findMany: async () => [],
      create: async (args) => ({
        createdAt: new Date().toISOString(),
        ...(typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {}),
      }),
    };
  }
  PrismaClientCtor = PrismaClientStub;
}

export const prisma: PrismaClientLike = new PrismaClientCtor();
