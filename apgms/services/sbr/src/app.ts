import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  BasSubmissionHandler,
  type BasSubmissionPayload,
  PayrollSubmissionHandler,
  type PayrollSubmissionPayload,
} from "./handlers";

export interface AppOptions {
  basHandler: BasSubmissionHandler;
  payrollHandler: PayrollSubmissionHandler;
  logger?: boolean;
}

const basSchema = z.object({
  abn: z.string().min(11),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  grossSales: z.number(),
  gstOnSales: z.number(),
  gstOnPurchases: z.number(),
});

const payrollSchema = z.object({
  abn: z.string().min(11),
  payPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employees: z
    .array(
      z.object({
        tfnd: z.string().min(8),
        gross: z.number(),
        taxWithheld: z.number(),
      }),
    )
    .min(1),
});

export function createServer(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.get("/health", async () => ({ ok: true, service: "sbr" }));

  app.post("/lodgements/bas", async (request, reply) => {
    const parsed = basSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const result = await options.basHandler.submit(parsed.data as BasSubmissionPayload);
    return reply.code(202).send(result);
  });

  app.post("/lodgements/payroll", async (request, reply) => {
    const parsed = payrollSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const result = await options.payrollHandler.submit(
      parsed.data as PayrollSubmissionPayload,
    );
    return reply.code(202).send(result);
  });

  return app;
}
