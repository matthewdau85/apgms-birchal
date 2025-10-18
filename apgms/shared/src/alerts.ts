export type AlertStatus = "UNREAD" | "READ";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AlertRecord {
  id: string;
  orgId: string;
  ruleId: string;
  summary: string;
  details?: string | null;
  status: AlertStatus;
  severity: AlertSeverity;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date | null;
  bankLineId?: string | null;
}

export interface AlertFilters {
  orgId?: string;
  status?: AlertStatus | "ALL";
  ruleIds?: string[];
  severity?: AlertSeverity[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AlertStatusChange {
  id: string;
  status: AlertStatus;
  readAt?: Date | null;
}
