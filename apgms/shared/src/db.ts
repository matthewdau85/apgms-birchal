import { createRequire } from "node:module";

type PrismaLike = {
  $queryRaw: (...args: any[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

class MockPrismaClient implements PrismaLike {
  async $queryRaw() {
    return [];
  }

  async $disconnect() {
    // no-op for mock client
  }
}

let prismaClient: PrismaLike;

if (process.env.MOCK_PRISMA === "1") {
  prismaClient = new MockPrismaClient();
} else {
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client");
  prismaClient = new PrismaClient();
}

export const prisma = prismaClient;
