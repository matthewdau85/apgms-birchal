import type { FastifyInstance } from "fastify";
import type { AppDependencies } from "./app";

type ExitFunction = (code?: number) => void;

export function createShutdownHandler(
  app: FastifyInstance,
  deps: AppDependencies,
  exit: ExitFunction = process.exit,
): (signal?: NodeJS.Signals) => Promise<void> {
  let shuttingDown = false;

  return async (signal?: NodeJS.Signals) => {
    if (shuttingDown) {
      app.log.info({ signal }, "shutdown already in progress");
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, "received shutdown signal");

    let exitCode = 0;

    try {
      await app.close();
    } catch (error) {
      exitCode = 1;
      app.log.error({ err: error }, "failed to close fastify instance");
    }

    try {
      await deps.prisma.$disconnect();
    } catch (error) {
      exitCode = 1;
      app.log.error({ err: error }, "failed to disconnect prisma");
    }

    exit(exitCode);
  };
}
