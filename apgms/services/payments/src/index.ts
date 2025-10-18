import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

interface PaymentInstruction {
  id: string;
  orgId: string;
  counterparty: string;
  amountCents: number;
  currency: string;
  executionDate: string;
  status: "scheduled" | "processing" | "settled" | "failed";
  reference: string;
  ledgerAccount: string;
  createdAt: string;
  updatedAt: string;
}

const payments: PaymentInstruction[] = [
  {
    id: "pay_0001",
    orgId: "org-birchal",
    counterparty: "ATO",
    amountCents: 125_000,
    currency: "AUD",
    executionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "scheduled",
    reference: "Q2 BAS remittance",
    ledgerAccount: "treasury.settlements",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pay_0002",
    orgId: "org-birchal",
    counterparty: "Solar Co-Op",
    amountCents: 48_500,
    currency: "AUD",
    executionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "processing",
    reference: "Monthly disbursement",
    ledgerAccount: "treasury.operating",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

const paymentRequestSchema = z.object({
  orgId: z.string().min(1),
  counterparty: z.string().min(1),
  amountCents: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  executionDate: z.coerce
    .date()
    .transform((date) => date.toISOString().slice(0, 10)),
  reference: z.string().min(1),
  ledgerAccount: z.string().min(1),
});

const querySchema = z.object({
  orgId: z.string().optional(),
  status: z.enum(["scheduled", "processing", "settled", "failed"]).optional(),
});

const statusTransitions: Record<PaymentInstruction["status"], PaymentInstruction["status"][]> = {
  scheduled: ["processing", "failed"],
  processing: ["settled", "failed"],
  settled: [],
  failed: [],
};

const statusUpdateSchema = z.object({
  status: z.enum(["scheduled", "processing", "settled", "failed"]),
});

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "payments" }));

app.get("/payments", async (req) => {
  const { orgId, status } = querySchema.parse(req.query ?? {});
  return {
    payments: payments.filter((payment) => {
      if (orgId && payment.orgId !== orgId) return false;
      if (status && payment.status !== status) return false;
      return true;
    }),
  };
});

app.post("/payments", async (req, rep) => {
  const parsed = paymentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return rep.code(400).send({ error: "validation_error", issues: parsed.error.issues });
  }

  const id = `pay_${(payments.length + 1).toString().padStart(4, "0")}`;
  const now = new Date().toISOString();
  const instruction: PaymentInstruction = {
    id,
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
    ...parsed.data,
  };

  payments.unshift(instruction);

  return rep.code(201).send({ payment: instruction });
});

app.post("/payments/:paymentId/status", async (req, rep) => {
  const { paymentId } = req.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) {
    return rep.code(404).send({ error: "not_found", message: "Unknown payment" });
  }

  const body = statusUpdateSchema.safeParse(req.body ?? {});
  if (!body.success) {
    return rep.code(400).send({ error: "validation_error", issues: body.error.issues });
  }

  if (!statusTransitions[payment.status].includes(body.data.status)) {
    return rep.code(409).send({
      error: "invalid_transition",
      message: `Cannot move payment from ${payment.status} to ${body.data.status}`,
    });
  }

  payment.status = body.data.status;
  payment.updatedAt = new Date().toISOString();

  return { payment };
});

const port = Number(process.env.PORT ?? 4002);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
