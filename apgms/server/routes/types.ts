import type { PrismaService } from "../services";

export interface RoutePluginOptions {
  prisma: PrismaService;
}

export const orgQuerystringSchema = {
  type: "object",
  required: ["orgId"],
  properties: {
    orgId: { type: "string", minLength: 1 },
  },
} as const;
