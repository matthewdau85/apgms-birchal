import { InMemoryPrismaClient, PrismaClientLike } from "./in-memory-prisma.js";

let PrismaClientConstructor: new () => PrismaClientLike;

try {
  const mod = (await import("@prisma/client")) as { PrismaClient?: new () => PrismaClientLike };
  if (mod.PrismaClient) {
    PrismaClientConstructor = mod.PrismaClient;
  } else {
    PrismaClientConstructor = InMemoryPrismaClient;
  }
} catch {
  PrismaClientConstructor = InMemoryPrismaClient;
}

export const prisma = new PrismaClientConstructor();
export type { PrismaClientLike };
