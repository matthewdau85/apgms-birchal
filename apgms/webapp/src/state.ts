import {
  createBasDraft,
  matchReconciliation,
  mintRegulatoryReport,
  onboardBusiness,
  scheduleDebit,
  type BasDraft,
  type DebitInstruction,
  type OnboardingInput,
  type OnboardingProfile,
  type ReconciliationRecord,
  type RegulatoryReport,
  type Transaction
} from "@apgms/shared";

export type FlowStep = "onboarding" | "bas" | "recon" | "debit" | "report";

export interface FlowState {
  readonly step: FlowStep;
  readonly profile?: OnboardingProfile;
  readonly draft?: BasDraft;
  readonly reconciliation?: ReturnType<typeof matchReconciliation>;
  readonly debit?: DebitInstruction;
  readonly report?: RegulatoryReport;
}

export interface FlowController {
  readonly state: FlowState;
  startOnboarding(input: OnboardingInput): FlowState;
  generateBas(transactions: ReadonlyArray<Transaction>): FlowState;
  reconcile(records: ReadonlyArray<ReconciliationRecord>, tolerance?: number): FlowState;
  requestDebit(accountBalance: number): FlowState;
  mintReport(author: string): FlowState;
}

export function createFlowController(now: () => Date = () => new Date()): FlowController {
  const state: { current: FlowState } = {
    current: { step: "onboarding" }
  };

  const controller: FlowController = {
    get state() {
      return state.current;
    },

    startOnboarding(input) {
      state.current = {
        step: "bas",
        profile: onboardBusiness(input, now)
      };
      return state.current;
    },

    generateBas(transactions) {
      assertStep(state.current.step, "bas", "You must onboard before drafting BAS");
      state.current = {
        ...state.current,
        step: "recon",
        draft: createBasDraft(transactions)
      };
      return state.current;
    },

    reconcile(records, tolerance) {
      assertStep(state.current.step, "recon", "A BAS draft is required before reconciling");
      state.current = {
        ...state.current,
        step: "debit",
        reconciliation: matchReconciliation(state.current.draft!, records, tolerance)
      };
      return state.current;
    },

    requestDebit(accountBalance) {
      assertStep(state.current.step, "debit", "Reconciliation must be performed before scheduling debit");
      state.current = {
        ...state.current,
        step: "report",
        debit: scheduleDebit(state.current.draft!, accountBalance, now)
      };
      return state.current;
    },

    mintReport(author) {
      assertStep(state.current.step, "report", "Debit must be scheduled before minting the report");
      const { draft, debit } = state.current;
      if (!debit || debit.status !== "scheduled") {
        throw new Error("A successful debit instruction is required to mint the report");
      }

      state.current = {
        ...state.current,
        report: mintRegulatoryReport(draft!, debit, author, now)
      };
      return state.current;
    }
  };

  return controller;
}

function assertStep(actual: FlowStep, expected: FlowStep, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}
