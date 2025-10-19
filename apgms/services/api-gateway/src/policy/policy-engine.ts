import { AlertBus } from "./alert-bus";
import { AuditLog } from "./audit-log";
import { AnomalyPipeline } from "./anomaly-pipeline";
import { GateService } from "./gate-service";
import { RemittanceLedger } from "./remittance-ledger";
import { ScheduledQueue } from "./scheduled-queue";
import {
  Clock,
  GateReason,
  RemittanceLedgerEntry,
  RemittanceRequest,
  ScheduledRemittance,
} from "./types";

export interface PolicyEngineResult {
  status: "applied" | "scheduled";
  gateReason?: GateReason;
  scheduled?: ScheduledRemittance;
  ledgerEntry?: RemittanceLedgerEntry;
}

export interface PolicyEngineDependencies {
  gateService: GateService;
  ledger: RemittanceLedger;
  scheduledQueue: ScheduledQueue;
  anomalyPipeline: AnomalyPipeline;
  alertBus: AlertBus;
  auditLog?: AuditLog;
  clock?: Clock;
}

export class PolicyEngine {
  private readonly now: Clock;

  constructor(private readonly deps: PolicyEngineDependencies) {
    this.now = deps.clock ?? (() => new Date());
  }

  async apply(request: RemittanceRequest): Promise<PolicyEngineResult> {
    const anomaly = await this.deps.anomalyPipeline.evaluate(request);

    if (anomaly.severity === "HARD") {
      const closed = this.deps.gateService.close(request.gateId, {
        actorRole: "system",
        reason: "ANOMALY_HARD",
        opensAt: anomaly.opensAt ?? null,
        requireAdminOverride: true,
      });

      this.deps.alertBus.emit({
        type: "ANOMALY_HARD",
        gateId: request.gateId,
        remittanceId: request.id,
        severity: "HARD",
        detail: anomaly.detail,
        metadata: anomaly.metadata,
      });

      this.deps.auditLog?.recordGateClosed({
        gateId: request.gateId,
        actorRole: "system",
        reason: "ANOMALY_HARD",
        opensAt: closed.opensAt ?? null,
        metadata: { source: "anomaly_pipeline", detail: anomaly.detail },
      });
    }

    const gate = this.deps.gateService.getState(request.gateId);
    if (gate.status === "CLOSED") {
      const opensAt = gate.opensAt ?? anomaly.opensAt ?? request.opensAt ?? this.now();
      const scheduled = this.deps.scheduledQueue.enqueue({
        remittanceId: request.id,
        gateId: request.gateId,
        payload: request,
        opensAt,
      });
      return {
        status: "scheduled",
        gateReason: gate.reason,
        scheduled,
      };
    }

    const entry = this.deps.ledger.record({
      remittanceId: request.id,
      gateId: request.gateId,
      amount: request.amount,
    });
    return {
      status: "applied",
      gateReason: gate.reason,
      ledgerEntry: entry,
    };
  }
}
