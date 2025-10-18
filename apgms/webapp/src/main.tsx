type AlertRecord = {
  id: string;
  orgId: string;
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "ACKNOWLEDGED" | "ESCALATED";
  summary: string;
  detectedAt: string;
  counterExample?: Array<{
    reason: string;
    transaction: {
      payee: string;
      amount: number;
      date: string;
      category?: string | null;
    };
  }>;
};

type FilterState = {
  status: string;
  ruleId: string;
  severity: string;
  orgId: string;
};

type TransitionAction = "ack" | "escalate";

const STATUS_OPTIONS: AlertRecord["status"][] = ["OPEN", "ACKNOWLEDGED", "ESCALATED"];
const RULE_OPTIONS = ["velocity_spike", "novel_counterparty", "allocation_drift"];
const SEVERITY_OPTIONS: AlertRecord["severity"][] = ["LOW", "MEDIUM", "HIGH"];

const state: {
  alerts: AlertRecord[];
  filters: FilterState;
  selected: Set<string>;
  loading: boolean;
  error: string | null;
} = {
  alerts: [],
  filters: { status: "OPEN", ruleId: "all", severity: "all", orgId: "all" },
  selected: new Set(),
  loading: false,
  error: null,
};

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root container");
}

const layout = document.createElement("div");
layout.style.padding = "1.5rem";
layout.style.fontFamily = "Inter, system-ui, sans-serif";
layout.style.display = "flex";
layout.style.flexDirection = "column";
layout.style.gap = "1rem";

const header = document.createElement("header");
header.style.display = "flex";
header.style.alignItems = "center";
header.style.gap = "1rem";

const title = document.createElement("h1");
title.textContent = "Alerts inbox";
title.style.margin = "0";
header.appendChild(title);

const refreshButton = document.createElement("button");
refreshButton.textContent = "Refresh";
refreshButton.addEventListener("click", () => fetchAlerts());
header.appendChild(refreshButton);

const filtersContainer = document.createElement("section");
filtersContainer.style.display = "flex";
filtersContainer.style.flexWrap = "wrap";
filtersContainer.style.gap = "1rem";
filtersContainer.style.background = "#f7f7f9";
filtersContainer.style.padding = "1rem";
filtersContainer.style.borderRadius = "0.5rem";
filtersContainer.style.fontSize = "0.9rem";

const statusSelect = document.createElement("select");
const ruleSelect = document.createElement("select");
const severitySelect = document.createElement("select");
const orgInput = document.createElement("input");

const messageArea = document.createElement("div");
const tableContainer = document.createElement("section");
const bulkActions = document.createElement("section");

layout.appendChild(header);
layout.appendChild(filtersContainer);
layout.appendChild(messageArea);
layout.appendChild(tableContainer);
layout.appendChild(bulkActions);
root.appendChild(layout);

const createLabel = (text: string) => {
  const label = document.createElement("label");
  label.style.display = "flex";
  label.style.flexDirection = "column";
  label.style.gap = "0.25rem";
  const span = document.createElement("span");
  span.textContent = text;
  label.appendChild(span);
  return label;
};

const buildSelectOptions = (select: HTMLSelectElement, values: string[], includeAll = true) => {
  select.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = `All ${select.dataset.label ?? "items"}`;
    select.appendChild(opt);
  }
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
};

const syncFiltersUI = () => {
  statusSelect.value = state.filters.status;
  ruleSelect.value = state.filters.ruleId;
  severitySelect.value = state.filters.severity;
  orgInput.value = state.filters.orgId === "all" ? "" : state.filters.orgId;
};

const renderMessage = () => {
  messageArea.innerHTML = "";
  if (state.error) {
    const errorDiv = document.createElement("div");
    errorDiv.textContent = `Error: ${state.error}`;
    errorDiv.style.color = "#b00020";
    messageArea.appendChild(errorDiv);
  } else if (state.loading) {
    const loadingDiv = document.createElement("div");
    loadingDiv.textContent = "Loading alerts…";
    messageArea.appendChild(loadingDiv);
  }
};

const renderTable = () => {
  tableContainer.innerHTML = "";
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.borderBottom = "1px solid #ddd";
  const headings = ["", "Rule", "Severity", "Summary", "Detected", "Counter example", "Status", "Actions"];
  for (const heading of headings) {
    const th = document.createElement("th");
    th.textContent = heading;
    th.style.textAlign = "left";
    th.style.padding = "0.5rem";
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const alert of state.alerts) {
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid #f0f0f0";

    const selectCell = document.createElement("td");
    selectCell.style.padding = "0.5rem";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(alert.id);
    checkbox.addEventListener("change", () => toggleSelection(alert.id));
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    const ruleCell = document.createElement("td");
    ruleCell.textContent = alert.ruleId;
    ruleCell.style.padding = "0.5rem";
    ruleCell.style.fontFamily = "monospace";
    row.appendChild(ruleCell);

    const severityCell = document.createElement("td");
    severityCell.textContent = alert.severity;
    severityCell.style.padding = "0.5rem";
    severityCell.style.fontWeight = "600";
    if (alert.severity === "HIGH") {
      severityCell.style.color = "#b00020";
    } else if (alert.severity === "MEDIUM") {
      severityCell.style.color = "#c17d00";
    } else {
      severityCell.style.color = "#2b7a0b";
    }
    row.appendChild(severityCell);

    const summaryCell = document.createElement("td");
    summaryCell.textContent = alert.summary;
    summaryCell.style.padding = "0.5rem";
    row.appendChild(summaryCell);

    const detectedCell = document.createElement("td");
    detectedCell.textContent = new Date(alert.detectedAt).toLocaleString();
    detectedCell.style.padding = "0.5rem";
    row.appendChild(detectedCell);

    const counterCell = document.createElement("td");
    counterCell.style.padding = "0.5rem";
    counterCell.style.fontSize = "0.85rem";
    counterCell.style.color = "#444";
    const counter = alert.counterExample?.[0];
    if (counter) {
      const reason = document.createElement("div");
      reason.textContent = counter.reason;
      reason.style.fontWeight = "600";
      const detail = document.createElement("div");
      detail.textContent = `${counter.transaction.payee} on ${new Date(counter.transaction.date).toLocaleDateString()} for $${counter.transaction.amount.toFixed(2)}`;
      counterCell.appendChild(reason);
      counterCell.appendChild(detail);
    } else {
      counterCell.textContent = "—";
    }
    row.appendChild(counterCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = alert.status;
    statusCell.style.padding = "0.5rem";
    row.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    actionsCell.style.padding = "0.5rem";
    actionsCell.style.display = "flex";
    actionsCell.style.gap = "0.5rem";

    const ackButton = document.createElement("button");
    ackButton.textContent = "Ack";
    ackButton.disabled = alert.status !== "OPEN";
    ackButton.addEventListener("click", () => transitionAlert(alert.id, "ack"));
    actionsCell.appendChild(ackButton);

    const escalateButton = document.createElement("button");
    escalateButton.textContent = "Escalate";
    escalateButton.disabled = alert.status === "ESCALATED";
    escalateButton.addEventListener("click", () => transitionAlert(alert.id, "escalate"));
    actionsCell.appendChild(escalateButton);

    row.appendChild(actionsCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);

  const selectAllHeader = headerRow.firstElementChild as HTMLTableCellElement;
  selectAllHeader.innerHTML = "";
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAll.checked = state.alerts.length > 0 && state.selected.size === state.alerts.length;
  selectAll.addEventListener("change", (event) => toggleAll((event.target as HTMLInputElement).checked));
  selectAllHeader.appendChild(selectAll);

  tableContainer.appendChild(table);
};

const renderBulkActions = () => {
  bulkActions.innerHTML = "";
  bulkActions.style.display = "flex";
  bulkActions.style.gap = "0.5rem";
  bulkActions.style.alignItems = "center";

  const ackSelected = document.createElement("button");
  ackSelected.textContent = "Ack selected";
  ackSelected.disabled = state.selected.size === 0;
  ackSelected.addEventListener("click", () => transitionAlertBulk("ack"));
  bulkActions.appendChild(ackSelected);

  const escalateSelected = document.createElement("button");
  escalateSelected.textContent = "Escalate selected";
  escalateSelected.disabled = state.selected.size === 0;
  escalateSelected.addEventListener("click", () => transitionAlertBulk("escalate"));
  bulkActions.appendChild(escalateSelected);

  const summary = document.createElement("span");
  summary.textContent = `${state.selected.size} selected`;
  summary.style.marginLeft = "auto";
  summary.style.fontSize = "0.85rem";
  summary.style.color = "#555";
  bulkActions.appendChild(summary);
};

const renderFilters = () => {
  filtersContainer.innerHTML = "";

  statusSelect.dataset.label = "statuses";
  ruleSelect.dataset.label = "rules";
  severitySelect.dataset.label = "severities";

  buildSelectOptions(statusSelect, STATUS_OPTIONS, true);
  buildSelectOptions(ruleSelect, RULE_OPTIONS, true);
  buildSelectOptions(severitySelect, SEVERITY_OPTIONS, true);

  statusSelect.addEventListener("change", () => {
    state.filters.status = statusSelect.value;
    fetchAlerts();
  });
  ruleSelect.addEventListener("change", () => {
    state.filters.ruleId = ruleSelect.value;
    fetchAlerts();
  });
  severitySelect.addEventListener("change", () => {
    state.filters.severity = severitySelect.value;
    fetchAlerts();
  });
  orgInput.placeholder = "Org ID contains";
  orgInput.addEventListener("input", () => {
    state.filters.orgId = orgInput.value.trim() ? orgInput.value.trim() : "all";
    fetchAlerts();
  });

  syncFiltersUI();

  const statusLabel = createLabel("Status");
  statusLabel.appendChild(statusSelect);
  filtersContainer.appendChild(statusLabel);

  const ruleLabel = createLabel("Rule");
  ruleLabel.appendChild(ruleSelect);
  filtersContainer.appendChild(ruleLabel);

  const severityLabel = createLabel("Severity");
  severityLabel.appendChild(severitySelect);
  filtersContainer.appendChild(severityLabel);

  const orgLabel = createLabel("Org");
  orgLabel.appendChild(orgInput);
  filtersContainer.appendChild(orgLabel);
};

const toggleSelection = (id: string) => {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  renderTable();
  renderBulkActions();
};

const toggleAll = (nextState: boolean) => {
  if (!nextState) {
    state.selected.clear();
  } else {
    state.selected = new Set(state.alerts.map((alert) => alert.id));
  }
  renderTable();
  renderBulkActions();
};

const transitionAlert = async (id: string, action: TransitionAction) => {
  await fetch(`/alerts/${id}/${action === "ack" ? "ack" : "escalate"}`, {
    method: "POST",
  });
  await fetchAlerts();
};

const transitionAlertBulk = async (action: TransitionAction) => {
  const ids = Array.from(state.selected);
  if (ids.length === 0) {
    return;
  }
  await Promise.all(ids.map((id) => fetch(`/alerts/${id}/${action === "ack" ? "ack" : "escalate"}`, { method: "POST" })));
  state.selected.clear();
  await fetchAlerts();
};

const fetchAlerts = async () => {
  state.loading = true;
  state.error = null;
  renderMessage();
  try {
    const params = new URLSearchParams();
    if (state.filters.status !== "all") {
      params.set("status", state.filters.status);
    }
    if (state.filters.ruleId !== "all") {
      params.set("ruleId", state.filters.ruleId);
    }
    if (state.filters.severity !== "all") {
      params.set("severity", state.filters.severity);
    }
    if (state.filters.orgId !== "all") {
      params.set("orgId", state.filters.orgId);
    }
    const query = params.toString();
    const response = await fetch(`/alerts${query ? `?${query}` : ""}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const payload = (await response.json()) as { alerts: AlertRecord[] };
    state.alerts = payload.alerts ?? [];
    state.selected = new Set(Array.from(state.selected).filter((id) => state.alerts.some((alert) => alert.id === id)));
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Unknown error";
  } finally {
    state.loading = false;
    syncFiltersUI();
    renderMessage();
    renderTable();
    renderBulkActions();
  }
};

renderFilters();
renderMessage();
renderTable();
renderBulkActions();

fetchAlerts();
