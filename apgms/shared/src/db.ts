let prismaClient: any;

async function createClient() {
  if (prismaClient) {
    return prismaClient;
  }

  try {
    const mod = await import("@prisma/client");
    const { PrismaClient } = mod as typeof import("@prisma/client");
    prismaClient = new PrismaClient();
  } catch (error) {
    prismaClient = {
      user: {
        findMany: async () => [],
      },
      bankLine: {
        findMany: async () => [],
        create: async () => {
          throw new Error("Prisma client is not available in this environment");
        },
      },
    };
  }

  return prismaClient;
}

export const prisma = await createClient();
