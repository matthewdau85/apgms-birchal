import type { PrismaClient as PrismaClientType } from "@prisma/client";

let PrismaClientCtor: new () => PrismaClientType;

try {
  const prismaModule = await import("@prisma/client");
  PrismaClientCtor = prismaModule.PrismaClient;
} catch (error) {
  if (process.env.NODE_ENV === "test") {
    class MockModel {
      findMany = async () => [];
      create = async () => ({} as Record<string, unknown>);
    }

    class MockPrismaClient {
      user = new MockModel();
      bankLine = new MockModel();
      async $disconnect() {
        // noop
      }
    }

    PrismaClientCtor = MockPrismaClient as unknown as new () => PrismaClientType;
  } else {
    throw error;
  }
}

export const prisma: PrismaClientType = new PrismaClientCtor();
