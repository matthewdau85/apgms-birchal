let PrismaClientCtor: { new (): unknown };

try {
  const mod = await import("@prisma/client");
  PrismaClientCtor = mod.PrismaClient;
} catch {
  PrismaClientCtor = class {
    user = {
      async findMany() {
        return [];
      },
    };

    bankLine = {
      async findMany() {
        return [];
      },
      async create() {
        return {};
      },
    };
  };
}

export const prisma = new PrismaClientCtor() as any;
