import type { FastifyPluginAsync } from "fastify";
import { getDashboardSummary } from "../data/store.js";
import { DASHBOARD_SCHEMA } from "../schemas/dashboard.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard", async (request, reply) => {
    const payload = getDashboardSummary();
    const response = DASHBOARD_SCHEMA.parse(payload);
    request.log.info({ totals: response.summary }, "dashboard retrieved");
    return response;
  });
};
