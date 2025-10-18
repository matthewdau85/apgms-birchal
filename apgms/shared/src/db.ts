interface PrismaFallback {
  user: {
    findMany: (...args: any[]) => Promise<unknown[]>;
  };
  bankLine: {
    findMany: (...args: any[]) => Promise<unknown[]>;
    create: (...args: any[]) => Promise<unknown>;
  };
}

function createFallbackPrisma(): PrismaFallback {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => {
        throw new Error("Prisma client is unavailable. Inject a prisma stub for tests.");
      },
    },
  };
}

let cachedPrisma: unknown | null = null;

export async function resolvePrisma(): Promise<unknown> {
  if (cachedPrisma) return cachedPrisma;
  const module = await import("@prisma/client").catch(() => undefined as any);
  if (module?.PrismaClient) {
    cachedPrisma = new module.PrismaClient();
  } else {
    cachedPrisma = createFallbackPrisma();
  }
  return cachedPrisma;
}
