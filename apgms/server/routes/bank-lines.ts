import type { FastifyPluginAsync } from "fastify";
import { getBankLines, type BankLineItem } from "../services/bank-lines.service";
import type { RoutePluginOptions } from "./types";
import { orgQuerystringSchema } from "./types";

const bankLineItemSchema = {
  type: "object",
  required: ["id", "orgId", "date", "amount", "payee", "description"],
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    date: { type: "string", format: "date-time" },
    amount: { type: "number" },
    payee: { type: "string" },
    description: { type: "string" },
  },
} as const;

const bankLinesResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: bankLineItemSchema,
    },
  },
} as const;

export const bankLinesRoutes: FastifyPluginAsync<RoutePluginOptions> = async (fastify, opts) => {
  fastify.get<{ Querystring: { orgId: string }; Reply: { items: BankLineItem[] } }>(
    "/bank-lines",
    {
      schema: {
        querystring: orgQuerystringSchema,
        response: {
          200: bankLinesResponseSchema,
        },
      },
    },
    async (request) => ({
      items: await getBankLines(request.query.orgId, opts.prisma),
    }),
  );
};
