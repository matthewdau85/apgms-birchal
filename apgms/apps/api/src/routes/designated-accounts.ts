import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@apgms/shared";
import { AllocationStatus } from "../lib/constants";
import { toDecimalString } from "../lib/format";

const QuerySchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
});

const QueryJsonSchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
  },
} as const;

const AccountSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  bsb: z.string(),
  accountNumber: z.string(),
  balance: z.string(),
  allocatedAmount: z.string(),
  allocationCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ResponseSchema = z.object({
  items: z.array(AccountSchema),
});

const ResponseJsonSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "orgId",
          "name",
          "bsb",
          "accountNumber",
          "balance",
          "allocatedAmount",
          "allocationCount",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          orgId: { type: "string" },
          name: { type: "string" },
          bsb: { type: "string" },
          accountNumber: { type: "string" },
          balance: { type: "string" },
          allocatedAmount: { type: "string" },
          allocationCount: { type: "integer" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
    },
  },
} as const;

export const designatedAccountsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["designated-accounts"],
        querystring: QueryJsonSchema,
        response: {
          200: ResponseJsonSchema,
        },
      },
    },
    async (request) => {
      const { orgId } = QuerySchema.parse(request.query);

      const accounts = await prisma.designatedAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        include: {
          allocations: true,
        },
      });

      return {
        items: accounts.map((account) => {
          let allocatedTotal = 0;
          for (const allocation of account.allocations) {
            if (allocation.status === AllocationStatus.CONFIRMED) {
              const numericAmount = Number(toDecimalString(allocation.amount));
              allocatedTotal += Number.isNaN(numericAmount) ? 0 : numericAmount;
            }
          }

          return {
            id: account.id,
            orgId: account.orgId,
            name: account.name,
            bsb: account.bsb,
            accountNumber: account.accountNumber,
            balance: toDecimalString(account.balance),
            allocatedAmount: toDecimalString(allocatedTotal),
            allocationCount: account.allocations.length,
            createdAt: account.createdAt.toISOString(),
            updatedAt: account.updatedAt.toISOString(),
          } satisfies z.infer<typeof AccountSchema>;
        }),
      } satisfies z.infer<typeof ResponseSchema>;
    },
  );
};
