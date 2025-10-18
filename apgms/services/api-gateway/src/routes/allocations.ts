import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AllocationError,
  applyAllocationsSchema,
  previewAllocations,
  previewAllocationsSchema,
  verifyConservation,
} from "../lib/allocations";
import { devKms } from "../lib/dev-kms";
import { saveRpt } from "../stores/rpt-store";

const formatZodError = (error: z.ZodError) => ({
  error: "invalid_request",
  details: error.flatten(),
});

export const allocationsRoutes = async (app: FastifyInstance) => {
  app.post("/allocations/preview", async (request, reply) => {
    const parsed = previewAllocationsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(formatZodError(parsed.error));
    }

    try {
      const preview = previewAllocations(parsed.data);
      return reply.send({ preview });
    } catch (error) {
      request.log.error({ err: error }, "preview allocations failed");

      if (error instanceof AllocationError) {
        return reply.code(400).send({ error: error.code, message: error.message });
      }

      return reply.code(500).send({ error: "preview_failed" });
    }
  });

  app.post("/allocations/apply", async (request, reply) => {
    const parsed = applyAllocationsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(formatZodError(parsed.error));
    }

    try {
      const preview = previewAllocations(parsed.data);
      const computedHash = verifyConservation(preview, parsed.data.prevHash);

      const rpt = await devKms.mintRpt({ ...preview, prevHash: computedHash });
      saveRpt(rpt);

      return reply.code(201).send({ rptId: rpt.id });
    } catch (error) {
      request.log.error({ err: error }, "apply allocations failed");

      if (error instanceof AllocationError) {
        return reply.code(400).send({ error: error.code, message: error.message });
      }

      return reply.code(500).send({ error: "apply_failed" });
    }
  });
};

export default allocationsRoutes;
