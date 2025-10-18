import process from "node:process";
import { PrismaClient, Prisma } from "@prisma/client";

const DEFAULT_MAX_RETRIES = Number(process.env.PRISMA_CONNECT_MAX_RETRIES ?? 5);
const DEFAULT_OPERATION_RETRIES = Number(process.env.PRISMA_OPERATION_MAX_RETRIES ?? 2);
const DEFAULT_MIN_TIMEOUT = Number(process.env.PRISMA_RETRY_MIN_TIMEOUT_MS ?? 500);
const DEFAULT_MAX_TIMEOUT = Number(process.env.PRISMA_RETRY_MAX_TIMEOUT_MS ?? 5_000);
const DEFAULT_OPERATION_MIN_TIMEOUT = Number(
  process.env.PRISMA_OPERATION_MIN_TIMEOUT_MS ?? 200,
);
const DEFAULT_OPERATION_MAX_TIMEOUT = Number(
  process.env.PRISMA_OPERATION_MAX_TIMEOUT_MS ?? 2_000,
);
const DEFAULT_POOL_MAX = Number(process.env.PRISMA_POOL_MAX ?? 10);
const DEFAULT_POOL_TIMEOUT = Number(process.env.PRISMA_POOL_TIMEOUT_MS ?? 5_000);
const DEFAULT_POOL_LIFETIME = Number(process.env.PRISMA_POOL_MAX_LIFETIME_MS ?? 30_000);

const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === "production" ? ["warn", "error"] : ["query", "info", "warn", "error"];

type PrismaClientSingleton = PrismaClient & { __apgms_connectionPromise?: Promise<void> };

interface RetryEvent {
  attemptNumber: number;
  retriesLeft: number;
  error: unknown;
}

interface RetryOptions {
  retries: number;
  minTimeout: number;
  maxTimeout: number;
  factor: number;
  onFailedAttempt?: (event: RetryEvent) => void;
}

class AbortRetryError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  let attempt = 0;
  let delay = options.minTimeout;

  while (true) {
    try {
      return await fn(attempt + 1);
    } catch (error) {
      if (error instanceof AbortRetryError) {
        if (error.cause instanceof Error) {
          throw error.cause;
        }
        throw error.cause;
      }

      if (attempt >= options.retries) {
        throw error;
      }

      const retriesLeft = options.retries - attempt;
      options.onFailedAttempt?.({ attemptNumber: attempt + 1, retriesLeft, error });
      await wait(delay);
      delay = Math.min(delay * options.factor, options.maxTimeout);
      attempt += 1;
    }
  }
}

function buildDatasourceUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol.startsWith("postgres")) {
      url.searchParams.set("connection_limit", DEFAULT_POOL_MAX.toString());
      url.searchParams.set("pool_timeout", DEFAULT_POOL_TIMEOUT.toString());
      url.searchParams.set("pool_max_lifetime", DEFAULT_POOL_LIFETIME.toString());
    }
    return url.toString();
  } catch (error) {
    console.warn("[Prisma] Failed to parse DATABASE_URL for pooling configuration", error);
    return baseUrl;
  }
}

const datasourceUrl = buildDatasourceUrl(process.env.DATABASE_URL);

const prismaClient = (() => {
  const globalWithPrisma = globalThis as unknown as { prisma?: PrismaClientSingleton };
  if (globalWithPrisma.prisma) {
    return globalWithPrisma.prisma;
  }

  const client = new PrismaClient({
    log: logLevels,
    errorFormat: "pretty",
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
  }) as PrismaClientSingleton;

  if (process.env.NODE_ENV !== "production") {
    globalWithPrisma.prisma = client;
  }

  return client;
})();

function connectWithRetry(client: PrismaClientSingleton): Promise<void> {
  const retryOptions: RetryOptions = {
    retries: DEFAULT_MAX_RETRIES,
    minTimeout: DEFAULT_MIN_TIMEOUT,
    maxTimeout: DEFAULT_MAX_TIMEOUT,
    factor: 2,
    onFailedAttempt: (event) => {
      console.warn(
        `[Prisma] Connection attempt ${event.attemptNumber} failed. ${event.retriesLeft} retries remaining.`,
        event.error,
      );
    },
  };

  return retry(async () => {
    try {
      await client.$connect();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        throw new AbortRetryError("Prisma initialization failed", error);
      }
      throw error;
    }
  }, retryOptions);
}

let connectionPromise: Promise<void> | undefined = prismaClient.__apgms_connectionPromise;

function ensureConnectionPromise(): Promise<void> {
  if (!connectionPromise) {
    connectionPromise = connectWithRetry(prismaClient);
    prismaClient.__apgms_connectionPromise = connectionPromise;
    void connectionPromise.catch((error) => {
      console.error("[Prisma] Unable to establish database connection", error);
      connectionPromise = undefined;
      prismaClient.__apgms_connectionPromise = undefined;
    });
  }
  return connectionPromise;
}

ensureConnectionPromise();

async function disconnectGracefully(): Promise<void> {
  try {
    await prismaClient.$disconnect();
  } catch (error) {
    console.error("[Prisma] Failed to disconnect from database", error);
  }
}

process.once("beforeExit", () => {
  void disconnectGracefully();
});
process.once("SIGINT", () => {
  void disconnectGracefully().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void disconnectGracefully().finally(() => process.exit(0));
});

export const prisma: PrismaClient = prismaClient;

export async function ensureDatabaseConnection(): Promise<PrismaClient> {
  try {
    await ensureConnectionPromise();
  } catch (error) {
    connectionPromise = undefined;
    prismaClient.__apgms_connectionPromise = undefined;
    throw error;
  }
  return prismaClient;
}

type PrismaOperation<T> = (client: PrismaClient) => Promise<T>;

type OperationOptions = Partial<Omit<RetryOptions, "retries">> & { retries?: number };

export async function runWithPrisma<T>(operation: PrismaOperation<T>, options?: OperationOptions): Promise<T> {
  const retryOptions: RetryOptions = {
    retries: options?.retries ?? DEFAULT_OPERATION_RETRIES,
    minTimeout: options?.minTimeout ?? DEFAULT_OPERATION_MIN_TIMEOUT,
    maxTimeout: options?.maxTimeout ?? DEFAULT_OPERATION_MAX_TIMEOUT,
    factor: options?.factor ?? 2,
    onFailedAttempt: options?.onFailedAttempt,
  };

  return retry(async () => {
    const client = await ensureDatabaseConnection();
    try {
      return await operation(client);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AbortRetryError("Known Prisma request error", error);
      }
      throw error;
    }
  }, retryOptions);
}

export function getDatasourceUrl(): string | undefined {
  return datasourceUrl;
}
