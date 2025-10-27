import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

import type { JobData, JobName, JobResult } from '../jobs.js';

const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_DB = 0;

export interface ConnectionOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
}

export interface JobContext<Data, Name extends string> {
  id: string;
  name: Name;
  queueName: Name;
  data: Data;
  attemptsMade: number;
}

export type Processor<
  Data,
  Result,
  Name extends string,
> = (job: JobContext<Data, Name>) => Promise<Result> | Result;

interface InternalJob<Data, Result, Name extends string> {
  context: JobContext<Data, Name>;
  completion: Promise<Result>;
  resolve: (value: Result) => void;
  reject: (error: unknown) => void;
}

const registry = new Map<string, InternalQueue<string>>();

const toRegistryKey = (name: string) => name;

export const buildRedisConnection = (
  overrides: Partial<ConnectionOptions> = {},
): ConnectionOptions => {
  const base: ConnectionOptions = {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.REDIS_PORT ?? `${DEFAULT_REDIS_PORT}`, 10),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: Number.parseInt(process.env.REDIS_DB ?? `${DEFAULT_REDIS_DB}`, 10),
  };

  return {
    ...base,
    ...overrides,
    port: overrides.port ?? base.port,
    db: overrides.db ?? base.db,
  };
};

class InternalQueue<Name extends string> extends EventEmitter {
  private queueRefs = 0;
  private readonly workers = new Set<Worker<any, any, Name>>();
  private readonly watchers = new Set<QueueEvents<Name>>();
  private readonly pendingJobs: InternalJob<any, any, Name>[] = [];
  private dispatchScheduled = false;

  constructor(
    public readonly name: Name,
    public readonly connection: ConnectionOptions,
  ) {
    super();
  }

  createJob<Data, Result>(name: Name, data: Data): InternalJob<Data, Result, Name> {
    let resolve!: (value: Result) => void;
    let reject!: (error: unknown) => void;
    const completion = new Promise<Result>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const job: InternalJob<Data, Result, Name> = {
      context: {
        id: randomUUID(),
        name,
        queueName: this.name,
        data,
        attemptsMade: 0,
      },
      completion,
      resolve,
      reject,
    };

    this.pendingJobs.push(job);
    this.scheduleDispatch();
    return job;
  }

  registerQueueInstance() {
    this.queueRefs += 1;
  }

  unregisterQueueInstance() {
    this.queueRefs = Math.max(0, this.queueRefs - 1);
    this.disposeIfUnused();
  }

  registerWorker(worker: Worker<any, any, Name>) {
    this.workers.add(worker);
    this.scheduleDispatch();
  }

  unregisterWorker(worker: Worker<any, any, Name>) {
    this.workers.delete(worker);
    this.disposeIfUnused();
  }

  registerWatcher(events: QueueEvents<Name>) {
    this.watchers.add(events);
  }

  unregisterWatcher(events: QueueEvents<Name>) {
    this.watchers.delete(events);
    this.disposeIfUnused();
  }

  notifyCompleted(job: InternalJob<any, any, Name>, result: unknown) {
    this.emit('completed', job.context, result);
  }

  notifyFailed(job: InternalJob<any, any, Name>, error: unknown) {
    this.emit('failed', job.context, error);
  }

  dequeueJob(): InternalJob<any, any, Name> | undefined {
    return this.pendingJobs.shift();
  }

  private scheduleDispatch() {
    if (this.dispatchScheduled) {
      return;
    }

    this.dispatchScheduled = true;
    queueMicrotask(() => this.dispatch());
  }

  private dispatch() {
    this.dispatchScheduled = false;

    while (this.pendingJobs.length > 0 && this.workers.size > 0) {
      const job = this.dequeueJob();
      if (!job) {
        break;
      }

      const nextWorker = this.workers.values().next().value;
      if (!nextWorker) {
        this.pendingJobs.unshift(job);
        break;
      }

      nextWorker.handle(job);
    }
  }

  private disposeIfUnused() {
    if (
      this.queueRefs === 0 &&
      this.workers.size === 0 &&
      this.watchers.size === 0 &&
      this.pendingJobs.length === 0
    ) {
      registry.delete(toRegistryKey(this.name));
    }
  }
}

class QueueJob<Data, Result, Name extends string> {
  constructor(private readonly job: InternalJob<Data, Result, Name>) {}

  get id() {
    return this.job.context.id;
  }

  get name() {
    return this.job.context.name;
  }

  get data() {
    return this.job.context.data;
  }

  waitUntilFinished(events: QueueEvents<Name>) {
    return events.waitForJob(this.job);
  }
}

export class Queue<Data, Result, Name extends string> {
  constructor(private readonly internal: InternalQueue<Name>) {
    this.internal.registerQueueInstance();
  }

  async add(name: Name, data: Data) {
    const job = this.internal.createJob<Data, Result>(name, data);
    return new QueueJob<Data, Result, Name>(job);
  }

  async close() {
    this.internal.unregisterQueueInstance();
  }
}

export class QueueEvents<Name extends string> {
  constructor(private readonly internal: InternalQueue<Name>) {
    this.internal.registerWatcher(this);
  }

  waitUntilReady() {
    return Promise.resolve();
  }

  waitForJob<Data, Result>(job: InternalJob<Data, Result, Name>) {
    return job.completion;
  }

  async close() {
    this.internal.unregisterWatcher(this);
  }
}

export class Worker<Data, Result, Name extends string> extends EventEmitter {
  private closed = false;

  constructor(
    private readonly internal: InternalQueue<Name>,
    private readonly processor: Processor<Data, Result, Name>,
  ) {
    super();
    this.internal.registerWorker(this);
  }

  handle(job: InternalJob<Data, Result, Name>) {
    if (this.closed) {
      return;
    }

    job.context.attemptsMade += 1;

    Promise.resolve()
      .then(() => this.processor(job.context))
      .then((result) => {
        job.resolve(result);
        this.emit('completed', job.context, result);
        this.internal.notifyCompleted(job, result);
      })
      .catch((error) => {
        job.reject(error);
        this.emit('failed', job.context, error);
        this.internal.notifyFailed(job, error);
      });
  }

  waitUntilReady() {
    return Promise.resolve();
  }

  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.internal.unregisterWorker(this);
  }
}

const resolveQueue = <Name extends string>(
  name: Name,
  connectionOverrides: Partial<ConnectionOptions>,
): InternalQueue<Name> => {
  const key = toRegistryKey(name);
  const existing = registry.get(key) as InternalQueue<Name> | undefined;

  if (existing) {
    return existing;
  }

  const queue = new InternalQueue<Name>(name, buildRedisConnection(connectionOverrides));
  registry.set(key, queue as unknown as InternalQueue<string>);
  return queue;
};

export const createQueue = <Name extends JobName>(
  name: Name,
  _options: Record<string, unknown> = {},
  connectionOverrides: Partial<ConnectionOptions> = {},
) => {
  const internal = resolveQueue(name, connectionOverrides);
  return new Queue<JobData<Name>, JobResult<Name>, Name>(internal);
};

export const createWorker = <Name extends JobName>(
  name: Name,
  processor: Processor<JobData<Name>, JobResult<Name>, Name>,
  _options: Record<string, unknown> = {},
  connectionOverrides: Partial<ConnectionOptions> = {},
) => {
  const internal = resolveQueue(name, connectionOverrides);
  return new Worker<JobData<Name>, JobResult<Name>, Name>(internal, processor);
};

export const createQueueEvents = <Name extends JobName>(
  name: Name,
  _options: Record<string, unknown> = {},
  connectionOverrides: Partial<ConnectionOptions> = {},
) => {
  const internal = resolveQueue(name, connectionOverrides);
  return new QueueEvents<Name>(internal);
};
