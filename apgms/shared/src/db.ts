let prismaInstance: any;

try {
  const module = await import("@prisma/client");
  const { PrismaClient } = module as { PrismaClient: new () => any };
  prismaInstance = new PrismaClient();
} catch (error) {
  prismaInstance = {
    user: {
      findMany: async () => {
        throw new Error("prisma client unavailable");
      },
    },
    bankLine: {
      findMany: async () => {
        throw new Error("prisma client unavailable");
      },
      create: async () => {
        throw new Error("prisma client unavailable");
      },
    },
  };
}

export const prisma = prismaInstance;
