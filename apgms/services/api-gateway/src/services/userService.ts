import { FastifyBaseLogger } from "fastify";
import { ServiceError } from "../utils/errors";
import { PrismaLike } from "./types";

export interface UserSummary {
  email: string;
  orgId: string;
  createdAt: Date;
}

export class UserService {
  constructor(private readonly prisma: PrismaLike, private readonly logger: FastifyBaseLogger) {}

  async listUsers(): Promise<UserSummary[]> {
    try {
      const users = (await this.prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })) as UserSummary[];
      return users;
    } catch (error) {
      this.logger.error({ err: error }, "Failed to list users");
      throw new ServiceError("internal", "Unable to list users", 500);
    }
  }
}
