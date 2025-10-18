import { createRequire } from "node:module";

import type { PrismaClient as PrismaClientType } from "@prisma/client";

function createPrismaClient(): PrismaClientType {
  if (process.env.PRISMA_SKIP_LOAD === "1") {
    return new Proxy(
      {},
      {
        get() {
          throw new Error("Prisma client is disabled when PRISMA_SKIP_LOAD=1");
        },
      },
    ) as PrismaClientType;
  }

  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client") as { PrismaClient: new () => PrismaClientType };
  return new PrismaClient();
}

export const prisma: PrismaClientType = createPrismaClient();
