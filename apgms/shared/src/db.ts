import { createRequire } from "node:module";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const require = createRequire(import.meta.url);

type PrismaClientConstructor = new () => PrismaClientType;

function createUnavailableError(): Error {
  return new Error("prisma_client_unavailable");
}

function createFallbackClient(): PrismaClientType {
  const unavailable = async () => {
    throw createUnavailableError();
  };

  return {
    user: { findMany: unavailable } as unknown,
    bankLine: { findMany: unavailable, create: unavailable } as unknown,
    $disconnect: async () => {},
  } as unknown as PrismaClientType;
}

let PrismaClientCtor: PrismaClientConstructor | undefined;

try {
  const mod = require("@prisma/client") as { PrismaClient: PrismaClientConstructor };
  PrismaClientCtor = mod.PrismaClient;
} catch {
  PrismaClientCtor = undefined;
}

const prisma = PrismaClientCtor ? new PrismaClientCtor() : createFallbackClient();

export { prisma };
