import type { FastifyInstance } from "fastify";
type ShutdownProcess = Pick<NodeJS.Process, "on" | "off" | "exit">;
type PrismaShutdownClient = {
  $disconnect: () => Promise<void>;
};

export function setupGracefulShutdown(
  app: FastifyInstance,
  proc: ShutdownProcess = process,
  prisma?: PrismaShutdownClient,
) {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  let shuttingDown = false;

  let sharedPrismaPromise: Promise<PrismaShutdownClient> | null = null;

  const resolvePrisma = async () => {
    if (prisma) {
      return prisma;
    }
    if (!sharedPrismaPromise) {
      sharedPrismaPromise = import("../../../shared/src/db").then(
        (mod) => mod.prisma as PrismaShutdownClient,
      );
    }
    prisma = await sharedPrismaPromise;
    return prisma;
  };

  const handler = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, "received shutdown signal");

    try {
      await app.close();
      app.log.info("fastify closed");
    } catch (error) {
      app.log.error({ err: error }, "failed to close fastify");
    }

    try {
      const client = await resolvePrisma();
      await client.$disconnect();
      app.log.info("prisma disconnected");
    } catch (error) {
      app.log.error({ err: error }, "failed to disconnect prisma");
    }

    proc.exit(0);
  };

  const wrappedHandler = (signal: NodeJS.Signals) => {
    handler(signal).catch((error) => {
      app.log.error({ err: error }, "error during graceful shutdown");
      proc.exit(1);
    });
  };

  for (const signal of signals) {
    proc.on(signal, wrappedHandler);
  }

  return () => {
    for (const signal of signals) {
      proc.off(signal, wrappedHandler);
    }
  };
}
