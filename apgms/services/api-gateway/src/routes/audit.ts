import type { FastifyInstance } from "fastify";
import { verifyRpt } from "../lib/dev-kms";
import { findRpt } from "../stores/rpt-store";

export const auditRoutes = async (app: FastifyInstance) => {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id) {
      return reply.code(400).send({ error: "invalid_request", message: "id is required" });
    }

    const token = findRpt(id);

    if (!token) {
      return reply.code(404).send({ error: "not_found", message: "RPT not found" });
    }

    if (!verifyRpt(token)) {
      return reply.code(409).send({ error: "invalid_rpt", message: "RPT verification failed" });
    }

    return reply.send({ rpt: token });
  });
};

export default auditRoutes;
