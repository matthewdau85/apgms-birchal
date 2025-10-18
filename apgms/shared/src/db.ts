function createInMemoryPrisma() {
  const bankLines: any[] = [];
  return {
    user: {
      async findMany() {
        return [];
      },
    },
    bankLine: {
      async findMany(options: { take?: number } = {}) {
        const take = typeof options.take === "number" ? options.take : bankLines.length;
        const sorted = [...bankLines].sort((a, b) => {
          const aTime = new Date(a.date).getTime();
          const bTime = new Date(b.date).getTime();
          return bTime - aTime;
        });
        return sorted.slice(0, take);
      },
      async create({ data }: { data: any }) {
        const entry = {
          ...data,
          id: `fake-${bankLines.length + 1}`,
          date: data.date instanceof Date ? data.date : new Date(data.date),
        };
        bankLines.push(entry);
        return entry;
      },
    },
  };
}

let prisma: any;

if (process.env.PRISMA_CLIENT_DISABLE === "true" || process.env.NODE_ENV === "test") {
  prisma = createInMemoryPrisma();
} else {
  try {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
  } catch (err) {
    console.warn("Falling back to in-memory Prisma stub", err);
    prisma = createInMemoryPrisma();
  }
}

export { prisma };
