let PrismaClientConstructor: new () => any;

try {
  const mod = await import("@prisma/client");
  if (!("PrismaClient" in mod) || typeof mod.PrismaClient !== "function") {
    throw new Error("PrismaClient export is unavailable");
  }
  PrismaClientConstructor = mod.PrismaClient;
} catch (error) {
  if (process.env.NODE_ENV !== "test") {
    throw error;
  }

  class PrismaClientStub {
    user = { findMany: async () => [] };
    bankLine = {
      findMany: async () => [],
      create: async () => ({}),
    };

    async $queryRaw() {
      return [];
    }

    async $disconnect() {}
  }

  PrismaClientConstructor = PrismaClientStub;
}

export const prisma = new PrismaClientConstructor();
