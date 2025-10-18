import { Prisma, PrismaClient } from "@prisma/client";
import type { LevelWithSilent } from "pino";
import { createServiceLogger } from "./logger";

const prismaLogLevel = ((process.env.PRISMA_LOG_LEVEL ?? process.env.LOG_LEVEL) ?? "info") as LevelWithSilent;

const prismaLogger = createServiceLogger("prisma", {
  level: prismaLogLevel,
});

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

prisma.$on("warn", (event: Prisma.LogEvent) => {
  prismaLogger.warn({ target: event.target, message: event.message }, "prisma warning");
});

prisma.$on("error", (event: Prisma.LogEvent) => {
  prismaLogger.error({ target: event.target, message: event.message }, "prisma error");
});

prisma.$on("beforeExit", () => {
  prismaLogger.info("prisma beforeExit");
});
