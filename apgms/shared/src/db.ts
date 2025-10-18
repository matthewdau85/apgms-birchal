type PrismaClientType = import("@prisma/client").PrismaClient;

type DisabledPrisma = {
  user: { findMany: () => Promise<unknown[]> };
  bankLine: {
    findMany: () => Promise<unknown[]>;
    create: () => Promise<never>;
  };
};

let prisma: PrismaClientType;

if (process.env.PRISMA_DISABLE === "1") {
  const emptyArray = async () => [];
  const disabled = async () => {
    throw new Error("Prisma client is disabled");
  };

  const stub = {
    user: { findMany: emptyArray },
    bankLine: {
      findMany: emptyArray,
      create: disabled,
    },
  } satisfies DisabledPrisma;

  prisma = stub as unknown as PrismaClientType;
} else {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
}

export { prisma };
