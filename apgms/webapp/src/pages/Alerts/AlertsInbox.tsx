import { useEffect, useMemo, useState } from "react";
import type {
  AlertFilters,
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  AlertStatusChange,
} from "../../../../shared/src/alerts";

type StatusFilter = AlertStatus | "ALL";

type InitialFilters = Pick<AlertFilters, "ruleIds" | "severity" | "search"> & {
  status?: StatusFilter;
};

export interface AlertsInboxProps {
  alerts: AlertRecord[];
  initialFilters?: InitialFilters;
  onAlertStatusChange?: (change: AlertStatusChange) => void;
}

type AlertState = AlertRecord & { isLocal?: boolean };

const normalizeAlert = (alert: AlertRecord): AlertState => ({
  ...alert,
  createdAt: alert.createdAt instanceof Date ? alert.createdAt : new Date(alert.createdAt),
  updatedAt: alert.updatedAt instanceof Date ? alert.updatedAt : new Date(alert.updatedAt),
  readAt:
    alert.readAt == null
      ? null
      : alert.readAt instanceof Date
      ? alert.readAt
      : new Date(alert.readAt),
});

const normalizeAlerts = (alerts: AlertRecord[]): AlertState[] => alerts.map((alert) => normalizeAlert(alert));

const mergeAlerts = (existing: AlertState[], incoming: AlertRecord[]): AlertState[] => {
  const merged = new Map(existing.map((alert) => [alert.id, alert]));
  for (const alert of incoming) {
    const current = merged.get(alert.id);
    merged.set(alert.id, { ...(current ?? {}), ...normalizeAlert(alert) });
  }
  return Array.from(merged.values());
};

const computeUnreadCount = (alerts: AlertState[]): number =>
  alerts.filter((alert) => alert.status === "UNREAD").length;

const severityOrder: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const formatDate = (value: Date): string =>
  value.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const statusLabel: Record<AlertStatus, string> = {
  READ: "Read",
  UNREAD: "Unread",
};

const severityLabel: Record<AlertSeverity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const AlertsInbox = ({
  alerts,
  initialFilters,
  onAlertStatusChange,
}: AlertsInboxProps) => {
  const [items, setItems] = useState<AlertState[]>(() => normalizeAlerts(alerts));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilters?.status ?? "ALL");
  const [ruleFilter, setRuleFilter] = useState<string | "ALL">(
    initialFilters?.ruleIds?.[0] ?? "ALL"
  );
  const [severityFilter, setSeverityFilter] = useState<Set<AlertSeverity>>(
    new Set(initialFilters?.severity ?? [])
  );
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search ?? "");

  useEffect(() => {
    setItems((prev) => mergeAlerts(prev, alerts));
  }, [alerts]);

  const unreadCount = useMemo(() => computeUnreadCount(items), [items]);

  const ruleOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const alert of items) {
      unique.set(alert.ruleId, alert.ruleId);
    }
    return Array.from(unique.keys()).sort();
  }, [items]);

  const toggleSeverity = (severity: AlertSeverity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const filteredAlerts = useMemo(() => {
    return items
      .filter((alert) => {
        if (statusFilter !== "ALL" && alert.status !== statusFilter) {
          return false;
        }
        if (ruleFilter !== "ALL" && alert.ruleId !== ruleFilter) {
          return false;
        }
        if (severityFilter.size > 0 && !severityFilter.has(alert.severity)) {
          return false;
        }
        if (searchTerm.trim()) {
          const query = searchTerm.trim().toLowerCase();
          const haystack = `${alert.summary} ${alert.details ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [items, statusFilter, ruleFilter, severityFilter, searchTerm]);

  const handleToggleStatus = (alert: AlertState) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== alert.id) return item;
        const nextStatus: AlertStatus = item.status === "READ" ? "UNREAD" : "READ";
        const readAt = nextStatus === "READ" ? new Date() : null;
        const nextItem: AlertState = { ...item, status: nextStatus, readAt, isLocal: true };
        onAlertStatusChange?.({ id: item.id, status: nextStatus, readAt: readAt ?? undefined });
        return nextItem;
      })
    );
  };

  return (
    <div className="alerts-inbox" aria-live="polite">
      <header className="alerts-inbox__header">
        <div>
          <h2>Alerts Inbox</h2>
          <p aria-label="Unread alerts">Unread: {unreadCount}</p>
        </div>
        <div className="alerts-inbox__filters">
          <div className="alerts-inbox__filter-group" role="group" aria-label="Status filter">
            {(["ALL", "UNREAD", "READ"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`alerts-inbox__filter-button${statusFilter === status ? " alerts-inbox__filter-button--active" : ""}`}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === "ALL" ? "All" : statusLabel[status]}
              </button>
            ))}
          </div>
          <label className="alerts-inbox__filter">
            <span>Rule</span>
            <select value={ruleFilter} onChange={(event) => setRuleFilter(event.target.value as any)}>
              <option value="ALL">All rules</option>
              {ruleOptions.map((ruleId) => (
                <option key={ruleId} value={ruleId}>
                  {ruleId}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="alerts-inbox__filter" aria-label="Severity filter">
            <legend>Severity</legend>
            <div className="alerts-inbox__severity-options">
              {severityOrder.map((severity) => (
                <label key={severity}>
                  <input
                    type="checkbox"
                    checked={severityFilter.has(severity)}
                    onChange={() => toggleSeverity(severity)}
                  />
                  {severityLabel[severity]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="alerts-inbox__filter alerts-inbox__search">
            <span className="visually-hidden">Search alerts</span>
            <input
              type="search"
              placeholder="Search alerts"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>
      </header>
      <section className="alerts-inbox__list" aria-live="polite">
        {filteredAlerts.length === 0 ? (
          <p className="alerts-inbox__empty">No alerts match the selected filters.</p>
        ) : (
          <ul>
            {filteredAlerts.map((alert) => (
              <li
                key={alert.id}
                className={`alerts-inbox__item alerts-inbox__item--${alert.status.toLowerCase()}`}
              >
                <div className="alerts-inbox__item-header">
                  <span className="alerts-inbox__summary">{alert.summary}</span>
                  <span className={`alerts-inbox__badge alerts-inbox__badge--${alert.severity.toLowerCase()}`}>
                    {severityLabel[alert.severity]}
                  </span>
                </div>
                {alert.details ? <p className="alerts-inbox__details">{alert.details}</p> : null}
                <dl className="alerts-inbox__meta">
                  <div>
                    <dt>Status</dt>
                    <dd>{statusLabel[alert.status]}</dd>
                  </div>
                  <div>
                    <dt>Rule</dt>
                    <dd>{alert.ruleId}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(alert.createdAt)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => handleToggleStatus(alert)}>
                  {alert.status === "READ" ? "Mark unread" : "Mark read"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AlertsInbox;
