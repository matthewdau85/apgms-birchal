type PrismaClientShape = {
  user: { findMany: (...args: any[]) => Promise<any[]> };
  bankLine: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
};

const prismaModule = await import("@prisma/client").catch(() => null as any);

export const prisma: PrismaClientShape =
  prismaModule && "PrismaClient" in prismaModule
    ? new prismaModule.PrismaClient()
    : ({
        user: {
          findMany: async () => [],
        },
        bankLine: {
          findMany: async () => [],
          create: async () => {
            throw new Error("Prisma client not available");
          },
        },
      } as PrismaClientShape);
