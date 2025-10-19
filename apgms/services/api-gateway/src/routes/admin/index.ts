import { FastifyInstance } from "fastify";
import { applyAdminGuard } from "./_guard.js";

export default async function registerAdminRoutes(app: FastifyInstance) {
  app.register(async (admin) => {
    applyAdminGuard(admin);

    admin.get("/keys", async () => {
      return {
        keys: [],
        message: "admin_mfa_required",
      };
    });
  }, { prefix: "/admin" });
}
