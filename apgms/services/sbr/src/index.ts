import {
  BaseService,
  type ServiceConfig,
  type ServiceDependencies,
  type SbrSubmitMessage,
  nowIso,
} from "../../../shared/src/index";

interface SbrReportRecord {
  orgId: string;
  batchId: string;
  submittedAt: string;
  reportingPeriod: string;
  reconciliationSummary: SbrSubmitMessage["reconciliationSummary"];
}

export interface SbrServiceConfig extends ServiceConfig {
  channel: string;
}

const DEFAULT_CONFIG: SbrServiceConfig = {
  serviceName: "sbr",
  channel: "test",
};

export class SbrService extends BaseService<SbrServiceConfig> {
  private readonly reports: SbrReportRecord[] = [];

  constructor(config: Partial<SbrServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("sbr.submit", async (message) => {
      await this.handleSubmit(message as SbrSubmitMessage);
    });
  }

  getReports(): SbrReportRecord[] {
    return [...this.reports];
  }

  private async handleSubmit(message: SbrSubmitMessage): Promise<void> {
    this.reports.push({
      orgId: message.orgId,
      batchId: message.batchId,
      submittedAt: message.timestamp,
      reportingPeriod: message.reportingPeriod,
      reconciliationSummary: message.reconciliationSummary,
    });

    this.recordSuccess("submit", { channel: this.config.channel });

    await this.bus.publish({
      type: "audit.log",
      traceId: message.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "sbr_submission",
      entity: `sbr:${message.orgId}:${message.reportingPeriod}`,
      status: "SUCCESS",
      details: {
        batchId: message.batchId,
        channel: this.config.channel,
        settledPayments: message.reconciliationSummary.settledPayments,
      },
    });
  }
}
