let PrismaClientCtor: new () => any;

try {
  const mod = await import("@prisma/client");
  PrismaClientCtor = mod.PrismaClient;
} catch {
  class FallbackPrismaClient {
    user = {
      findMany: async () => [],
    };

    bankLine = {
      findMany: async () => [],
      create: async () => ({
        id: "stub",
        orgId: "stub",
        date: new Date(),
        amount: 0,
        payee: "stub",
        desc: "stub",
        createdAt: new Date(),
        updatedAt: new Date(),
        externalId: null,
      }),
    };

    async $connect() {}

    async $disconnect() {}
  }

  PrismaClientCtor = FallbackPrismaClient;
}

export const prisma = new PrismaClientCtor();
