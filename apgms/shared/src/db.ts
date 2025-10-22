let prisma: any;

try {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
} catch (error) {
  const notReady = async () => {
    throw new Error(
      "Prisma client is not available. Run `pnpm exec prisma generate` to create it."
    );
  };

  prisma = {
    user: { findMany: notReady },
    bankLine: {
      findMany: notReady,
      create: notReady,
    },
  };
}

export { prisma };
