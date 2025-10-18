import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rptStore } from "../stores/rpt-store";
import { kms } from "../lib/kms";
import { verifyRpt } from "../lib/rpt";

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/audit/rpt/:id", async (request, reply) => {
    const paramsResult = z
      .object({ id: z.string().min(1, "id is required") })
      .safeParse(request.params);

    if (!paramsResult.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: paramsResult.error.format(),
      });
    }

    const { id } = paramsResult.data;
    const token = rptStore.get(id);

    if (!token) {
      return reply.code(404).send({ error: "rpt_not_found" });
    }

    const valid = verifyRpt(kms, token);

    if (!valid) {
      rptStore.delete(id);
      return reply.code(400).send({ error: "rpt_tampered" });
    }

    return reply.send(token);
  });
};

export default auditRoutes;
