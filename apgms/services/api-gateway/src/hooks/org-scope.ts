import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "../plugins/auth";

declare module "fastify" {
  interface FastifyRequest {
    org?: {
      id: string;
    };
  }
}

function buildHttpError(statusCode: number, message: string) {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

export async function orgScopeHook(request: FastifyRequest, _reply: FastifyReply) {
  const { orgId } = (request.params ?? {}) as { orgId?: string };

  if (!orgId) {
    return;
  }

  const user: AuthenticatedUser | undefined = request.user;

  if (!user) {
    throw buildHttpError(401, "Unauthorized");
  }

  if (!user.orgIds.includes(orgId)) {
    throw buildHttpError(403, "Forbidden");
  }

  request.org = { id: orgId };
  request.user = {
    ...user,
    activeOrgId: orgId,
  };
}
