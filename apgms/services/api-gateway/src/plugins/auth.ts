import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

export type AuthenticatedUser = {
  id: string;
  orgIds: string[];
  activeOrgId?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }

  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

function buildHttpError(statusCode: number, message: string) {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const header = request.headers["x-user"];

      if (!header || Array.isArray(header)) {
        throw buildHttpError(401, "Unauthorized");
      }

      let payload: Partial<AuthenticatedUser>;

      try {
        payload = JSON.parse(header);
      } catch {
        throw buildHttpError(401, "Invalid user header");
      }

      if (!payload.id || !Array.isArray(payload.orgIds) || payload.orgIds.length === 0) {
        throw buildHttpError(401, "Missing user context");
      }

      request.user = {
        id: payload.id,
        orgIds: payload.orgIds,
        activeOrgId: payload.activeOrgId ?? payload.orgIds[0],
      };
    }
  );
};

// expose decorator outside of encapsulated plugin scope
(authPlugin as any)[Symbol.for("skip-override")] = true;

export default authPlugin;
