import { FastifyInstance } from "fastify";
import { Services } from "../services";
import { AppConfig } from "../config/env";
import {
  bankLineListQuerySchema,
  bankLineListResponseSchema,
  createBankLineBodySchema,
  createBankLineResponseSchema,
  bankLineListQueryJsonSchema,
  bankLineListResponseJsonSchema,
  createBankLineBodyJsonSchema,
  createBankLineResponseJsonSchema,
} from "../schemas/bankLine";
import { ServiceError } from "../utils/errors";

export const registerBankLineRoutes = (app: FastifyInstance, services: Services, config: AppConfig) => {
  app.get(
    "/bank-lines",
    {
      preHandler: app.authorize(config.requiredRoles.bankLineRead),
      schema: {
        querystring: bankLineListQueryJsonSchema,
        response: {
          200: bankLineListResponseJsonSchema,
        },
      },
    },
    async (request) => {
      const { take } = bankLineListQuerySchema.parse(request.query);
      const lines = await services.workflowService.listBankLines(take);
      return bankLineListResponseSchema.parse({
        lines: lines.map((line) => ({
          id: line.id,
          orgId: line.orgId,
          date: line.date.toISOString(),
          amount: Number(line.amount),
          payee: line.payee,
          desc: line.desc,
          createdAt: line.createdAt.toISOString(),
        })),
      });
    },
  );

  app.post(
    "/bank-lines",
    {
      preHandler: app.authorize(config.requiredRoles.bankLineWrite),
      schema: {
        body: createBankLineBodyJsonSchema,
        response: {
          201: createBankLineResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw new ServiceError("unauthorized", "Authentication required", 401);
      }

      const { orgId, date, amount, payee, desc } = createBankLineBodySchema.parse(request.body);
      const line = await services.workflowService.createBankLine(
        {
          orgId,
          date,
          amount,
          payee,
          desc,
        },
        request.user,
      );

      const response = createBankLineResponseSchema.parse({
        id: line.id,
        orgId: line.orgId,
        date: line.date.toISOString(),
        amount: Number(line.amount),
        payee: line.payee,
        desc: line.desc,
        createdAt: line.createdAt.toISOString(),
      });

      reply.status(201);
      return response;
    },
  );
};
