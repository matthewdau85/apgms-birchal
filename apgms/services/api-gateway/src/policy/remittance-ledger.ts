import { Clock, RemittanceLedgerEntry } from "./types";

export class RemittanceLedger {
  private readonly entries: RemittanceLedgerEntry[] = [];

  constructor(private readonly clock: Clock = () => new Date()) {}

  record(entry: Omit<RemittanceLedgerEntry, "recordedAt">): RemittanceLedgerEntry {
    const created: RemittanceLedgerEntry = {
      ...entry,
      recordedAt: this.clock(),
    };
    this.entries.push(created);
    return { ...created };
  }

  all(): RemittanceLedgerEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  count(): number {
    return this.entries.length;
  }
}
