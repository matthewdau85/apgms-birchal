import { listOpenGateOrgIds, getGateId } from "@apgms/shared/gates";
import { recordAuditBlob } from "@apgms/shared/audit-blob";
import { getRedisClient, type RedisClient } from "@apgms/services-shared/redis";
import { remit as sendRemittance } from "@apgms/payments/adapters/payto.mock";

type RemitJob = {
  jobId: string;
  orgId: string;
  agreementId: string;
  amountCents: number;
  currency: "AUD";
  queuedAt: string;
};

type GateSchedulerOptions = {
  pollIntervalMs?: number;
  redis?: RedisClient;
};

export class GateScheduler {
  private readonly pollMs: number;
  private readonly redis: RedisClient;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: GateSchedulerOptions = {}) {
    this.pollMs = options.pollIntervalMs ?? Number(process.env.GATE_POLL_MS ?? 2000);
    this.redis = options.redis ?? getRedisClient();
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("gate scheduler tick failed", err);
      });
    }, this.pollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    const openOrgs = listOpenGateOrgIds();
    for (const orgId of openOrgs) {
      const queueKey = `remit:${orgId}`;
      while (true) {
        const rawJob = await this.redis.lpop(queueKey);
        if (!rawJob) {
          break;
        }
        const job = JSON.parse(rawJob) as RemitJob;
        const result = await sendRemittance({
          orgId: job.orgId,
          agreementId: job.agreementId,
          amountCents: job.amountCents,
          currency: job.currency,
        });

        await recordAuditBlob({
          kind: "payto.remit.sent",
          payloadJson: {
            jobId: job.jobId,
            remittanceId: result.remittanceId,
            orgId: job.orgId,
            agreementId: job.agreementId,
            amountCents: job.amountCents,
            currency: job.currency,
          },
          orgId: job.orgId,
          gateId: getGateId(job.orgId),
        });
      }
    }
  }
}

export function createGateScheduler(options?: GateSchedulerOptions): GateScheduler {
  return new GateScheduler(options);
}
