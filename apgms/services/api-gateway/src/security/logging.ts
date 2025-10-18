export type SecurityDecision = "allow" | "deny";

export interface SecurityPrincipal {
  id: string;
  roles?: string[];
  type?: string;
}

export interface SecurityLogEntry {
  event: string;
  decision: SecurityDecision;
  route: string;
  orgId?: string;
  principal?: SecurityPrincipal;
  reason: string;
  [key: string]: unknown;
}

export type SecurityLogWriter = (entry: SecurityLogEntry) => void;

const noopWriter: SecurityLogWriter = () => {};

let writer: SecurityLogWriter = noopWriter;

export function setSecurityLogWriter(next: SecurityLogWriter) {
  writer = next;
}

export function resetSecurityLogWriter() {
  writer = noopWriter;
}

export function secLog(entry: SecurityLogEntry) {
  writer(entry);
}

type MissingTokenParams = {
  route: string;
};

type RoleMismatchParams = {
  route: string;
  orgId: string;
  principalId: string;
  principalRoles: string[];
  requiredRoles: string[];
};

type ReplayRejectParams = {
  route: string;
  principalId: string;
  orgId?: string;
  expectedBodyHash: string;
  receivedBodyHash: string;
};

export function logMissingToken({ route }: MissingTokenParams) {
  secLog({
    event: "auth.missing_token",
    decision: "deny",
    route,
    reason: "missing_token",
  });
}

export function logRoleMismatch({
  route,
  orgId,
  principalId,
  principalRoles,
  requiredRoles,
}: RoleMismatchParams) {
  secLog({
    event: "auth.role_mismatch",
    decision: "deny",
    route,
    orgId,
    principal: {
      id: principalId,
      roles: [...principalRoles],
    },
    reason: "role_mismatch",
    requiredRoles: [...requiredRoles],
  });
}

export function logReplayRejection({
  route,
  principalId,
  orgId,
  expectedBodyHash,
  receivedBodyHash,
}: ReplayRejectParams) {
  secLog({
    event: "auth.replay_rejected",
    decision: "deny",
    route,
    orgId,
    principal: {
      id: principalId,
    },
    reason: "replay_body_mismatch",
    expectedBodyHash,
    receivedBodyHash,
  });
}
