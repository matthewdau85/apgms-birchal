import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function withOrgContext<T>(orgId: string, fn: (client: PrismaClient) => Promise<T>) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId)) {
    throw new Error("withOrgContext expects a canonical UUID orgId");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${orgId}'::uuid`);
    return fn(tx);
  });
}
