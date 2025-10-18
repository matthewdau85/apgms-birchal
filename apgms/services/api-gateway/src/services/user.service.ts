import { prisma } from "@apgms/shared/src/db";

export interface UserSummary {
  id: string;
  email: string;
  orgId: string;
  createdAt: string;
}

export const userService = {
  async listUsers(): Promise<UserSummary[]> {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        orgId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      createdAt: user.createdAt.toISOString(),
    }));
  },
};
