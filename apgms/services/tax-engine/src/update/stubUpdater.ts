export interface PolicyUpdateSummary {
  checkedAt: Date;
  notes: string;
  updates: string[];
}

export interface PolicyUpdater {
  checkForUpdates(): Promise<PolicyUpdateSummary>;
}

export class StubPolicyUpdater implements PolicyUpdater {
  constructor(private readonly description: string = 'ATO manual review required') {}

  async checkForUpdates(): Promise<PolicyUpdateSummary> {
    return {
      checkedAt: new Date(),
      notes: this.description,
      updates: [],
    };
  }
}
