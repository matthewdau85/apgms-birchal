import {
  MessageBus,
  Telemetry,
  createTraceId,
  nowIso,
  type Logger,
} from "../../shared/src/index";
import { AuditService, type AuditServiceConfig } from "../../services/audit/src/index";
import {
  ConnectorsService,
  type ConnectorsServiceConfig,
} from "../../services/connectors/src/index";
import { CdrService, type CdrServiceConfig } from "../../services/cdr/src/index";
import {
  PaymentsService,
  type PaymentsServiceConfig,
} from "../../services/payments/src/index";
import {
  ReconciliationService,
  type ReconciliationServiceConfig,
} from "../../services/recon/src/index";
import {
  RegistriesService,
  type RegistriesServiceConfig,
} from "../../services/registries/src/index";
import { SbrService, type SbrServiceConfig } from "../../services/sbr/src/index";

export interface WorkflowConfig {
  audit?: Partial<AuditServiceConfig>;
  connectors?: Partial<ConnectorsServiceConfig>;
  cdr?: Partial<CdrServiceConfig>;
  payments?: Partial<PaymentsServiceConfig>;
  reconciliation?: Partial<ReconciliationServiceConfig>;
  registries?: Partial<RegistriesServiceConfig>;
  sbr?: Partial<SbrServiceConfig>;
  logger?: Logger;
}

export class WorkflowOrchestrator {
  private readonly bus = new MessageBus();
  private readonly telemetry = new Telemetry();

  private readonly auditService: AuditService;
  private readonly connectorsService: ConnectorsService;
  private readonly cdrService: CdrService;
  private readonly paymentsService: PaymentsService;
  private readonly reconciliationService: ReconciliationService;
  private readonly registriesService: RegistriesService;
  private readonly sbrService: SbrService;

  constructor(private readonly config: WorkflowConfig = {}) {
    const deps = {
      bus: this.bus,
      telemetry: this.telemetry,
      logger: config.logger,
    };

    this.auditService = new AuditService(config.audit ?? {}, deps);
    this.connectorsService = new ConnectorsService(config.connectors ?? {}, deps);
    this.cdrService = new CdrService(config.cdr ?? {}, deps);
    this.paymentsService = new PaymentsService(config.payments ?? {}, deps);
    this.reconciliationService = new ReconciliationService(config.reconciliation ?? {}, deps);
    this.registriesService = new RegistriesService(config.registries ?? {}, deps);
    this.sbrService = new SbrService(config.sbr ?? {}, deps);
  }

  async triggerConnectorSync(
    orgId: string,
    connectorId: string,
    trigger: "manual" | "scheduled" = "manual",
  ): Promise<string> {
    const traceId = createTraceId();
    await this.bus.publish({
      type: "connectors.sync.request",
      traceId,
      timestamp: nowIso(),
      orgId,
      connectorId,
      trigger,
    });
    return traceId;
  }

  getState(): {
    auditLogs: ReturnType<AuditService["getEntries"]>;
    ingestions: ReturnType<CdrService["getIngestions"]>;
    payments: ReturnType<PaymentsService["getPayments"]>;
    reconciliations: ReturnType<ReconciliationService["getCompletedBatches"]>;
    registries: ReturnType<RegistriesService["getRegistryRecords"]>;
    reports: ReturnType<SbrService["getReports"]>;
  } {
    return {
      auditLogs: this.auditService.getEntries(),
      ingestions: this.cdrService.getIngestions(),
      payments: this.paymentsService.getPayments(),
      reconciliations: this.reconciliationService.getCompletedBatches(),
      registries: this.registriesService.getRegistryRecords(),
      reports: this.sbrService.getReports(),
    };
  }

  getTelemetrySnapshot(): ReturnType<Telemetry["snapshot"]> {
    return this.telemetry.snapshot();
  }
}
