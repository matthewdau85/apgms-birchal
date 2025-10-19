const useMock = process.env.APGMS_FAKE_PRISMA === "1";

type PrismaModuleType = typeof import("@prisma/client");

type PrismaShape = {
  user: { findMany: (...args: any[]) => Promise<any> };
  bankLine: {
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
};

function createUnconfiguredMock(): PrismaShape {
  const missing = async () => {
    throw new Error("Prisma mock not configured");
  };
  return {
    user: { findMany: missing },
    bankLine: { findMany: missing, create: missing },
  } as PrismaShape;
}

let prismaInstance: PrismaShape;

if (useMock) {
  prismaInstance = createUnconfiguredMock();
} else {
  const PrismaModule = (await import("@prisma/client")) as PrismaModuleType & { default: PrismaModuleType };
  const Prisma = PrismaModule.default ?? (PrismaModule as PrismaModuleType);
  const { PrismaClient } = Prisma;
  prismaInstance = new PrismaClient() as PrismaShape;
}

export const prisma = prismaInstance;
