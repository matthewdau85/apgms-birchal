export type PrismaClientLike = {
  user: {
    findMany: (args?: unknown) => Promise<unknown[]>;
  };
  bankLine: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
};

async function createClient(): Promise<PrismaClientLike> {
  try {
    const pkg = (await import("@prisma/client")) as unknown as {
      PrismaClient?: new () => PrismaClientLike;
    };
    if (pkg.PrismaClient) {
      return new pkg.PrismaClient();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
    console.warn("@prisma/client is not available; using a no-op Prisma client", message);
  }

  return {
    user: {
      async findMany() {
        return [];
      },
    },
    bankLine: {
      async findMany() {
        return [];
      },
      async create() {
        throw new Error("Prisma client is not available");
      },
    },
  } satisfies PrismaClientLike;
}

export const prisma: PrismaClientLike = await createClient();
