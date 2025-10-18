declare global {
  interface Window {
    APIGATEWAY_URL?: string;
    APIGATEWAY_API_KEY?: string;
    CONNECTORS_URL?: string;
    PAYMENTS_URL?: string;
  }
}

interface BankLine {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
}

interface UserSummary {
  email: string;
  orgId: string;
  createdAt: string;
}

interface ConnectorProvider {
  id: string;
  name: string;
  status: string;
  lastSyncedAt: string | null;
  capabilities: string[];
}

interface PaymentInstruction {
  id: string;
  counterparty: string;
  amountCents: number;
  executionDate: string;
  status: string;
  reference: string;
}

type LoadingState<T> = {
  status: "idle" | "loading" | "error" | "ready";
  data: T;
  error?: string;
};

const apiBase = window.APIGATEWAY_URL ?? "http://localhost:3000";
const apiKey = window.APIGATEWAY_API_KEY ?? "dev-api-key";
const connectorsBase = window.CONNECTORS_URL ?? "http://localhost:4001";
const paymentsBase = window.PAYMENTS_URL ?? "http://localhost:4002";

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const initialState = {
  bankLines: { status: "idle", data: [] as BankLine[] } as LoadingState<BankLine[]>,
  users: { status: "idle", data: [] as UserSummary[] } as LoadingState<UserSummary[]>,
  connectors: { status: "idle", data: [] as ConnectorProvider[] } as LoadingState<ConnectorProvider[]>,
  payments: { status: "idle", data: [] as PaymentInstruction[] } as LoadingState<PaymentInstruction[]>,
};

let state = clone(initialState);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

const formatCurrency = (amountCents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountCents / 100);

const formatDateTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

const formatStatusBadge = (status: string) => {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${status}`;
  badge.textContent = status;
  return badge;
};

const renderUsersSection = (container: HTMLElement) => {
  container.innerHTML = "";
  const header = document.createElement("h2");
  header.textContent = "Recent users";
  container.appendChild(header);

  if (state.users.status === "loading") {
    container.appendChild(document.createTextNode("Loading users…"));
    return;
  }

  if (state.users.status === "error") {
    container.appendChild(document.createTextNode(state.users.error ?? "Failed to load users"));
    return;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Email</th>
        <th>Organisation</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${state.users.data
        .map(
          (user) => `
            <tr>
              <td>${user.email}</td>
              <td>${user.orgId}</td>
              <td>${formatDateTime(user.createdAt)}</td>
            </tr>
          `,
        )
        .join("")}
    </tbody>
  `;
  container.appendChild(table);
};

const renderBankLinesSection = (container: HTMLElement) => {
  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>Bank lines</h2>`;
  container.appendChild(header);

  if (state.bankLines.status === "loading") {
    container.appendChild(document.createTextNode("Loading bank lines…"));
    return;
  }

  if (state.bankLines.status === "error") {
    container.appendChild(document.createTextNode(state.bankLines.error ?? "Unable to fetch bank lines"));
    return;
  }

  const list = document.createElement("ul");
  list.className = "bank-line-list";
  state.bankLines.data.forEach((line) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="bank-line__meta">
        <span class="bank-line__date">${formatDateTime(line.date)}</span>
        <span class="bank-line__payee">${line.payee}</span>
      </div>
      <div class="bank-line__details">
        <span class="bank-line__amount">${formatCurrency(Number(line.amount))}</span>
        <span class="bank-line__desc">${line.desc}</span>
      </div>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);
};

const renderConnectorsSection = (container: HTMLElement) => {
  container.innerHTML = "";
  const header = document.createElement("h2");
  header.textContent = "Connector providers";
  container.appendChild(header);

  if (state.connectors.status === "loading") {
    container.appendChild(document.createTextNode("Loading connectors…"));
    return;
  }

  if (state.connectors.status === "error") {
    container.appendChild(document.createTextNode(state.connectors.error ?? "Unable to fetch connectors"));
    return;
  }

  const list = document.createElement("div");
  list.className = "connector-grid";
  state.connectors.data.forEach((provider) => {
    const card = document.createElement("article");
    card.className = "connector-card";
    const badge = formatStatusBadge(provider.status);
    card.innerHTML = `
      <header class="connector-card__header">
        <h3>${provider.name}</h3>
      </header>
      <p class="connector-card__sync">Last synced ${formatDateTime(provider.lastSyncedAt)}</p>
      <p class="connector-card__caps">${provider.capabilities.join(", ")}</p>
    `;
    card.querySelector(".connector-card__header")?.appendChild(badge);
    list.appendChild(card);
  });
  container.appendChild(list);
};

const renderPaymentsSection = (container: HTMLElement) => {
  container.innerHTML = "";
  const header = document.createElement("h2");
  header.textContent = "Scheduled payments";
  container.appendChild(header);

  if (state.payments.status === "loading") {
    container.appendChild(document.createTextNode("Loading payments…"));
    return;
  }

  if (state.payments.status === "error") {
    container.appendChild(document.createTextNode(state.payments.error ?? "Unable to fetch payments"));
    return;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Reference</th>
        <th>Counterparty</th>
        <th>Amount</th>
        <th>Execution</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${state.payments.data
        .map(
          (payment) => `
            <tr>
              <td>${payment.reference}</td>
              <td>${payment.counterparty}</td>
              <td>${formatCurrency(payment.amountCents)}</td>
              <td>${payment.executionDate}</td>
              <td>${payment.status}</td>
            </tr>
          `,
        )
        .join("")}
    </tbody>
  `;
  container.appendChild(table);
};

const renderApp = () => {
  root.innerHTML = `
    <main class="layout">
      <header class="layout__hero">
        <h1>Birchal treasury cockpit</h1>
        <p>Monitor customer onboarding, bank feeds, and outbound payments at a glance.</p>
      </header>
      <section class="layout__section" id="users-section"></section>
      <section class="layout__section" id="bank-lines-section"></section>
      <section class="layout__section" id="connectors-section"></section>
      <section class="layout__section" id="payments-section"></section>
    </main>
  `;

  renderUsersSection(document.getElementById("users-section")!);
  renderBankLinesSection(document.getElementById("bank-lines-section")!);
  renderConnectorsSection(document.getElementById("connectors-section")!);
  renderPaymentsSection(document.getElementById("payments-section")!);
};

renderApp();

const setLoading = <T,>(key: keyof typeof state) => {
  state = { ...state, [key]: { status: "loading", data: state[key].data } } as typeof state;
  renderApp();
};

const setData = <T,>(key: keyof typeof state, data: T) => {
  state = { ...state, [key]: { status: "ready", data } } as typeof state;
  renderApp();
};

const setError = (key: keyof typeof state, error: string) => {
  state = { ...state, [key]: { status: "error", data: state[key].data, error } } as typeof state;
  renderApp();
};

const fetchJson = async <T,>(base: string, path: string): Promise<T> => {
  const response = await fetch(`${base}${path}`, {
    headers: base === apiBase ? { "x-api-key": apiKey } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const bootstrap = async () => {
  setLoading("users");
  setLoading("bankLines");
  setLoading("connectors");
  setLoading("payments");

  try {
    const users = await fetchJson<{ users: UserSummary[] }>(apiBase, "/users");
    setData("users", users.users);
  } catch (error) {
    setError("users", (error as Error).message);
  }

  try {
    const bankLines = await fetchJson<{ lines: BankLine[] }>(apiBase, "/bank-lines");
    setData("bankLines", bankLines.lines);
  } catch (error) {
    setError("bankLines", (error as Error).message);
  }

  try {
    const connectors = await fetchJson<{ providers: ConnectorProvider[] }>(
      connectorsBase,
      "/providers",
    );
    setData("connectors", connectors.providers);
  } catch (error) {
    setError("connectors", (error as Error).message);
  }

  try {
    const payments = await fetchJson<{ payments: PaymentInstruction[] }>(paymentsBase, "/payments");
    setData("payments", payments.payments);
  } catch (error) {
    setError("payments", (error as Error).message);
  }
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap webapp", error);
});
