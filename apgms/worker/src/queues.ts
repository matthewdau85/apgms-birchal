import { randomUUID } from 'crypto';
import type { Logger } from './logger.js';

export const QUEUE_NAMES = ['ingestion', 'recon', 'billing', 'exports', 'key-rotate'] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export interface JobContext<T = unknown> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  queue: QueueName;
}

export type Processor<T = unknown> = (job: JobContext<T>) => Promise<void> | void;

export interface QueueSystem {
  enqueue(queue: QueueName, jobName: string, data: unknown): Promise<void>;
  close(): Promise<void>;
}

export async function createQueueSystem(
  processors: Record<QueueName, Processor>,
  logger: Logger,
): Promise<QueueSystem> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const bullmq = await loadBullMq(logger);

    if (bullmq) {
      logger.info({ event: 'queue.driver', driver: 'bullmq', redisUrl }, 'Starting BullMQ queue system');
      return new BullMqQueueSystem(bullmq, processors, logger, redisUrl);
    }

    logger.warn(
      { event: 'queue.driver.fallback', driver: 'in-memory', reason: 'bullmq-unavailable' },
      'BullMQ module unavailable, falling back to in-memory queues',
    );
  }

  logger.info({ event: 'queue.driver', driver: 'in-memory' }, 'Starting in-memory queue system');
  return new InMemoryQueueSystem(processors, logger);
}

class InMemoryQueueSystem implements QueueSystem {
  private readonly queues = new Map<QueueName, InMemoryQueue>();

  constructor(processors: Record<QueueName, Processor>, private readonly logger: Logger) {
    for (const [name, processor] of Object.entries(processors) as [QueueName, Processor][]) {
      this.queues.set(name, new InMemoryQueue(name, processor, this.logger));
    }
  }

  async enqueue(queue: QueueName, jobName: string, data: unknown): Promise<void> {
    const target = this.queues.get(queue);
    if (!target) {
      throw new Error(`Queue ${queue} is not registered`);
    }

    const job = await target.add(jobName, data);
    this.logger.info({ event: 'queue.job.enqueued', queue, jobId: job.id, jobName }, 'Job enqueued');
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));
  }
}

class InMemoryQueue {
  private readonly pending: JobContext[] = [];
  private processing = false;
  private closed = false;

  constructor(
    private readonly queue: QueueName,
    private readonly processor: Processor,
    private readonly logger: Logger,
  ) {}

  async add(jobName: string, data: unknown): Promise<JobContext> {
    if (this.closed) {
      throw new Error(`Queue ${this.queue} has been closed`);
    }

    const job: JobContext = {
      id: randomUUID(),
      name: jobName,
      data,
      attemptsMade: 0,
      queue: this.queue,
    };

    this.pending.push(job);
    this.schedule();

    return job;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending.length = 0;
  }

  private schedule() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    setImmediate(() => {
      void this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    const job = this.pending.shift();

    if (!job) {
      this.processing = false;
      return;
    }

    try {
      await Promise.resolve(this.processor(job));
    } catch (error) {
      this.logger.error(
        { event: 'queue.job.failed', queue: this.queue, jobId: job.id, err: error },
        'Job processing failed',
      );
    } finally {
      if (this.pending.length > 0) {
        setImmediate(() => {
          void this.processNext();
        });
      } else {
        this.processing = false;
      }
    }
  }
}

class BullMqQueueSystem implements QueueSystem {
  private readonly queues = new Map<QueueName, BullQueue>();
  private readonly workers: BullWorker[] = [];

  constructor(
    bullmq: BullmqModule,
    processors: Record<QueueName, Processor>,
    private readonly logger: Logger,
    redisUrl: string,
  ) {
    const connection = parseRedisConnection(redisUrl);

    for (const [name, processor] of Object.entries(processors) as [QueueName, Processor][]) {
      const queue = new bullmq.Queue(name, { connection });
      const worker = new bullmq.Worker(
        name,
        async (job) => {
          const context = mapJob(name, job);
          this.logger.info(
            { event: 'queue.job.received', queue: name, jobId: context.id, jobName: context.name },
            'Job received',
          );

          try {
            await Promise.resolve(processor(context));
          } catch (error) {
            this.logger.error(
              { event: 'queue.job.failed', queue: name, jobId: context.id, err: error },
              'Job processing failed',
            );
            throw error;
          }
        },
        { connection },
      );

      worker.on('error', (error) => {
        this.logger.error({ event: 'queue.worker.error', queue: name, err: error }, 'Worker error');
      });

      this.queues.set(name, queue);
      this.workers.push(worker);
    }
  }

  async enqueue(queue: QueueName, jobName: string, data: unknown): Promise<void> {
    const target = this.queues.get(queue);
    if (!target) {
      throw new Error(`Queue ${queue} is not registered`);
    }

    const job = await target.add(jobName, data);
    const jobId = job?.id != null ? job.id : null;
    this.logger.info({ event: 'queue.job.enqueued', queue, jobId, jobName }, 'Job enqueued');
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values()).map((queue) => queue.close()),
      ...this.workers.map((worker) => worker.close()),
    ]);
  }
}

type BullmqModule = {
  Queue: new (name: string, options?: { connection?: RedisConnectionOptions }) => BullQueue;
  Worker: new (
    name: string,
    processor: (job: BullJob) => Promise<void> | void,
    options?: { connection?: RedisConnectionOptions },
  ) => BullWorker;
};

type BullQueue = {
  add(name: string, data: unknown): Promise<BullJob>;
  close(): Promise<void>;
};

type BullWorker = {
  close(): Promise<void>;
  on(event: 'error', handler: (error: unknown) => void): void;
};

type BullJob = {
  id?: string | number;
  name?: string;
  data: unknown;
  attemptsMade?: number;
};

type RedisConnectionOptions = Record<string, unknown> & {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
};

async function loadBullMq(logger: Logger): Promise<BullmqModule | undefined> {
  try {
    const mod = (await import('bullmq')) as BullmqModule;
    return mod;
  } catch (error) {
    logger.warn({ event: 'queue.bullmq.import_failed', err: error }, 'Failed to load BullMQ module');
    return undefined;
  }
}

function mapJob(queue: QueueName, job: BullJob): JobContext {
  return {
    id: job.id != null ? job.id.toString() : randomUUID(),
    name: job.name ?? 'default',
    data: job.data,
    attemptsMade: job.attemptsMade ?? 0,
    queue,
  };
}

function parseRedisConnection(url: string): RedisConnectionOptions {
  const parsed = new URL(url);
  const connection: RedisConnectionOptions = {
    host: parsed.hostname,
  };

  if (parsed.port) {
    connection.port = Number(parsed.port);
  }

  if (parsed.username) {
    connection.username = parsed.username;
  }

  if (parsed.password) {
    connection.password = parsed.password;
  }

  if (parsed.pathname && parsed.pathname !== '/') {
    const dbIndex = Number(parsed.pathname.replace('/', ''));
    if (!Number.isNaN(dbIndex)) {
      connection.db = dbIndex;
    }
  }

  return connection;
}
