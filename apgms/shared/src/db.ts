type PrismaClientStub = {
  user: { findMany: (...args: unknown[]) => Promise<unknown> };
  bankLine: {
    findMany: (...args: unknown[]) => Promise<unknown>;
    create: (...args: unknown[]) => Promise<unknown>;
  };
};

let prisma: PrismaClientStub;

try {
  const prismaPackage = await import("@prisma/client");
  const { PrismaClient } = prismaPackage as unknown as { PrismaClient: new () => PrismaClientStub };
  prisma = new PrismaClient();
} catch (error) {
  const stubError =
    error instanceof Error
      ? error
      : (() => {
          const fallback = new Error("Unknown error loading @prisma/client");
          (fallback as any).cause = error;
          return fallback;
        })();
  console.warn("Using Prisma client stub because the real client could not be loaded.", stubError.message);
  const stub: PrismaClientStub = {
    user: {
      findMany: async () => {
        throw stubError;
      },
    },
    bankLine: {
      findMany: async () => {
        throw stubError;
      },
      create: async () => {
        throw stubError;
      },
    },
  };
  prisma = stub;
}

export { prisma };
