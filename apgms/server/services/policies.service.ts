import { getDefaultPrisma, toNumber, type PrismaService } from "./types";

export interface PolicyItem {
  id: string;
  orgId: string;
  name: string;
  status: string;
  premium: number;
  effectiveDate: string;
}

export const getPolicies = async (
  orgId: string,
  prismaClient: PrismaService = getDefaultPrisma(),
): Promise<PolicyItem[]> => {
  const policies = await prismaClient.policy.findMany({
    where: { orgId },
    orderBy: { effectiveDate: "desc" },
  });

  return policies.map((policy) => ({
    id: policy.id,
    orgId: policy.orgId,
    name: policy.name,
    status: policy.status,
    premium: toNumber(policy.premium),
    effectiveDate: policy.effectiveDate.toISOString(),
  }));
};
