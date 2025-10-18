import type { PrismaClient } from "@prisma/client";

let prismaClient: PrismaClient;

try {
  const { PrismaClient } = await import("@prisma/client");
  prismaClient = new PrismaClient();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn("Using in-memory PrismaClient stub:", message);

  const stub = {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({}),
    },
    $queryRaw: async () => [],
    $disconnect: async () => {},
  } satisfies Partial<PrismaClient> & {
    $queryRaw: PrismaClient["$queryRaw"];
    $disconnect: PrismaClient["$disconnect"];
  };

  prismaClient = stub as PrismaClient;
}

export const prisma = prismaClient;
