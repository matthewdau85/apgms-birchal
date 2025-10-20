import { Gate } from './gate.js';

export interface RemittanceJob {
  readonly id: string;
  readonly attempt: number;
}

interface LeaseRecord {
  readonly owner: string;
  readonly expiresAt: number;
  readonly job: RemittanceJob;
}

export interface LeaseOptions {
  readonly owner: string;
  readonly ttlMs?: number;
}

export interface ReleaseOptions {
  readonly requeue?: boolean;
  readonly delayMs?: number;
}

type Clock = () => number;

export class InMemoryRemittanceQueue {
  private readonly order: string[] = [];
  private readonly pending = new Map<string, RemittanceJob>();
  private readonly leased = new Map<string, LeaseRecord>();

  constructor(
    private readonly gate: Gate,
    private readonly defaultTtlMs: number = 5_000,
    private readonly clock: Clock = () => Date.now(),
  ) {}

  enqueue(id: string): boolean {
    if (this.pending.has(id) || this.leased.has(id)) {
      return false;
    }

    const job: RemittanceJob = {
      id,
      attempt: 0,
    };

    this.pending.set(id, job);
    this.order.push(id);
    return true;
  }

  async leaseNext(options: LeaseOptions): Promise<RemittanceJob | undefined> {
    if (!this.gate.isOpen()) {
      return undefined;
    }

    const ttlMs = options.ttlMs ?? this.defaultTtlMs;

    while (this.order.length > 0) {
      const id = this.order.shift();
      if (!id) {
        continue;
      }

      const pending = this.pending.get(id);
      if (!pending) {
        continue;
      }

      const existingLease = this.leased.get(id);
      if (existingLease && existingLease.expiresAt > this.clock()) {
        // Lease is still active, skip this job.
        this.order.push(id);
        continue;
      }

      const job: RemittanceJob = {
        id,
        attempt: pending.attempt + 1,
      };

      const record: LeaseRecord = {
        owner: options.owner,
        expiresAt: this.clock() + ttlMs,
        job,
      };

      this.pending.delete(id);
      this.leased.set(id, record);
      return job;
    }

    return undefined;
  }

  ack(id: string, owner: string): boolean {
    const lease = this.leased.get(id);
    if (!lease || lease.owner !== owner) {
      return false;
    }

    this.leased.delete(id);
    return true;
  }

  release(id: string, owner: string, options: ReleaseOptions = {}): boolean {
    const lease = this.leased.get(id);
    if (!lease || lease.owner !== owner) {
      return false;
    }

    this.leased.delete(id);

    if (!options.requeue) {
      return true;
    }

    const job: RemittanceJob = {
      id: lease.job.id,
      attempt: lease.job.attempt,
    };

    const requeue = () => {
      this.pending.set(id, job);
      this.order.push(id);
    };

    if (options.delayMs && options.delayMs > 0) {
      setTimeout(requeue, options.delayMs);
    } else {
      requeue();
    }

    return true;
  }

  isPending(id: string): boolean {
    return this.pending.has(id) || this.order.includes(id);
  }
}
