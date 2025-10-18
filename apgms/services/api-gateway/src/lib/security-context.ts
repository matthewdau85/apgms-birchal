import type { FastifyRequest } from "fastify";

type PossibleUser = {
  id?: string;
  sub?: string;
  email?: string;
  orgId?: string;
};

const extractUser = (request: FastifyRequest): PossibleUser | undefined => {
  const candidate = (request as Record<string, unknown>).user;
  if (candidate && typeof candidate === "object") {
    return candidate as PossibleUser;
  }

  return undefined;
};

export const resolveRoute = (request: FastifyRequest) =>
  request.routerPath ?? request.routeOptions?.url ?? request.url;

export const extractPrincipal = (request: FastifyRequest) => {
  const user = extractUser(request);
  if (!user) {
    return undefined;
  }

  return user.sub ?? user.id ?? user.email;
};

export const extractOrgId = (request: FastifyRequest) => {
  const user = extractUser(request);
  if (!user) {
    return undefined;
  }

  return user.orgId;
};
