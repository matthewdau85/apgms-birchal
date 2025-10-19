import type { FastifyInstance } from "fastify";

import type { SendMessageOptions, SendMessageResult } from "@apgms/sbr";
import { sendMessage } from "@apgms/sbr";

export interface PrismaSbrDelegate {
  create(args: { data: any }): Promise<any>;
  findUnique(args: { where: { messageId: string } }): Promise<any | null>;
}

export interface SbrRouteDependencies {
  prisma: { sbrMessage: PrismaSbrDelegate };
  sendMessage?: (payloadXml: string, options?: SendMessageOptions) => Promise<SendMessageResult>;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function createSbrRoutes(deps: SbrRouteDependencies) {
  const prismaClient = deps.prisma;
  const send = deps.sendMessage ?? sendMessage;

  return async function sbrRoutes(app: FastifyInstance): Promise<void> {
    app.post("/submit", async (req, reply) => {
      const body = req.body as Record<string, unknown> | undefined;

      if (!body || !isString(body.orgId) || !isString(body.payloadXml)) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const metadata = (body.metadata && typeof body.metadata === "object") ? (body.metadata as Record<string, unknown>) : undefined;
      const attachmentsInput = Array.isArray(body.attachments) ? (body.attachments as Array<Record<string, unknown>>) : [];

      const attachments = attachmentsInput
        .map((item) => {
          if (!item || typeof item !== "object") {
            return undefined;
          }
          const name = typeof item.name === "string" ? item.name : undefined;
          const content = typeof item.content === "string" ? item.content : undefined;
          if (!name || content === undefined) {
            return undefined;
          }
          const contentType = typeof item.contentType === "string" ? item.contentType : undefined;
          return { name, content, contentType };
        })
        .filter((value): value is { name: string; content: string; contentType?: string } => Boolean(value));

      const { messageId, artifactDir } = await send(body.payloadXml, {
        orgId: body.orgId,
        metadata,
        attachments,
      });

      const created = await prismaClient.sbrMessage.create({
        data: {
          orgId: body.orgId,
          messageId,
          payloadXml: body.payloadXml,
          artifactPath: artifactDir,
          status: "submitted",
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return reply.code(201).send({
        message: {
          id: created.id,
          messageId: created.messageId,
          orgId: created.orgId,
          status: created.status,
          artifactPath: created.artifactPath,
          createdAt: created.createdAt,
        },
      });
    });

    app.get("/message/:id", async (req, reply) => {
      const params = req.params as Record<string, unknown> | undefined;
      const id = params && typeof params.id === "string" ? params.id : undefined;

      if (!id) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const record = await prismaClient.sbrMessage.findUnique({
        where: { messageId: id },
      });

      if (!record) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send({
        message: {
          id: record.id,
          messageId: record.messageId,
          orgId: record.orgId,
          status: record.status,
          artifactPath: record.artifactPath,
          metadata: record.metadata ? JSON.parse(record.metadata) : null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      });
    });
  };
}
