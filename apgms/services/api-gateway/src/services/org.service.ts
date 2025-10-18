import { prisma } from "@apgms/shared/src/db";

export interface OrgSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface OrgWithUsers extends OrgSummary {
  users: {
    id: string;
    email: string;
    createdAt: string;
  }[];
}

export const orgService = {
  async listOrgs(): Promise<OrgSummary[]> {
    const orgs = await prisma.org.findMany({
      orderBy: { createdAt: "desc" },
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
    }));
  },

  async createOrg(name: string): Promise<OrgSummary> {
    const created = await prisma.org.create({
      data: { name },
    });

    return {
      id: created.id,
      name: created.name,
      createdAt: created.createdAt.toISOString(),
    };
  },

  async getOrgById(id: string): Promise<OrgWithUsers | null> {
    const org = await prisma.org.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!org) {
      return null;
    }

    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      users: org.users.map((user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  },
};
