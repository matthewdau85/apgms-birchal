import { auditBlobStore, AuditAlertPayload, AuditBlobWriter } from "@apgms/shared/audit-blobs";

export interface BankLine {
  id: string;
  counterpartyId: string;
  amount: number;
  occurredAt: Date;
  payee: string;
}

export interface AnomalyRuleConfig {
  corridors?: Record<string, { min: number; max: number }>;
  burst?: { threshold: number; windowMinutes: number };
  payeeAllowlist?: Record<string, string[]>;
}

export interface ProcessAnomaliesOptions {
  config: AnomalyRuleConfig;
  store?: AuditBlobWriter;
}

interface BurstStateEntry {
  occurredAt: Date;
  transactionId: string;
}

export function processBankLineAnomalies(bankLines: BankLine[], options: ProcessAnomaliesOptions): AuditAlertPayload[] {
  const { config, store = auditBlobStore } = options;

  const sorted = [...bankLines].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const anomalies: AuditAlertPayload[] = [];

  const burstQueues = new Map<string, BurstStateEntry[]>();
  const lastBurstAt = new Map<string, number>();
  const burstWindowMs = config.burst ? config.burst.windowMinutes * 60 * 1000 : 0;

  for (const line of sorted) {
    const basePayload = {
      counterpartyId: line.counterpartyId,
      transactionId: line.id,
      occurredAt: line.occurredAt.toISOString(),
    };

    // Amount corridor breach per counterparty
    const corridor = config.corridors?.[line.counterpartyId];
    if (corridor && (line.amount < corridor.min || line.amount > corridor.max)) {
      const payload: AuditAlertPayload = {
        ...basePayload,
        rule: "amount_corridor_breach",
        summary: `amount ${line.amount.toFixed(2)} outside corridor [${corridor.min.toFixed(2)}, ${corridor.max.toFixed(2)}]`,
        context: {
          observedAmount: line.amount,
          corridor,
        },
      };
      anomalies.push(payload);
      store.recordAnomaly(payload);
    }

    // Burst frequency detection
    if (config.burst) {
      const queue = burstQueues.get(line.counterpartyId) ?? [];
      queue.push({ occurredAt: line.occurredAt, transactionId: line.id });
      while (queue.length > 0 && line.occurredAt.getTime() - queue[0].occurredAt.getTime() > burstWindowMs) {
        queue.shift();
      }
      burstQueues.set(line.counterpartyId, queue);

      if (queue.length >= config.burst.threshold) {
        const lastTriggered = lastBurstAt.get(line.counterpartyId) ?? 0;
        if (line.occurredAt.getTime() - lastTriggered >= burstWindowMs) {
          const payload: AuditAlertPayload = {
            ...basePayload,
            rule: "burst_frequency",
            summary: `burst of ${queue.length} payments detected within ${config.burst.windowMinutes} minutes`,
            context: {
              windowMinutes: config.burst.windowMinutes,
              transactionIds: queue.map((entry) => entry.transactionId),
            },
          };
          anomalies.push(payload);
          store.recordAnomaly(payload);
          lastBurstAt.set(line.counterpartyId, line.occurredAt.getTime());
        }
      }
    }

    // New payee outside allowlist
    const allowlist = config.payeeAllowlist?.[line.counterpartyId];
    if (allowlist && !allowlist.includes(line.payee)) {
      const payload: AuditAlertPayload = {
        ...basePayload,
        rule: "new_payee",
        summary: `payee ${line.payee} is not in allowlist`,
        context: {
          payee: line.payee,
          allowlist,
        },
      };
      anomalies.push(payload);
      store.recordAnomaly(payload);
    }
  }

  return anomalies;
}
