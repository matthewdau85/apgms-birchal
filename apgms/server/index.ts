import { MockRail } from './rails/mockRail.js';
import {
  GateScheduler,
  GateSchedulerOptions,
  createBlockedAccountGate,
  createMaxAmountGate,
} from './scheduler/gates.js';

export interface BootstrapOptions {
  env?: NodeJS.ProcessEnv;
  scheduler?: Partial<GateSchedulerOptions> & {
    enabled?: boolean;
    maxAmount?: number;
    blockedAccounts?: string[];
  };
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
  };
}

export interface ServerContext {
  rail: MockRail;
  scheduler: GateScheduler;
}

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const bootstrapServer = (options: BootstrapOptions = {}): ServerContext => {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  const schedulerEnabled =
    options.scheduler?.enabled ?? parseBoolean(env.MOCK_RAIL_SCHEDULER_ENABLED, true);

  const intervalMs =
    options.scheduler?.intervalMs ?? parseNumber(env.MOCK_RAIL_SCHEDULER_INTERVAL_MS, 5_000);

  const maxAmount =
    options.scheduler?.maxAmount ?? parseNumber(env.MOCK_RAIL_MAX_AMOUNT, 100_000);

  const blockedAccounts =
    options.scheduler?.blockedAccounts ?? parseList(env.MOCK_RAIL_BLOCKED_ACCOUNTS);

  const rail = new MockRail();

  const scheduler = new GateScheduler(rail, {
    ...options.scheduler,
    intervalMs,
    gates: [
      createMaxAmountGate(maxAmount),
      createBlockedAccountGate(blockedAccounts),
      ...(options.scheduler?.gates ?? []),
    ],
    logger,
  });

  if (schedulerEnabled) {
    scheduler.start();
    logger.info?.('Mock rail scheduler started.');
  } else {
    logger.info?.('Mock rail scheduler disabled via configuration.');
  }

  return { rail, scheduler };
};
