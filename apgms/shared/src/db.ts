import { createRequire } from "node:module";
import {
  inMemoryPrisma,
  resetInMemoryStore,
  inMemoryStore,
} from "./in-memory-db";

const useInMemory =
  process.env.USE_IN_MEMORY_DB === "true" || process.env.NODE_ENV === "test";

const require = createRequire(import.meta.url);

let prismaInstance: any;

if (useInMemory) {
  prismaInstance = inMemoryPrisma;
} else {
  const { PrismaClient } = require("@prisma/client");
  prismaInstance = new PrismaClient();
}

export const prisma = prismaInstance;
export const __inMemoryStore = useInMemory ? inMemoryStore : undefined;
export const __resetInMemoryStore = useInMemory ? resetInMemoryStore : undefined;
