import type { FastifyInstance } from "fastify";
import { dashboardResponseSchema } from "../schemas/dashboard";

const DEFAULT_DASHBOARD_PAYLOAD = {
  kpis: {
    operating: 0,
    taxBuffer: 0,
    paygw: 0,
    gst: 0,
  },
  series: [] as unknown[],
};

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async () => {
    return dashboardResponseSchema.parse(DEFAULT_DASHBOARD_PAYLOAD);
  });
}

export type RegisterDashboardRoutes = typeof registerDashboardRoutes;
