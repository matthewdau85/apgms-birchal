import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z, type ZodTypeAny } from "zod";
import type { PrismaClient } from "@prisma/client";
import { CONNECTOR_SOURCES, type ConnectorSource } from "@apgms/shared/connectors";
import type { TaxEngineEvent, TaxEventQueue } from "@apgms/shared/queue";

const payrollRunSchema = z.object({
  runId: z.string(),
  orgId: z.string(),
  payPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }),
  totalGross: z.number().nonnegative(),
  employees: z.array(
    z.object({
      employeeId: z.string(),
      grossPay: z.number(),
      netPay: z.number().optional(),
    })
  ),
});

const posTransactionSchema = z.object({
  transactionId: z.string(),
  locationId: z.string(),
  occurredAt: z.string(),
  total: z.number(),
  tax: z.number().optional(),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int(),
      price: z.number(),
    })
  ),
});

export interface ConnectorEventInput {
  source: ConnectorSource;
  type: string;
  payload: unknown;
}

export interface ConnectorEventRecord extends ConnectorEventInput {
  id: string;
  receivedAt: Date;
}

export interface StagingRepository {
  saveEvent(event: ConnectorEventInput): Promise<ConnectorEventRecord>;
}

export interface EventPublisher {
  publish(event: TaxEngineEvent): Promise<void>;
}

type PrismaConnectorEventDelegate = {
  create(args: { data: ConnectorEventInput }): Promise<{
    id: string;
    source: ConnectorSource;
    type: string;
    payload: unknown;
    receivedAt: Date;
  }>;
};

export const createStagingRepository = (client: PrismaClient): StagingRepository => {
  const delegate = (client as unknown as { connectorEvent: PrismaConnectorEventDelegate }).connectorEvent;

  return {
    async saveEvent(event) {
      const record = await delegate.create({ data: event });
      return {
        id: record.id,
        source: record.source,
        type: record.type,
        payload: record.payload,
        receivedAt: record.receivedAt,
      };
    },
  };
};

export const createQueuePublisher = (queue: TaxEventQueue): EventPublisher => ({
  async publish(event) {
    queue.publish(event);
  },
});

export interface BuildServerOptions {
  stagingRepo?: StagingRepository;
  publisher?: EventPublisher;
}

type WebhookRequest = FastifyRequest<{ Body: unknown }>;

type WebhookHandlerMeta = {
  source: ConnectorSource;
  type: string;
};

async function handleWebhook(
  request: WebhookRequest,
  reply: FastifyReply,
  schema: ZodTypeAny,
  meta: WebhookHandlerMeta,
  stagingRepo: StagingRepository,
  publisher: EventPublisher
) {
  const validation = schema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      message: "Invalid payload",
      issues: validation.error.issues,
    });
  }

  try {
    const saved = await stagingRepo.saveEvent({
      source: meta.source,
      type: meta.type,
      payload: validation.data,
    });

    await publisher.publish({
      id: saved.id,
      source: saved.source,
      type: saved.type,
      payload: validation.data,
      receivedAt: saved.receivedAt,
    });

    return reply.status(202).send({ id: saved.id });
  } catch (error) {
    request.log.error({ err: error }, "Failed to process webhook payload");
    return reply.status(500).send({ message: "Failed to process webhook" });
  }
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  let stagingRepo = options.stagingRepo;
  let publisher = options.publisher;

  if (!stagingRepo || !publisher) {
    const shared = await import("@apgms/shared");
    stagingRepo = stagingRepo ?? createStagingRepository(shared.prisma);
    publisher = publisher ?? createQueuePublisher(shared.taxEventQueue);
  }

  app.post("/webhooks/payroll", (request, reply) =>
    handleWebhook(
      request,
      reply,
      payrollRunSchema,
      { source: CONNECTOR_SOURCES.PAYROLL, type: "payroll.run" },
      stagingRepo!,
      publisher!
    )
  );

  app.post("/webhooks/pos", (request, reply) =>
    handleWebhook(
      request,
      reply,
      posTransactionSchema,
      { source: CONNECTOR_SOURCES.POS, type: "pos.transaction" },
      stagingRepo!,
      publisher!
    )
  );

  return app;
}
