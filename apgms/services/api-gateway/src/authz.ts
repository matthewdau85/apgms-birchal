import type { FastifyReply, FastifyRequest } from "fastify";

export const ROLES = ["viewer", "analyst", "admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_ORDER: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
};

export interface RoleMatrixEntry {
  method: "GET" | "POST";
  url: string;
  minRole: Role;
  successStatus: number;
  payload?: Record<string, unknown>;
}

export const ROLE_MATRIX: readonly RoleMatrixEntry[] = [
  {
    method: "GET",
    url: "/health",
    minRole: "viewer",
    successStatus: 200,
  },
  {
    method: "GET",
    url: "/users",
    minRole: "admin",
    successStatus: 200,
  },
  {
    method: "GET",
    url: "/bank-lines",
    minRole: "viewer",
    successStatus: 200,
  },
  {
    method: "POST",
    url: "/bank-lines",
    minRole: "analyst",
    successStatus: 200,
    payload: {
      orgId: "test-org",
      date: new Date().toISOString(),
      amount: 123.45,
      payee: "Example",
      desc: "Example description",
    },
  },
] as const;

function normalizeRoleHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleSatisfies(role: Role, minRole: Role): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[minRole];
}

export function requireRole(minRole: Role) {
  return async (req: FastifyRequest, rep: FastifyReply) => {
    const rawRole = normalizeRoleHeader(req.headers["x-role"]);

    if (!rawRole) {
      return rep.status(401).send({ error: "missing_role" });
    }

    if (!isRole(rawRole)) {
      return rep.status(403).send({ error: "forbidden" });
    }

    if (!roleSatisfies(rawRole, minRole)) {
      return rep.status(403).send({ error: "forbidden" });
    }

    (req as FastifyRequest & { role: Role }).role = rawRole;
  };
}
