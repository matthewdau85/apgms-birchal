import type { MessageBus } from "./messaging";
import type { Telemetry } from "./telemetry";

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ServiceConfig {
  serviceName: string;
}

export interface ServiceDependencies {
  bus: MessageBus;
  telemetry: Telemetry;
  logger?: Logger;
}

export abstract class BaseService<C extends ServiceConfig> {
  protected readonly config: C;
  protected readonly bus: MessageBus;
  protected readonly telemetry: Telemetry;
  protected readonly logger: Logger;

  protected constructor(config: C, deps: ServiceDependencies) {
    this.config = config;
    this.bus = deps.bus;
    this.telemetry = deps.telemetry;
    this.logger = deps.logger ?? consoleLogger(config.serviceName);
  }

  protected logInfo(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(`[${this.config.serviceName}] ${message}`, meta);
  }

  protected logWarn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(`[${this.config.serviceName}] ${message}`, meta);
  }

  protected logError(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(`[${this.config.serviceName}] ${message}`, meta);
  }

  protected recordFailure(metric: string, meta?: Record<string, string>): void {
    this.telemetry.increment(`${this.config.serviceName}.${metric}.failures`, 1, meta);
  }

  protected recordSuccess(metric: string, meta?: Record<string, string>): void {
    this.telemetry.increment(`${this.config.serviceName}.${metric}.success`, 1, meta);
  }
}

const consoleLogger = (serviceName: string): Logger => ({
  info(message, meta) {
    console.log(message, meta);
  },
  warn(message, meta) {
    console.warn(message, meta);
  },
  error(message, meta) {
    console.error(message, meta);
  },
});
