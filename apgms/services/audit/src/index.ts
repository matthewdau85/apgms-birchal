import {
  BaseService,
  type AuditLogMessage,
  type ServiceDependencies,
  type ServiceConfig,
} from "../../../shared/src/index";

export interface AuditServiceConfig extends ServiceConfig {
  retention: number;
}

export interface AuditLogEntry {
  traceId: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  status: "SUCCESS" | "FAILURE";
  reason?: string;
  details?: Record<string, unknown>;
}

const DEFAULT_CONFIG: AuditServiceConfig = {
  serviceName: "audit",
  retention: 1000,
};

export class AuditService extends BaseService<AuditServiceConfig> {
  private readonly entries: AuditLogEntry[] = [];

  constructor(config: Partial<AuditServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("audit.log", async (message) => {
      await this.handleAuditMessage(message as AuditLogMessage);
    });
  }

  private async handleAuditMessage(message: AuditLogMessage): Promise<void> {
    this.logInfo(`recording audit event for ${message.entity}`, {
      action: message.action,
      status: message.status,
    });

    this.entries.push({
      traceId: message.traceId,
      timestamp: message.timestamp,
      actor: message.actor,
      action: message.action,
      entity: message.entity,
      status: message.status,
      reason: message.reason,
      details: message.details,
    });

    if (this.entries.length > this.config.retention) {
      this.entries.splice(0, this.entries.length - this.config.retention);
    }

    this.recordSuccess("log", { entity: message.entity });
  }

  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }
}
