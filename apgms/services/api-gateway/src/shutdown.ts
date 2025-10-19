import type { FastifyInstance } from "fastify";

type PrismaClientLike = {
  $disconnect: () => Promise<void>;
};

type ExitFunction = (code: number) => void;

type Options = {
  signals?: NodeJS.Signals[];
  exit?: ExitFunction;
};

export const registerGracefulShutdown = (
  app: FastifyInstance,
  prisma: PrismaClientLike,
  options: Options = {}
) => {
  const signals = options.signals ?? ["SIGINT", "SIGTERM"];
  const exitFn = options.exit ?? ((code) => process.exit(code));

  let isShuttingDown = false;

  const shutdown = async (signal?: NodeJS.Signals, code = 0) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    app.log.info({ signal }, "shutting down");

    try {
      await app.close();
    } catch (closeError) {
      app.log.error({ err: closeError }, "failed to close fastify");
    }

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      app.log.error({ err: disconnectError }, "failed to disconnect prisma");
    }

    exitFn(code);
  };

  const listeners = new Map<NodeJS.Signals, () => void>();

  for (const signal of signals) {
    const listener = () => {
      shutdown(signal).catch((err) => {
        app.log.error({ err }, "error during shutdown");
        exitFn(1);
      });
    };
    listeners.set(signal, listener);
    process.once(signal, listener);
  }

  const dispose = () => {
    for (const [signal, listener] of listeners) {
      process.removeListener(signal, listener);
    }
  };

  return { shutdown, dispose };
};
