/**
 * Minimal compliance dashboard stub used by operations to validate new API routes.
 * In a real application this would be hydrated by API responses. For now we
 * project the same structure returned by the gateway so operators have a visual
 * reference during manual testing.
 */

type ObligationStub = {
  id: string;
  label: string;
  period: string;
  status: string;
  dueDate: string;
  netPayable: number;
  variance: number;
  readyToSubmit: boolean;
};

type AccountStub = {
  accountId: string;
  label: string;
  balance: number;
  reservedAmount: number;
  availableBalance: number;
};

const obligationStubs: ObligationStub[] = [
  {
    id: "ob-bas-q1",
    label: "Quarterly BAS (Jul-Sep)",
    period: "Q1 FY25",
    status: "balanced",
    dueDate: "2024-10-28",
    netPayable: 12850,
    variance: 0,
    readyToSubmit: true,
  },
  {
    id: "ob-bas-q2",
    label: "Quarterly BAS (Oct-Dec)",
    period: "Q2 FY25",
    status: "variance",
    dueDate: "2025-01-28",
    netPayable: 15200,
    variance: 120,
    readyToSubmit: false,
  },
  {
    id: "ob-payg-oct",
    label: "Monthly PAYG Withholding",
    period: "Oct 2024",
    status: "balanced",
    dueDate: "2024-11-21",
    netPayable: 7300,
    variance: 0,
    readyToSubmit: true,
  },
];

const designatedAccounts: AccountStub[] = [
  {
    accountId: "DA-001",
    label: "ATO BAS Clearing",
    balance: 48500,
    reservedAmount: 28050,
    availableBalance: 20450,
  },
  {
    accountId: "DA-002",
    label: "Payroll Withholding",
    balance: 15800,
    reservedAmount: 7300,
    availableBalance: 8500,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

function renderComplianceStub() {
  if (typeof document === "undefined") {
    console.table(obligationStubs);
    console.table(designatedAccounts);
    return;
  }

  const root = document.getElementById("root");
  if (!root) {
    console.warn("Compliance stub: root element missing");
    return;
  }

  const container = document.createElement("div");
  container.style.fontFamily = "system-ui, sans-serif";
  container.style.padding = "16px";
  container.style.display = "grid";
  container.style.gap = "16px";

  const heading = document.createElement("h1");
  heading.textContent = "Compliance overview";
  container.appendChild(heading);

  const obligationsCard = document.createElement("section");
  obligationsCard.innerHTML = `
    <h2>Obligation status</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left">Obligation</th>
          <th align="left">Period</th>
          <th align="left">Due</th>
          <th align="left">Status</th>
          <th align="right">Net payable</th>
          <th align="right">Variance</th>
        </tr>
      </thead>
      <tbody>
        ${obligationStubs
          .map(
            (obligation) => `
              <tr>
                <td>${obligation.label}</td>
                <td>${obligation.period}</td>
                <td>${obligation.dueDate}</td>
                <td>${obligation.status}${
                  obligation.readyToSubmit ? "" : " (action required)"
                }</td>
                <td style="text-align: right;">${formatCurrency(obligation.netPayable)}</td>
                <td style="text-align: right;">${formatCurrency(obligation.variance)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
  container.appendChild(obligationsCard);

  const accountsCard = document.createElement("section");
  accountsCard.innerHTML = `
    <h2>Designated accounts</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left">Account</th>
          <th align="right">Balance</th>
          <th align="right">Reserved</th>
          <th align="right">Available</th>
        </tr>
      </thead>
      <tbody>
        ${designatedAccounts
          .map(
            (account) => `
              <tr>
                <td>${account.label}</td>
                <td style="text-align: right;">${formatCurrency(account.balance)}</td>
                <td style="text-align: right;">${formatCurrency(account.reservedAmount)}</td>
                <td style="text-align: right;">${formatCurrency(account.availableBalance)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
  container.appendChild(accountsCard);

  root.replaceChildren(container);
}

renderComplianceStub();
