import IORedis, { type RedisOptions } from "ioredis";
import { z } from "zod";

export interface Job<T> {
  readonly id?: string;
  readonly data: T;
}

export interface JobsOptions {
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface QueueOptions {
  prefix?: string;
  concurrency?: number;
}

export interface WorkerOptions {
  concurrency?: number;
}

export interface BullQueue<T> {
  add(name: string, data: T, opts?: JobsOptions): Promise<unknown>;
  defaultJobOptions?: JobsOptions;
}

export interface BullWorker<T> {
  close(): Promise<void>;
}

export interface BullQueueEvents {
  close(): Promise<void>;
}

export interface QueueContract<T> {
  queueName: string;
  jobName: string;
  schema: z.ZodType<T>;
}

export type QueueClient<T> = Pick<BullQueue<T>, "add">;
export type RedisConnection = IORedis | RedisOptions;

function createContract<T>(queueName: string, jobName: string, schema: z.ZodType<T>): QueueContract<T> {
  return { queueName, jobName, schema };
}

const bankFeedEntrySchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string().default("AUD"),
  postedAt: z.string(),
  description: z.string().optional(),
});

export const bankFeedIngestContract = createContract(
  "bank-feed.ingest",
  "bank-feed.ingested",
  z.object({
    feedId: z.string(),
    orgId: z.string(),
    source: z.string(),
    entries: z.array(bankFeedEntrySchema).nonempty(),
  })
);
export type BankFeedIngestJob = z.infer<typeof bankFeedIngestContract.schema>;

export const paymentLifecycleContract = createContract(
  "payments.lifecycle",
  "payments.progress",
  z.object({
    payableId: z.string(),
    orgId: z.string(),
    amount: z.number(),
    currency: z.string().default("AUD"),
    dueDate: z.string(),
    supplierName: z.string(),
  })
);
export type PaymentLifecycleJob = z.infer<typeof paymentLifecycleContract.schema>;

export const auditEventContract = createContract(
  "audit.events",
  "audit.record",
  z.object({
    eventId: z.string(),
    entityId: z.string(),
    eventType: z.string(),
    occurredAt: z.string(),
    payload: z.record(z.any()).default({}),
  })
);
export type AuditEventJob = z.infer<typeof auditEventContract.schema>;

async function loadBullmq() {
  try {
    return await import("bullmq");
  } catch (error) {
    throw new Error("bullmq is required. Install it in the workspace before starting queue-enabled services.");
  }
}

export function createRedisConnection(connection: RedisConnection): IORedis {
  if (connection instanceof IORedis) {
    return connection;
  }
  return new IORedis(connection);
}

export async function createQueue<T>(
  contract: QueueContract<T>,
  connection: IORedis,
  options: Omit<QueueOptions, "connection"> = {},
  jobsOptions?: JobsOptions
): Promise<BullQueue<T>> {
  const { Queue } = await loadBullmq();
  const queue = new Queue<T>(contract.queueName, {
    connection,
    sharedConnection: true,
    ...options,
  });
  if (jobsOptions && Object.keys(jobsOptions).length > 0) {
    queue.defaultJobOptions = { ...queue.defaultJobOptions, ...jobsOptions };
  }
  return queue;
}

export async function createWorker<T>(
  contract: QueueContract<T>,
  connection: IORedis,
  handler: (payload: T, job: Job<T>) => unknown | Promise<unknown>,
  options: Omit<WorkerOptions, "connection"> = {}
): Promise<BullWorker<T>> {
  const { Worker } = await loadBullmq();
  return new Worker<T>(
    contract.queueName,
    async (job) => {
      const payload = contract.schema.parse(job.data);
      return handler(payload, job);
    },
    {
      connection,
      ...options,
    }
  );
}

export async function createQueueEvents<T>(contract: QueueContract<T>, connection: IORedis): Promise<BullQueueEvents> {
  const { QueueEvents } = await loadBullmq();
  return new QueueEvents(contract.queueName, { connection });
}

export const queueContracts = {
  bankFeedIngest: bankFeedIngestContract,
  paymentLifecycle: paymentLifecycleContract,
  auditEvent: auditEventContract,
};

