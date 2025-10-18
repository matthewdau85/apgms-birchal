import { z } from "zod";

export type ObligationType = "BAS" | "PAYG" | "Super";

type SettlementStatus = "pending" | "reconciled" | "queued";

type BaseObligation = {
  id: string;
  orgId: string;
  type: ObligationType;
  period: string;
  dueDate: string;
  designatedAccountId: string;
  label: string;
};

type TaxEngineOutput = {
  obligationId: string;
  netPayable: number;
  totalDebits: number;
  totalCredits: number;
  variance: number;
  generatedAt: string;
};

type SettlementInstruction = {
  id: string;
  obligationId: string;
  accountId: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  initialStatus: SettlementStatus;
  lastReconciledAt?: string;
  queuedAt?: string;
};

type DesignatedAccount = {
  accountId: string;
  label: string;
  bsb: string;
  accountNumber: string;
  balance: number;
  currency: string;
  lastUpdated: string;
};

export type DiscrepancyAcknowledgement = {
  obligationId: string;
  acknowledgedBy: string;
  note?: string;
  varianceAtConfirmation: number;
  acknowledgedAt: string;
};

export type ObligationSummary = {
  id: string;
  type: ObligationType;
  label: string;
  period: string;
  dueDate: string;
  designatedAccountId: string;
  netPayable: number;
  variance: number;
  status: "balanced" | "variance" | "acknowledged";
  readyToSubmit: boolean;
  transfersReconciled: boolean;
  acknowledgement: DiscrepancyAcknowledgement | null;
  taxEngine: {
    netPayable: number;
    totalDebits: number;
    totalCredits: number;
    variance: number;
    generatedAt: string;
  } | null;
  settlementInstructions: Array<{
    id: string;
    accountId: string;
    amount: number;
    currency: string;
    status: SettlementStatus;
    lastReconciledAt?: string;
    queuedAt?: string;
  }>;
};

export type DesignatedAccountBalance = {
  accountId: string;
  label: string;
  bsb: string;
  accountNumber: string;
  balance: number;
  currency: string;
  lastUpdated: string;
  reservedAmount: number;
  availableBalance: number;
};

const baseObligations: BaseObligation[] = [
  {
    id: "ob-bas-q1",
    orgId: "org-demo",
    type: "BAS",
    period: "Q1 FY25",
    dueDate: "2024-10-28",
    designatedAccountId: "DA-001",
    label: "Quarterly BAS (Jul-Sep)",
  },
  {
    id: "ob-bas-q2",
    orgId: "org-demo",
    type: "BAS",
    period: "Q2 FY25",
    dueDate: "2025-01-28",
    designatedAccountId: "DA-001",
    label: "Quarterly BAS (Oct-Dec)",
  },
  {
    id: "ob-payg-oct",
    orgId: "org-demo",
    type: "PAYG",
    period: "Oct 2024",
    dueDate: "2024-11-21",
    designatedAccountId: "DA-002",
    label: "Monthly PAYG Withholding",
  },
];

const taxEngineOutputs: TaxEngineOutput[] = [
  {
    obligationId: "ob-bas-q1",
    netPayable: 12850,
    totalDebits: 20450,
    totalCredits: 7600,
    variance: 0,
    generatedAt: "2024-10-05T09:25:00.000Z",
  },
  {
    obligationId: "ob-bas-q2",
    netPayable: 15200,
    totalDebits: 22100,
    totalCredits: 6900,
    variance: 120,
    generatedAt: "2025-01-07T09:30:00.000Z",
  },
  {
    obligationId: "ob-payg-oct",
    netPayable: 7300,
    totalDebits: 7300,
    totalCredits: 0,
    variance: 0,
    generatedAt: "2024-11-05T08:10:00.000Z",
  },
];

const settlementInstructions: SettlementInstruction[] = [
  {
    id: "stl-001",
    obligationId: "ob-bas-q1",
    accountId: "DA-001",
    amount: 12850,
    currency: "AUD",
    status: "reconciled",
    initialStatus: "reconciled",
    lastReconciledAt: "2024-10-12T04:25:00.000Z",
  },
  {
    id: "stl-002",
    obligationId: "ob-bas-q2",
    accountId: "DA-001",
    amount: 15200,
    currency: "AUD",
    status: "reconciled",
    initialStatus: "reconciled",
    lastReconciledAt: "2025-01-18T03:45:00.000Z",
  },
  {
    id: "stl-003",
    obligationId: "ob-payg-oct",
    accountId: "DA-002",
    amount: 7300,
    currency: "AUD",
    status: "pending",
    initialStatus: "pending",
  },
];

const designatedAccounts: DesignatedAccount[] = [
  {
    accountId: "DA-001",
    label: "ATO BAS Clearing",
    bsb: "062-000",
    accountNumber: "11111111",
    balance: 48500,
    currency: "AUD",
    lastUpdated: "2025-01-18T05:00:00.000Z",
  },
  {
    accountId: "DA-002",
    label: "Payroll Withholding",
    bsb: "062-111",
    accountNumber: "22222222",
    balance: 15800,
    currency: "AUD",
    lastUpdated: "2024-11-10T02:10:00.000Z",
  },
];

const acknowledgements = new Map<string, DiscrepancyAcknowledgement>();

const acknowledgementInputSchema = z.object({
  acknowledgedBy: z.string().min(1),
  note: z.string().max(500).optional(),
});

export type AcknowledgementInput = z.infer<typeof acknowledgementInputSchema>;

function findTaxEngineOutput(obligationId: string) {
  return taxEngineOutputs.find((output) => output.obligationId === obligationId) ?? null;
}

function findObligation(obligationId: string) {
  return baseObligations.find((ob) => ob.id === obligationId) ?? null;
}

function getInstructionsForObligation(obligationId: string) {
  return settlementInstructions.filter((instruction) => instruction.obligationId === obligationId);
}

function toSummary(obligation: BaseObligation): ObligationSummary {
  const taxOutput = findTaxEngineOutput(obligation.id);
  const instructions = getInstructionsForObligation(obligation.id);
  const acknowledgement = acknowledgements.get(obligation.id) ?? null;

  const variance = taxOutput?.variance ?? 0;
  const varianceStatus = variance === 0 ? "balanced" : acknowledgement ? "acknowledged" : "variance";

  const transfersReconciled = instructions.every((instruction) =>
    instruction.status === "reconciled" || instruction.status === "queued",
  );
  const readyToSubmit = (variance === 0 || Boolean(acknowledgement)) && transfersReconciled;

  return {
    id: obligation.id,
    type: obligation.type,
    label: obligation.label,
    period: obligation.period,
    dueDate: obligation.dueDate,
    designatedAccountId: obligation.designatedAccountId,
    netPayable: taxOutput?.netPayable ?? 0,
    variance,
    status: varianceStatus,
    readyToSubmit,
    transfersReconciled,
    acknowledgement,
    taxEngine: taxOutput
      ? {
          netPayable: taxOutput.netPayable,
          totalDebits: taxOutput.totalDebits,
          totalCredits: taxOutput.totalCredits,
          variance: taxOutput.variance,
          generatedAt: taxOutput.generatedAt,
        }
      : null,
    settlementInstructions: instructions.map((instruction) => ({
      id: instruction.id,
      accountId: instruction.accountId,
      amount: instruction.amount,
      currency: instruction.currency,
      status: instruction.status,
      lastReconciledAt: instruction.lastReconciledAt,
      queuedAt: instruction.queuedAt,
    })),
  };
}

export function getObligationSummaries(): ObligationSummary[] {
  return baseObligations.map((obligation) => toSummary(obligation));
}

export function getObligationSummary(obligationId: string): ObligationSummary | null {
  const obligation = findObligation(obligationId);
  if (!obligation) {
    return null;
  }
  return toSummary(obligation);
}

export function getDesignatedAccountBalances(): DesignatedAccountBalance[] {
  return designatedAccounts.map((account) => {
    const reservedAmount = settlementInstructions
      .filter((instruction) => instruction.accountId === account.accountId && instruction.status !== "queued")
      .reduce((total, instruction) => total + instruction.amount, 0);

    return {
      accountId: account.accountId,
      label: account.label,
      bsb: account.bsb,
      accountNumber: account.accountNumber,
      balance: account.balance,
      currency: account.currency,
      lastUpdated: account.lastUpdated,
      reservedAmount,
      availableBalance: account.balance - reservedAmount,
    } satisfies DesignatedAccountBalance;
  });
}

export function acknowledgeDiscrepancy(obligationId: string, input: AcknowledgementInput) {
  const obligation = findObligation(obligationId);
  if (!obligation) {
    return null;
  }
  acknowledgementInputSchema.parse(input);

  const summaryBefore = toSummary(obligation);
  const variance = summaryBefore.variance;

  const acknowledgement: DiscrepancyAcknowledgement = {
    obligationId,
    acknowledgedBy: input.acknowledgedBy,
    note: input.note,
    varianceAtConfirmation: variance,
    acknowledgedAt: new Date().toISOString(),
  };

  acknowledgements.set(obligationId, acknowledgement);

  return {
    acknowledgement,
    summary: toSummary(obligation),
  };
}

export function triggerBasSubmission(triggeredBy: string) {
  const basSummaries = getObligationSummaries().filter((summary) => summary.type === "BAS");

  const blockedObligations = basSummaries
    .filter((summary) => !summary.readyToSubmit)
    .map((summary) => ({
      obligationId: summary.id,
      reason: summary.status === "variance" ? "variance_not_acknowledged" : "transfers_not_reconciled",
      variance: summary.variance,
      transfersReconciled: summary.transfersReconciled,
    }));

  if (blockedObligations.length > 0) {
    return {
      ok: false as const,
      blockedObligations,
    };
  }

  const triggeredAt = new Date().toISOString();

  const authorisedInstructions = settlementInstructions
    .filter((instruction) => basSummaries.some((summary) => summary.id === instruction.obligationId))
    .map((instruction) => {
      instruction.status = "queued";
      instruction.queuedAt = triggeredAt;
      return {
        id: instruction.id,
        obligationId: instruction.obligationId,
        accountId: instruction.accountId,
        amount: instruction.amount,
        currency: instruction.currency,
        queuedAt: instruction.queuedAt,
      };
    });

  const refreshedObligations = basSummaries
    .map((summary) => getObligationSummary(summary.id))
    .filter((value): value is ObligationSummary => value !== null);

  return {
    ok: true as const,
    submission: {
      triggeredBy,
      triggeredAt,
      obligations: refreshedObligations,
      instructionsAuthorised: authorisedInstructions,
    },
  };
}

export function resetComplianceState() {
  acknowledgements.clear();
  settlementInstructions.forEach((instruction) => {
    instruction.status = instruction.initialStatus;
    if (instruction.queuedAt) {
      delete instruction.queuedAt;
    }
  });
}
