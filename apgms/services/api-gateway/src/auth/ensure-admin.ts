import { FastifyReply, FastifyRequest } from "fastify";

export interface CurrentUser {
  id?: string;
  roles?: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user?: CurrentUser;
  }
}

const getRoles = (request: FastifyRequest): string[] => {
  if (Array.isArray(request.user?.roles)) {
    return request.user!.roles!;
  }

  const header = request.headers["x-user-roles"];
  if (typeof header === "string") {
    return header
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (Array.isArray(header)) {
    return header
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
};

export const ensureAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const roles = getRoles(request);

  if (!roles.includes("admin")) {
    await reply.code(403).send({ error: "forbidden" });
    return;
  }
};
