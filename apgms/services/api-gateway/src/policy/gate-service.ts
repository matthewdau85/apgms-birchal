import { Clock, GateClosureOptions, GateReason, GateState, Role } from "./types";

export class GatePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatePermissionError";
  }
}

const cloneState = (state: GateState): GateState => ({
  id: state.id,
  status: state.status,
  reason: state.reason,
  opensAt: state.opensAt ?? null,
  locked: state.locked,
  updatedAt: state.updatedAt,
});

export class GateService {
  private readonly gates = new Map<string, GateState>();

  constructor(private readonly clock: Clock = () => new Date()) {}

  getState(id: string): GateState {
    const existing = this.gates.get(id);
    if (existing) {
      return cloneState(existing);
    }
    const created: GateState = {
      id,
      status: "OPEN",
      locked: false,
      updatedAt: this.clock(),
    };
    this.gates.set(id, created);
    return cloneState(created);
  }

  close(id: string, options: GateClosureOptions): GateState {
    const { requireAdminOverride = false } = options;
    if (
      requireAdminOverride &&
      options.actorRole !== "admin_compliance" &&
      options.actorRole !== "system"
    ) {
      throw new GatePermissionError("admin override required to close gate");
    }
    const next: GateState = {
      id,
      status: "CLOSED",
      reason: options.reason,
      opensAt: options.opensAt ?? null,
      locked: requireAdminOverride,
      updatedAt: this.clock(),
    };
    this.gates.set(id, next);
    return cloneState(next);
  }

  open(id: string, actorRole: Role): GateState {
    const current = this.getState(id);
    if (current.status === "OPEN") {
      return current;
    }
    if (current.locked && actorRole !== "admin_compliance") {
      throw new GatePermissionError("gate is locked by anomaly override");
    }
    const updated: GateState = {
      id,
      status: "OPEN",
      locked: false,
      updatedAt: this.clock(),
    };
    this.gates.set(id, updated);
    return cloneState(updated);
  }

  setOpensAt(id: string, opensAt: Date | null): GateState {
    const current = this.getState(id);
    const updated: GateState = {
      ...current,
      opensAt,
      updatedAt: this.clock(),
    };
    this.gates.set(id, updated);
    return cloneState(updated);
  }

  reason(id: string): GateReason | undefined {
    return this.getState(id).reason;
  }
}
