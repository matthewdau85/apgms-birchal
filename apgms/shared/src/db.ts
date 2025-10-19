import type { PrismaClient } from "@prisma/client";

let prismaPromise: Promise<PrismaClient> | null = null;

const createMockClient = (): PrismaClient => {
  const mock = {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => {
        throw new Error("Prisma client is disabled");
      },
    },
    $disconnect: async () => {},
  } as unknown as PrismaClient;
  return mock;
};

export const getPrismaClient = async (): Promise<PrismaClient> => {
  if (process.env.PRISMA_DISABLED === "true") {
    return createMockClient();
  }
  if (!prismaPromise) {
    prismaPromise = import("@prisma/client").then(({ PrismaClient }) => {
      return new PrismaClient();
    });
  }
  return prismaPromise;
};
