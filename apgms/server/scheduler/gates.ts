import { MockRail, TransferReceipt, TransferRequest } from '../rails/mockRail.js';

export type TransferGate = (request: TransferRequest) => void | Promise<void>;

export interface ScheduledTransfer {
  id: string;
  request: TransferRequest;
  runAt?: Date;
}

export interface TransferRejection {
  job: ScheduledTransfer & { runAt: Date };
  reason: string;
}

export interface TransferSettlement {
  job: ScheduledTransfer & { runAt: Date };
  receipt: TransferReceipt;
}

export interface ProcessingSummary {
  settled: TransferSettlement[];
  rejected: TransferRejection[];
}

export interface SchedulerLogger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}

export interface GateSchedulerOptions {
  gates?: TransferGate[];
  intervalMs?: number;
  clock?: () => Date;
  logger?: SchedulerLogger;
  onSettled?: (settlement: TransferSettlement) => void;
  onRejected?: (rejection: TransferRejection) => void;
}

const defaultClock = () => new Date();

export class GateScheduler {
  private readonly gates: TransferGate[];
  private readonly clock: () => Date;
  private readonly logger: SchedulerLogger;
  private queue: Array<ScheduledTransfer & { runAt: Date }> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly rail: MockRail,
    private readonly options: GateSchedulerOptions = {}
  ) {
    this.gates = [...(options.gates ?? [])];
    this.clock = options.clock ?? defaultClock;
    this.logger = options.logger ?? console;
  }

  public registerGate(gate: TransferGate): void {
    this.gates.push(gate);
  }

  public enqueue(job: ScheduledTransfer): void {
    const runAt = job.runAt ?? this.clock();
    this.queue.push({ ...job, runAt });
    this.queue.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    const interval = this.options.intervalMs ?? 1_000;

    this.timer = setInterval(() => {
      void this.processDueJobs();
    }, interval);

    void this.processDueJobs();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.running = false;
  }

  public async processDueJobs(now: Date = this.clock()): Promise<ProcessingSummary> {
    const due: Array<ScheduledTransfer & { runAt: Date }> = [];
    const remaining: Array<ScheduledTransfer & { runAt: Date }> = [];

    for (const job of this.queue) {
      if (job.runAt.getTime() <= now.getTime()) {
        due.push(job);
      } else {
        remaining.push(job);
      }
    }

    this.queue = remaining;

    const summary: ProcessingSummary = { settled: [], rejected: [] };

    for (const job of due) {
      try {
        for (const gate of this.gates) {
          await gate(job.request);
        }

        const receipt = await this.rail.transfer(job.request);
        const settlement: TransferSettlement = { job, receipt };
        summary.settled.push(settlement);
        this.options.onSettled?.(settlement);
        this.logger.info?.(`Transfer ${job.id} settled.`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const rejection: TransferRejection = { job, reason };
        summary.rejected.push(rejection);
        this.options.onRejected?.(rejection);
        this.logger.warn?.(`Transfer ${job.id} rejected: ${reason}`);
      }
    }

    return summary;
  }
}

export const createMaxAmountGate = (limit: number): TransferGate => {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('Transfer amount limit must be a positive number.');
  }

  return (request) => {
    if (request.amount > limit) {
      throw new Error(`Transfer amount ${request.amount} exceeds limit of ${limit}.`);
    }
  };
};

export const createBlockedAccountGate = (blocked: Iterable<string>): TransferGate => {
  const blockedSet = new Set(blocked);

  return (request) => {
    if (blockedSet.has(request.fromAccountId) || blockedSet.has(request.toAccountId)) {
      throw new Error('Transfer involves a blocked account.');
    }
  };
};
