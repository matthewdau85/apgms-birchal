import {
  BaseService,
  type RegistryInstruction,
  type RegistryUpdateMessage,
  type ServiceConfig,
  type ServiceDependencies,
  nowIso,
} from "../../../shared/src/index";

interface RegistryRecord {
  orgId: string;
  batchId: string;
  recordedAt: string;
  instruction: RegistryInstruction;
  reconciliationSummary: RegistryUpdateMessage["reconciliationSummary"];
}

export interface RegistriesServiceConfig extends ServiceConfig {
  allowedRegistries: string[];
}

const DEFAULT_CONFIG: RegistriesServiceConfig = {
  serviceName: "registries",
  allowedRegistries: ["asic", "abr"],
};

export class RegistriesService extends BaseService<RegistriesServiceConfig> {
  private readonly records = new Map<string, RegistryRecord[]>();

  constructor(config: Partial<RegistriesServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("registries.update", async (message) => {
      await this.handleUpdate(message as RegistryUpdateMessage);
    });
  }

  getRegistryRecords(): Record<string, RegistryRecord[]> {
    return Object.fromEntries([...this.records.entries()].map(([registry, items]) => [registry, [...items]]));
  }

  private async handleUpdate(message: RegistryUpdateMessage): Promise<void> {
    const registry = message.instruction.registry;
    const allowed = this.config.allowedRegistries.includes(registry);
    if (!allowed) {
      this.recordFailure("update", { registry });
      await this.publishAudit(message, "FAILURE", "UNSUPPORTED_REGISTRY");
      return;
    }

    const entries = this.records.get(registry) ?? [];
    const record: RegistryRecord = {
      orgId: message.orgId,
      batchId: message.batchId,
      recordedAt: message.timestamp,
      instruction: {
        registry,
        changes: { ...message.instruction.changes },
      },
      reconciliationSummary: message.reconciliationSummary,
    };
    entries.push(record);
    this.records.set(registry, entries);

    this.recordSuccess("update", { registry });
    await this.publishAudit(message, "SUCCESS");
  }

  private async publishAudit(
    message: RegistryUpdateMessage,
    status: "SUCCESS" | "FAILURE",
    reason?: string,
  ): Promise<void> {
    await this.bus.publish({
      type: "audit.log",
      traceId: message.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "registry_update",
      entity: `${message.instruction.registry}:${message.orgId}`,
      status,
      reason,
      details: {
        batchId: message.batchId,
        changes: message.instruction.changes,
      },
    });
  }
}
