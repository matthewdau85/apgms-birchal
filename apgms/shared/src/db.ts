import type { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __APGMS_PRISMA__: PrismaClient | undefined;
}

const globalAny = globalThis as typeof globalThis & {
  __APGMS_PRISMA__?: PrismaClient;
};

let prismaInstance = globalAny.__APGMS_PRISMA__;

if (!prismaInstance) {
  const { PrismaClient } = await import("@prisma/client");
  prismaInstance = new PrismaClient();
  globalAny.__APGMS_PRISMA__ = prismaInstance;
}

export const prisma = prismaInstance;
