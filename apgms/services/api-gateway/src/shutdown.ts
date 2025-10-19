import type { FastifyInstance } from "fastify";

type Disconnectable = {
  $disconnect(): Promise<void>;
};

type ShutdownOptions = {
  exit?: boolean;
  signals?: NodeJS.Signals[];
};

export function setupGracefulShutdown(
  app: FastifyInstance,
  prismaClient: Disconnectable,
  options: ShutdownOptions = {},
): () => void {
  const { exit = process.env.NODE_ENV !== "test", signals = ["SIGTERM", "SIGINT"] } = options;
  const listeners = new Map<NodeJS.Signals, () => void>();
  let shuttingDown = false;

  const cleanup = () => {
    for (const [signal, listener] of listeners.entries()) {
      process.off(signal, listener);
    }
    listeners.clear();
  };

  const initiateShutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    cleanup();
    app.log.info({ signal }, "received shutdown signal");

    const shutdown = async () => {
      const results = await Promise.allSettled([app.close(), prismaClient.$disconnect()]);

      const rejected = results.find((result) => result.status === "rejected");
      if (rejected && rejected.status === "rejected") {
        app.log.error({ err: rejected.reason }, "error during shutdown");
        if (exit) {
          process.exit(1);
        }
        return;
      }

      if (exit) {
        process.exit(0);
      }
    };

    void shutdown();
  };

  for (const signal of signals) {
    const listener = () => initiateShutdown(signal);
    listeners.set(signal, listener);
    process.on(signal, listener);
  }

  return cleanup;
}
