export type GateState = "OPEN" | "CLOSED";

type GateRecord = {
  gateId: string;
  orgId: string;
  state: GateState;
  updatedAt: string;
};

const gates = new Map<string, GateRecord>();

function makeGateId(orgId: string): string {
  return `gate:${orgId}`;
}

export function setGateState(orgId: string, state: GateState): GateRecord {
  const gateId = makeGateId(orgId);
  const record: GateRecord = {
    gateId,
    orgId,
    state,
    updatedAt: new Date().toISOString(),
  };
  gates.set(orgId, record);
  return record;
}

export function getGateState(orgId: string): GateState {
  return gates.get(orgId)?.state ?? "CLOSED";
}

export function getGateId(orgId: string): string {
  return gates.get(orgId)?.gateId ?? makeGateId(orgId);
}

export function listOpenGateOrgIds(): string[] {
  return Array.from(gates.values())
    .filter((gate) => gate.state === "OPEN")
    .map((gate) => gate.orgId);
}

export function resetGates(): void {
  gates.clear();
}
