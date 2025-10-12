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

export type WorkflowTask =
  | { type: "onboarding"; payload: OnboardingInput }
  | { type: "bas"; payload: ReadonlyArray<Transaction> }
  | { type: "recon"; payload: { records: ReadonlyArray<ReconciliationRecord>; tolerance?: number } }
  | { type: "debit"; payload: { accountBalance: number } }
  | { type: "mint"; payload: { author: string } };

export interface WorkflowState {
  profile?: OnboardingProfile;
  draft?: BasDraft;
  reconciliation?: ReturnType<typeof matchReconciliation>;
  debit?: DebitInstruction;
  report?: RegulatoryReport;
}

export class WorkflowWorker {
  private readonly state: WorkflowState = {};

  constructor(private readonly now: () => Date = () => new Date()) {}

  public get snapshot(): WorkflowState {
    return { ...this.state };
  }

  public async handle(task: WorkflowTask): Promise<WorkflowState> {
    switch (task.type) {
      case "onboarding":
        this.state.profile = onboardBusiness(task.payload, this.now);
        break;
      case "bas":
        this.assertProfile();
        this.state.draft = createBasDraft(task.payload);
        break;
      case "recon":
        this.assertDraft();
        this.state.reconciliation = matchReconciliation(
          this.state.draft!,
          task.payload.records,
          task.payload.tolerance
        );
        break;
      case "debit":
        this.assertDraft();
        this.state.debit = scheduleDebit(this.state.draft!, task.payload.accountBalance, this.now);
        break;
      case "mint":
        this.assertDraft();
        if (!this.state.debit) {
          throw new Error("Cannot mint without scheduling a debit instruction");
        }
        this.state.report = mintRegulatoryReport(this.state.draft!, this.state.debit, task.payload.author, this.now);
        break;
      default:
        task satisfies never;
    }

    return this.snapshot;
  }

  private assertProfile(): asserts this is { state: Required<Pick<WorkflowState, "profile">> & WorkflowWorker["state"] } {
    if (!this.state.profile) {
      throw new Error("Onboarding must be completed before creating a BAS draft");
    }
  }

  private assertDraft(): asserts this is { state: Required<Pick<WorkflowState, "draft">> & WorkflowWorker["state"] } {
    if (!this.state.draft) {
      throw new Error("BAS draft must exist before continuing the workflow");
    }
  }
}
