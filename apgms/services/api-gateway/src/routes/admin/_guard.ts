import { FastifyInstance } from "fastify";
import { requireMFA } from "../../middleware/auth.js";

export function applyAdminGuard(app: FastifyInstance) {
  app.addHook("preHandler", requireMFA);
}
